import { store as s } from './store.mjs';

// Allow for DOMRect rounding at touching edges, in viewport CSS pixels.
const RECT_TOLERANCE = .01;

export class LiveChatLayoutCache {
	/**
	 * @param {ShadowRoot} root shadow root
	 * @param {number} [numOfLanes] number of lanes
	 */
	constructor(root, numOfLanes = 20) {
		this.dom = root;
		/** @type {Map<string, ChatLayoutInfo>[]} */
		this.maps = Array.from({ length: numOfLanes }, () => new Map());
	}

	/**
	 * Number of distinct layouts stored across all lanes.
	 * A layout spanning multiple lanes is counted once here, unlike the sum of per-lane placements.
	 */
	get distinctSize() {
		return this.maps.reduce((a, c) => a.union(c), new Set()).size;
	}

	/**
	 * @param {number} numOfLanes
	 */
	resize(numOfLanes) {
		const len = this.maps.length;
		this.maps.length = numOfLanes;
		for (let i = len; i < numOfLanes; i++) {
			this.maps[i] = new Map();
		}
	}

	/**
	 * @param {string} id renderer id
	 * @returns {ChatLayoutInfo[] | undefined} list of layout info or undefined
	 */
	get(id) {
		const rslt = this.maps.map(m => m.get(id)).filter(v => v !== undefined);
		return rslt.length ? rslt : undefined;
	}

	/**
	 * @param {string} id renderer id
	 * @param {ChatLayoutInfo} layout layout info
	 */
	set(id, layout) {
		const len = Math.min(this.maps.length, layout.lineEnd);
		for (let i = layout.lineStart; i < len; i++) {
			this.maps[i].set(id, layout);
		}
	}

	/**
	 * @param {string} id renderer id
	 * @returns {boolean[]} if succeeded
	 */
	delete(id) {
		return this.maps.map(m => m.delete(id));
	}

	/**
	 * @param {HTMLElement} elem removed element
	 * @returns {boolean[]} if succeeded
	 */
	deleteElement(elem) {
		return this.maps.map(m => {
			const layout = m.get(elem.id);
			return layout?.matchesElement(elem) ? m.delete(elem.id) : false;
		});
	}

	clear() {
		for (const m of this.maps) m.clear();
	}

	/**
	 * @param {ChatLayoutInfo} target
	 * @param {boolean} [reversed=false]
	 * @returns {boolean} if this message collides against any preceding layout
	 */
	anyCollides(target, reversed = false) {
		const len = Math.min(this.maps.length, target.lineEnd);
		for (let i = target.lineStart; i < len; i++) {
			for (const preceding of this.maps[i].values()) {
				const collides = target.isCollidable(preceding, reversed);
				if (collides) return true;
			}
		}
		return false;
	}
}

/** @param {CSSStyleDeclaration} style resolved host style */
function getBorderBoxSize(style) {
	let width = Number.parseFloat(style.width), height = Number.parseFloat(style.height);
	if (style.boxSizing !== 'border-box') {
		for (const value of [style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth]) {
			width += Number.parseFloat(value) || 0;
		}
		for (const value of [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth]) {
			height += Number.parseFloat(value) || 0;
		}
	}
	return { width, height };
}

/**
 * Lays out chat item element.
 * @param {HTMLElement} el rendered element
 * @param {LiveChatLayoutCache} cache layout cache container
 * @param {"dense" | "random"} [mode] layout mode
 * @return renderer/element id
 */
export function layoutChatItem(el, cache, mode = 'dense') {
	cache.dom.appendChild(el);
	const host = cache.dom.host;
	const hw = host.clientWidth, hh = host.clientHeight;
	if (el.clientWidth >= hw * (Number.parseInt(s.styles.max_width, 10) / 100 || 1)) {
		el.classList.add('wrap');
	}

	const cw = el.clientWidth, ch = el.clientHeight;
	el.style.setProperty('--yt-lcf-translate-x', `-${hw + cw}px`);
	const dir = s.others.direction & 1 ? 'bottom' : 'top';
	const reversed = (s.others.direction & 2) > 0;
	const lhf = Number.parseFloat(s.styles.line_height) || 1.4;
	const parentRect = host.getBoundingClientRect();
	// clientWidth/Height are rounded integers and exclude borders. Comparing
	// them with DOMRect sizes would mistake fractional pixels for a transform.
	const hostSize = getBorderBoxSize(getComputedStyle(host));
	const scaleX = hostSize.width > 0 ? parentRect.width / hostSize.width : 1;
	const scaleY = hostSize.height > 0 ? parentRect.height / hostSize.height : 1;
	// Arbitrary user CSS can change geometry by lane or by the overlap class.
	const measured = !!s.styles.layer_css || Object.values(s.cssTexts).some(Boolean);
	el.style[dir] = '0em';
	el.setAttribute('data-line', '0');
	let layout = new ChatLayoutInfo(el, 0, scaleX, scaleY);
	const step = lhf * layout.fontSize * scaleY;

	/**
	 * @param {number} line
	 * @param {number} [offset]
	 */
	function updateCandidate(line, offset = 0) {
		if (measured) {
			el.style[dir] = `${(line + offset) * lhf}em`;
			el.setAttribute('data-line', `${line}`);
			el.style.setProperty('--yt-lcf-translate-x', `-${hw + el.clientWidth}px`);
			layout = new ChatLayoutInfo(el, line + offset, scaleX, scaleY);
		} else {
			layout.moveTo(line + offset, step * (dir === 'bottom' ? -1 : 1));
		}
		return layout;
	}

	/**
	 * @param {number} line
	 * @param {number} [offset]
	 */
	function finish(line, offset = 0) {
		el.style[dir] = `${(line + offset) * lhf}em`;
		el.setAttribute('data-line', `${line}`);
		cache.set(el.id, layout);
		return el.id;
	}

	if (ch >= hh || cache.maps.length === 0) return finish(0);

	if (mode === 'random') {
		const remaining = Array.from(cache.maps.keys());
		let line = 0, fallbackLine = 0;
		while (remaining.length) {
			line = remaining.splice((remaining.length * Math.random()) | 0, 1)[0];
			updateCandidate(line);
			if (layout.isOverflow(parentRect)) continue;
			fallbackLine = line;
			if (!cache.anyCollides(layout, reversed)) return finish(line);
		}
		updateCandidate(fallbackLine);
		return finish(fallbackLine);
	}

	let line = 0;
	for (; line < cache.maps.length; line++) {
		updateCandidate(line);
		if (layout.isOverflow(parentRect)) break;
		if (!cache.anyCollides(layout, reversed)) return finish(line);
	}

	el.classList.add('overlap');
	const st = s.others.overlapping;
	const o = st & 0b01 ? .8 : 1;
	const dy = st & 0b10 ? .5 : 0;
	line = cache.maps.slice(0, Math.max(1, line)).reduce((pi, cv, ci, arr) => cv.size < arr[pi].size ? ci : pi, 0);
	updateCandidate(line, dy);
	const preceding = new Set();
	for (let i = layout.lineStart; i < Math.min(cache.maps.length, layout.lineEnd); i++) {
		for (const other of cache.maps[i].values()) preceding.add(other);
	}
	const len = preceding.values().filter(other => layout.isCollidable(other, reversed)).toArray().length || 1;
	el.style.opacity = `${Math.max(.5, o ** len)}`;
	el.style.zIndex = `-${len}`;
	return finish(line, dy);
}

class ChatLayoutInfo {
	/** @type {WeakRef<HTMLElement>} */ #elem;
	/** @type {{width: number, height: number, top: number, bottom: number, left: number, right: number}} */ #rect;
	/** @type {number} */ #originTop;
	/** @type {number} */ #line;
	/** @type {number} */ #lineHeight;

	/**
	 * @param {HTMLElement} elem
	 * @param {number} line
	 * @param {number} scaleX
	 * @param {number} scaleY
	 */
	constructor(elem, line, scaleX, scaleY) {
		this.#elem = new WeakRef(elem);
		const rect = elem.getBoundingClientRect();
		// Keep mutable coordinates for candidate top/bottom updates without remeasuring the DOM.
		this.#rect = { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
		this.#originTop = rect.top;
		this.#line = line;
		const computedStyle = getComputedStyle(elem);
		this.fontSize = Number.parseFloat(computedStyle.fontSize);
		const lh = Number.parseFloat(computedStyle.lineHeight) || this.fontSize * (Number.parseFloat(s.styles.line_height) || 1.4);
		this.#lineHeight = lh * scaleY;
		const [_durMatch, durNum, durUnit] = computedStyle.animationDuration.match(/^([\d.]+)(\D+)/) || [];
		const durFactor = durNum && durUnit && { 's': 1000, 'ms': 1 }[durUnit] || 0;
		this.duration = durFactor ? Number.parseFloat(durNum) * durFactor : Number.parseFloat(s.styles.animation_duration) * 1000;
		const [_translateMatch, translateX] = elem.style.getPropertyValue('--yt-lcf-translate-x').match(/^-?([\d.]+)px/) || [];
		this.speed = Number.parseFloat(translateX) * scaleX / this.duration;
		this.createdOn = Date.now();
	}

	/** @param {HTMLElement} elem */
	matchesElement(elem) {
		return this.#elem.deref() === elem;
	}

	/** @param {number} line @param {number} step */
	moveTo(line, step) {
		this.#line = line;
		this.#rect.top = this.#originTop + line * step;
		this.#rect.bottom = this.#rect.top + this.#rect.height;
	}

	get lineStart() { return Math.floor(this.#line); }
	get lineEnd() {
		const end = Math.ceil(this.#line + (this.height - RECT_TOLERANCE) / this.#lineHeight);
		// A positive-height item must occupy at least one lane, even if tiny.
		return this.height > 0 ? Math.max(this.lineStart + 1, end) : this.lineStart;
	}
	get width() { return this.#rect.width; }
	get height() { return this.#rect.height; }
	get top() { return this.#rect.top; }
	get bottom() { return this.#rect.bottom; }

	getLeft(factor = 1) {
		return this.#rect.left - this.speed * (Date.now() - this.createdOn) * factor;
	}
	getRight(factor = 1) {
		return this.#rect.right - this.speed * (Date.now() - this.createdOn) * factor;
	}

	/**
	 * @param {ChatLayoutInfo} before preceding layout
	 * @param {boolean} [reversed=false]
	 * @returns {boolean}
	 */
	isCollidable(before, reversed = false) {
		if (this.top >= before.bottom - RECT_TOLERANCE || before.top >= this.bottom - RECT_TOLERANCE) return false;
		const posDiff = reversed ? before.getLeft(-1) - this.getRight(-1) : this.getLeft() - before.getRight();
		if (posDiff <= 0) return true;
		const speedDiff = this.speed - before.speed;
		if (speedDiff <= 0) return false;
		return posDiff < speedDiff * Math.min(before.duration, this.duration);
	}

	/** @param {{top: number, height: number}} parent */
	isOverflow(parent) {
		// DOMRect coordinates can round just beyond an exactly aligned host edge.
		return this.top < parent.top - RECT_TOLERANCE || this.bottom > parent.top + parent.height + RECT_TOLERANCE;
	}
}
