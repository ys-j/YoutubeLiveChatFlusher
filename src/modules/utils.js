/// <reference path="../../ytlivechatrenderer.d.ts" />

/**
 * @param { LiveChat.Runs | LiveChat.SimpleText | undefined } message
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
 * @param {Element} before 
 * @param {Element} after 
 * @param {boolean} [reversed=false] 
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
 * @param {Element} before 
 * @param {Element} after 
 */
export function isOverlapping(before, after) {
	const [b, a] = [before, after].map(elm => elm.getBoundingClientRect());
	const [bDur, aDur] = [before, after].map(elm => {
		const dur = getComputedStyle(elm).animationDuration;
		const [_, num, unit] = dur.match(/([\d\.]+)(\D+)/) || [];
		if (num && unit) switch (unit) {
			case 'ms': return Number.parseFloat(num);
			case 's': return Number.parseFloat(num) * 1000;
		}
		return 4000;
	});
	const bSpeed = b.width / bDur, aSpeed = a.width / aDur;
	const speedDiff = aSpeed - bSpeed;
	const start = (a.left - b.right) / speedDiff;
	const end = (a.right - b.left) / speedDiff;
	return end > start ? Math.min(Math.round(end - start), bDur) : 0;
}

/**
 * @param {Element} parent 
 * @param {Element} child 
 */
export function isOverflow(parent, child) {
	const p = parent.getBoundingClientRect();
	const c = child.getBoundingClientRect();
	return c.bottom > p.top + p.height;
}

/**
 * @typedef FilterOptions
 * @prop {number} [mode]
 * @prop {RegExp[]} [rules]
 * @prop {string} [replacement]
 */
/**
 * @param {string} str 
 * @param {FilterOptions} [options] 
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
 * Check if now in PiP-mode
 * @returns {boolean} if not PiP-mode now
 */
export function isNotPip() {
	return !self.documentPictureInPicture?.window;
}

/**
 * Convert color from long integer to array of integer.
 * @param {number} long integer of color `0xAARRGGBB`
 * @returns {number[]} array of integer `[RR, GG, BB]`
 */
export function getColorRGB(long) {
	const separated = /** @type {string[]} */ (long.toString(16).match(/[0-9a-f]{2}/g) || [])
	return separated.map(hex => Number.parseInt(hex, 16)).slice(1);
}

/**
 * Convert CSS color value from short hex-format or rgb()-format to normal hex-format.
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
			return color[0] + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
		}
	} else if (color.startsWith('rgb')) {
		const [_, r, g, b] = color.match(/(\d+),\s*(\d+),\s*(\d+)/) || [];
		if (_) {
			return '#' + [r, g, b].map(s => Number.parseInt(s).toString(16).padStart(2, '0')).join('');
		}
	}
	return inherit;
}