import { store as s } from './store.mjs';

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

	get size() {
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

/**
 * Lays out chat item element.
 * @param {HTMLElement} el rendered element
 * @param {LiveChatLayoutCache} cache layout cache container
 * @param {"dense" | "random"} [mode] layout mode
 * @return renderer/element id
 */
export function layoutChatItem(el, cache, mode = 'dense') {
	cache.dom.appendChild(el);

	const hh = cache.dom.host.clientHeight, hw = cache.dom.host.clientWidth;
	const ch = el.clientHeight, cw = el.clientWidth;
	if (cw >= hw * (Number.parseInt(s.styles.max_width, 10) / 100 || 1)) {
		el.classList.add('wrap');
	}

	el.style.setProperty('--yt-lcf-translate-x', `-${hw + cw}px`);

	const body = /** @type {?HTMLElement} */ (el.lastElementChild);
	const content = body?.textContent;
	if (content) {
		browser.i18n.detectLanguage(content).then(res => {
			if (res.isReliable) {
				body.lang = res.languages[0].language;
			}
		});
	}

	const dir = s.others.direction & 1 ? 'bottom' : 'top';
	if (ch >= hh) {
		el.style[dir] = '0px';
		el.setAttribute('data-line', '0');
		const layout = new ChatLayoutInfo(el, 0);
		cache.set(el.id, layout);
		return el.id;
	}

	switch (mode) {
		case 'dense':
			return placeChatItemDensely(el, cache);
		case 'random':
			return placeChatItemRandomly(el, cache);
	}
}

/**
 * @param {HTMLElement} el chat item element
 * @param {LiveChatLayoutCache} cache cache object
 * @returns element id
 */
function placeChatItemDensely(el, cache) {
	const overline = cache.maps.length;
	const lhf = Number.parseFloat(s.styles.line_height) || 1.4;
	const dir = s.others.direction & 1 ? 'bottom' : 'top';
	const reversed = (s.others.direction & 2) > 0;
	const parentRect = cache.dom.host.getBoundingClientRect();

	let y = 0;
	/** @type {ChatLayoutInfo} */
	let layout;
	do {
		el.style[dir] = `${y * lhf}em`;
		el.setAttribute('data-line', `${y}`);
		layout = new ChatLayoutInfo(el, y);
		if (layout.isOverflow(parentRect)) break;
		if (cache.anyCollides(layout, reversed)) continue;
		cache.set(el.id, layout);
		return el.id;
	} while (++y <= overline);

	el.classList.add('overlap');
	const st = s.others.overlapping;
	const o = st & 0b01 ? .8 : 1;
	const dy = st & 0b10 ? .5 : 0;

	y = cache.maps.slice(0, y).reduce((pi, cv, ci, arr) => cv.size < arr[pi].size ? ci : pi, 0);
	el.setAttribute('data-line', `${y}`);
	layout = new ChatLayoutInfo(el, y);
	const len = cache.maps[y].values().filter(other => layout.isCollidable(other, reversed)).toArray().length || 1;
	el.style[dir] = `${(y + dy) * lhf}em`;
	el.style.opacity = `${Math.max(.5, o ** len)}`;
	el.style.zIndex = `-${len}`;
	cache.set(el.id, layout);
	return el.id;
}

/**
 * @param {HTMLElement} el chat item element
 * @param {LiveChatLayoutCache} cache cache object
 * @returns element id
 */
function placeChatItemRandomly(el, cache) {
	const overline = cache.maps.length;
	const lhf = Number.parseFloat(s.styles.line_height) || 1.4;
	const dir = s.others.direction & 1 ? 'bottom' : 'top';
	const reversed = (s.others.direction & 2) > 0;
	const parentRect = cache.dom.host.getBoundingClientRect();

	let y = 0;
	/** @type {ChatLayoutInfo} */
	let layout;
	const calculatedLine = new Set(Array(overline).keys());
	do {
		y = (overline * Math.random()) | 0;
		el.style[dir] = `${y * lhf}em`;
		el.setAttribute('data-line', `${y}`);
		layout = new ChatLayoutInfo(el, y);
		if (layout.isOverflow(parentRect)) {
			for (let i = y; i < overline; i++) calculatedLine.delete(i);
			continue;
		}
		if (cache.anyCollides(layout, reversed)) {
			calculatedLine.delete(y);
			continue;
		}
		break;
	} while (calculatedLine.size > 0);
	cache.set(el.id, layout);
	return el.id;
}

class ChatLayoutInfo {
	/** @type {HTMLElement} */ #elem;
	/** @type {DOMRect} */ #rect;
	/** @type {number} */ #line;
	/** @type {number} */ #range;

	/**
	 * @param {HTMLElement} elem
	 * @param {number} line
	 */
	constructor(elem, line) {
		this.#elem = elem;
		this.#rect = elem.getBoundingClientRect();
		this.#line = line;

		const computedStyle = getComputedStyle(elem);
		const lh = Number.parseFloat(computedStyle.lineHeight); // px
		this.#range = Math.ceil(this.height / lh);

		const [_durMatch, durNum, durUnit] = computedStyle.animationDuration.match(/^([\d.]+)(\D+)/) || [];
		const durFactor = durNum && durUnit && { 's': 1000, 'ms': 1 }[durUnit] || 0;
		this.duration = durFactor ? Number.parseFloat(durNum) * durFactor : Number.parseFloat(s.styles.animation_duration) * 1000;

		const [_translateMatch, translateX] = elem.style.getPropertyValue('--yt-lcf-translate-x').match(/^-?([\d.]+)px/) || [];
		this.speed = Number.parseFloat(translateX) / this.duration;
		this.createdOn = Date.now();
	}

	get lineStart() {
		return this.#line;
	}
	get lineEnd() {
		return this.#line + this.#range;
	}

	get width() {
		try {
			return this.#rect.width | 0;
		} catch {
			this.#rect = this.#elem.getBoundingClientRect();
			return this.#rect.width | 0;
		}
	}
	get height() {
		try {
			return this.#rect.height | 0;
		} catch {
			this.#rect = this.#elem.getBoundingClientRect();
			return this.#rect.height | 0;
		}
	}
	get top() {
		try {
			return this.#rect.top | 0;
		} catch {
			this.#rect = this.#elem.getBoundingClientRect();
			return this.#rect.top | 0;
		}
	}
	get bottom() {
		try {
			return this.#rect.bottom | 0;
		} catch {
			this.#rect = this.#elem.getBoundingClientRect();
			return this.#rect.bottom | 0;
		}
	}

	getLeft(factor = 1) {
		const elapsed = Date.now() - this.createdOn;
		return this.#rect.left - this.speed * elapsed * factor;
	}
	getRight(factor = 1) {
		const elapsed = Date.now() - this.createdOn;
		return this.#rect.right - this.speed * elapsed * factor;
	}

	/**
	 * Checks whether two flowing messages collide.
	 * @param {ChatLayoutInfo} before other preceding layout
	 * @param {boolean} [reversed=false] if direction is reversed
	 * @returns {boolean} whether this message collides against the preceding message
	 */
	isCollidable(before, reversed = false) {
		if (before.top <= this.top && this.top < before.bottom) {
			const posDiff = reversed ? before.getLeft(-1) - this.getRight(-1) : this.getLeft() - before.getRight();
			if (posDiff <= 0) return true;
			const speedDiff = this.speed - before.speed;
			if (speedDiff <= 0) return false;
			return posDiff < speedDiff * Math.min(before.duration, this.duration);
		} else {
			return false;
		}
	}

	/**
	 * Checks whether this element's position exceeds the size of parent.
	 * @param { { top: number, height: number } } parent parent bounding box
	 * @returns {boolean} whether child element is overflowing the parent
	 */
	isOverflow(parent) {
		return this.bottom > parent.top + parent.height;
	}
}
