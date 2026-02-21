/// <reference path="../../types/browser.d.ts" />
/// <reference path="../../types/extends.d.ts" />
/// <reference path="../../types/ytlivechatrenderer.d.ts" />

/**
 * Checks if now in PiP-mode
 * @returns {boolean} if not PiP-mode now
 */
export function isNotPip() {
	return !self.documentPictureInPicture?.window;
}

/**
 * Loads template html as DOM.
 * @param {string} path file path of templete html
 * @returns {Promise<Document>} document object
 */
export async function loadTemplateDocument(path) {
	const url = browser.runtime.getURL(path);
	const text = await fetch(url).then(res => res.text());
	return Document.parseHTMLUnsafe(text);
}

/**
 * Gets string from a message object.
 * @param { LiveChat.Runs | LiveChat.SimpleText | undefined } message message object: Runs or SimpleText
 * @returns {string} message string
 */
export function getText(message) {
	if (!message) return '';
	if ('simpleText' in message) return message.simpleText;
	const rslt = [];
	for (const r of message.runs) {
		if ('text' in r) {
			rslt.push(r.text);
		} else {
			rslt.push(r.emoji.shortcuts?.[0] || r.emoji.emojiId || '');
		}
	}
	return rslt.join('');
}

/**
 * Checks whether two flowing messages collide.
 * @param {Element} before preceding message
 * @param {Element} after following message
 * @param {boolean} [reversed=false] if direction is reversed
 * @returns whether the following message collides against the preceding message
 */
export function isCatchable(before, after, reversed = false) {
	const [b, a] = [before, after].map(elm => elm.getBoundingClientRect());
	if (b.top <= a.top && a.top < b.bottom) {
		if (reversed ? b.left <= a.right : a.left <= b.right) {
			return true;
		} else {
			const [bDur, aDur] = [before, after].map(elm => {
				const dur = getComputedStyle(elm).animationDuration;
				const [_, num, unit] = dur.match(/([\d\.]+)(\D+)/) || [];
				if (num && unit) switch (unit) {
					case 'ms': return Number.parseFloat(num);
					case 's': return Number.parseFloat(num) * 1000;
				}
				return 4000;
			});
			if (bDur <= aDur && b.width >= a.width) {
				return false;
			} else {
				const speedDiff = a.width / aDur - b.width / bDur;
				const posDiff = reversed ? b.left - a.right : a.left - b.right;
				return posDiff < speedDiff * Math.min(bDur, aDur);
			}
		}
	} else {
		return false;
	}
}

/**
 * Checks whether an element's position exceeds the size of its parent.
 * @param {Element} parent parent element
 * @param {Element} child child element
 * @returns whether child element is overflowing the parent
 */
export function isOverflow(parent, child) {
	const p = parent.getBoundingClientRect();
	const c = child.getBoundingClientRect();
	return c.bottom > p.top + p.height;
}

/**
 * Gets message filtered according to the rules.
 * @param {string} str original message
 * @param {object} [options] filtering options
 * @param {number} [options.mode] `0` for no filtering, `1` for all removal, `2` for word replacement, or `3` for character replacement
 * @param {RegExp[]} [options.rules] filtering rules
 * @param {string} [options.replacement] replacement string
 * @returns {IteratorResult<string, string>} filtering result
 */
export function filterMessage(str, options = {}) {
	let done = false;
	const mode = options.mode || 0;
	const rules = options.rules || [];
	const replacement = options.replacement || '';
	switch (mode) {
		// g.index.mutedWords.all
		case 1: {
			for (const rule of rules) {
				if (rule.test(str)) {
					rule.lastIndex = 0;
					return { value: '', done: true };
				}
			}
			break;
		}
		// g.index.mutedWords.word
		case 2: {
			for (const rule of rules) {
				if (rule.test(str)) {
					str = str.replace(rule, replacement);
					done = true;
				}
			}
			break;
		}
		// g.index.mutedWords.char
		case 3: {
			const char = [...replacement][0];
			for (const rule of rules) {
				if (rule.test(str)) {
					str = char ? str.replace(rule, m => {
						const len = [...m].length;
						return char.repeat(len);
					}) : str.replace(rule, '');
					done = true;
				}
			}
			break;
		}
	}
	return { value: str, done };
}

/**
 * Converts color from long integer to array of integer.
 * @param {number} long integer of color `0xAARRGGBB`
 * @returns {number[]} array of integer `[RR, GG, BB]`
 */
export function getColorRGB(long) {
	/** @type {string[]} */ 
	const separated = long.toString(16).match(/[0-9a-f]{2}/g) || [];
	return separated.map(hex => Number.parseInt(hex, 16)).slice(1);
}

/**
 * Converts CSS color value from short hex-format or rgb()-format to normal hex-format.
 * @param {string} css short hex-format or rgb()-format color value (e.g. `#abc`, `rgb(0, 128, 255)`)
 * @param {string} [inherit='#ffffff'] default value
 * @returns {string} normal hex-format color (e.g. `#123456`)
 */
export function formatHexColor(css, inherit = '#ffffff') {
	const color = css.trim();
	if (color.startsWith('#')) {
		if (color.length > 6) {
			return color.slice(0, 7);
		} else if (color.length > 3) {
			const [_, r, g, b] = color;
			return '#' + [r, g, b].map(s => s + s).join('');
		}
	} else if (color.startsWith('rgb')) {
		const [_, r, g, b] = color.match(/(\d+),?\s*(\d+),?\s*(\d+)/) || [];
		if (_) {
			return '#' + [r, g, b].map(s => Number.parseInt(s).toString(16).padStart(2, '0')).join('');
		}
	}
	return inherit;
}
