/// <reference lib="esnext" />
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
		for (let i = layout.lineStart; i < layout.lineEnd; i++) {
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
		for (let i = target.lineStart; i < target.lineEnd; i++) {
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
	el.style.visibility = 'hidden';
	cache.dom.appendChild(el);

	const hh = cache.dom.host.clientHeight, hw = cache.dom.host.clientWidth;
	const ch = el.clientHeight, cw = el.clientWidth;
	if (cw >= hw * (Number.parseInt(s.styles.max_width, 10) / 100 || 1)) {
		el.classList.add('wrap');
	}

	el.style.setProperty('--yt-lcf-translate-x', `-${hw + cw}px`);

	const body = /** @type {HTMLElement?} */ (el.lastElementChild);
	if (body) {
		const content = body.textContent;
		if (content) {
			browser.i18n.detectLanguage(content).then(result => {
				if (result.isReliable) {
					body.lang = result.languages[0].language;
				}
			});
		}
	}

	const dir = s.others.direction & 1 ? 'bottom' : 'top';
	if (ch >= hh) {
		el.style[dir] = '0px';
		el.setAttribute('data-line', '0');
		el.style.visibility = '';
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
		const overflow = layout.isOverflow(parentRect);
		if (overflow) continue;
		const collidable = cache.anyCollides(layout, reversed);
		if (collidable) continue;
		el.style.visibility = '';
		cache.set(el.id, layout);
		return el.id;
	} while (++y <= overline);

	el.classList.add('overlap');
	const st = s.others.overlapping;
	const o = st & 0b01 ? .8 : 1;
	const dy = st & 0b10 ? .5 : 0;

	y = cache.maps.reduce((pi, cv, ci, arr) => cv.size < arr[pi].size ? ci : pi, 0);
	el.setAttribute('data-line', `${y}`);
	layout = new ChatLayoutInfo(el, y);
	const len = [...cache.maps[y].values().filter(layout => layout.isCollidable(layout))].length || 1;
	el.style.top = `${(y + dy) * lhf}em`;
	el.style.opacity = `${Math.max(.5, o ** len)}`;
	el.style.zIndex = `-${len}`;
	el.style.visibility = '';
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
		const overflow = layout.isOverflow(parentRect);
		if (overflow) {
			for (let i = y; i < overline; i++) {
				calculatedLine.delete(i);
			}
			continue;
		}
		const collidable = cache.anyCollides(layout, reversed);
		if (collidable) {
			calculatedLine.delete(y);
			continue;
		}
		break;
	} while (calculatedLine.size > 0);
	el.style.visibility = '';
	cache.set(el.id, layout);
	return el.id;
}

class ChatLayoutInfo {
	/** @type {DOMRect} */ #rect;
	/** @type {number} */ #line;
	/** @type {number} */ #range;

	/**
	 * @param {HTMLElement} elem
	 * @param {number} [line]
	 */
	constructor(elem, line = undefined) {
		this.#rect = elem.getBoundingClientRect();

		this.#line = line ?? Number.parseInt(elem.getAttribute('data-line') || '0', 10);

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
		return this.#rect.width;
	}
	get height() {
		return this.#rect.height;
	}
	get top() {
		return this.#rect.top;
	}
	get bottom() {
		return this.#rect.bottom;
	}
	get left() {
		const elapsed = Date.now() - this.createdOn;
		return this.#rect.left - this.speed * elapsed;
	}
	get right() {
		const elapsed = Date.now() - this.createdOn;
		return this.#rect.right - this.speed * elapsed;
	}

	/**
	 * Checks whether two flowing messages collide.
	 * @param {ChatLayoutInfo} before other preceding layout
	 * @param {boolean} [reversed=false] if direction is reversed
	 * @returns {boolean} whether this message collides against the preceding message
	 */
	isCollidable(before, reversed = false) {
		if (before.top <= this.top && this.top < before.bottom) {
			if (reversed ? before.left <= this.right : this.left <= before.right) {
				return true;
			} else if (before.duration <= this.duration && before.width >= this.width) {
				return false;
			} else {
				const speedDiff = this.width / this.duration - before.width / before.duration;
				const posDiff = reversed ? before.left - this.right : this.left - before.right;
				return posDiff < speedDiff * Math.min(before.duration, this.duration);
			}
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
