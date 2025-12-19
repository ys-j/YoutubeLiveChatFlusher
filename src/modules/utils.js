/// <reference path="../../types/browser.d.ts" />
/// <reference path="../../types/ytlivechatrenderer.d.ts" />

self.browser ??= chrome;

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
 * Checks if now in PiP-mode
 * @returns {boolean} if not PiP-mode now
 */
export function isNotPip() {
	return !self.documentPictureInPicture?.window;
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

/**
 * @typedef PartStyle
 * @prop {boolean} photo
 * @prop {boolean} name
 * @prop {boolean} [message]
 * @prop {boolean} [amount]
 * @prop {boolean} [sticker]
 * @prop {boolean} [months]
 * @prop {string?} [color]
 */

/**
 * @typedef StorageSchema
 * @prop {Record<string, string>} styles
 * @prop {Record<string, number>} others
 * @prop {Record<string, PartStyle>} parts
 * @prop {Record<string, string>} cssTexts
 * @prop {Record<string, string>} hotkeys
 * @prop {object} mutedWords
 * @prop {number} mutedWords.mode
 * @prop {string} mutedWords.replacement
 * @prop {boolean} mutedWords.regexp
 * @prop {string[]} mutedWords.plainList
 * @prop {object} translation
 * @prop {string} translation.url
 * @prop {boolean} translation.regexp
 * @prop {string[]} translation.plainList
 */

export const Storage = {
	/** @type {StorageSchema} */
	DEFAULT: {
		styles: {
			animation_duration: '8s',
			font_size: '32px',
			line_height: '1.4',
			font_family: 'sans-serif',
			font_weight: '500',
			stroke_color: '#000000',
			stroke_offset: '1px',
			stroke_blur: '0px',
			layer_opacity: '1',
			background_opacity: '0.5',
			max_width: '100%',
			sticker_size: '3em',
			layer_css: '',
		},
		others: {
			disabled: 0,
			px_per_sec: 0,
			number_of_lines: 0,
			type_of_lines: 0,
			wrap: 1,
			limit: 0,
			container_limit: 0,
			simultaneous: 2,
			emoji: 1,
			overlapping: 0,
			direction: 0,
			translation: 0,
			except_lang: 0,
			translation_timing: 0,
			suffix_original: 0,
			time_shift: 0,
			mode_livestream: 0,
			mode_replay: 1,
			autostart: 0,
			message_pause: 1,
		},
		parts: {
			normal: { photo: false, name: false, message: true, color: '' },
			verified: { photo: true, name: true, message: true, color: '' },
			member: { photo: false, name: false, message: true, color: '' },
			moderator: { photo: true, name: true, message: true, color: '' },
			owner: { photo: true, name: true, message: true, color: '' },
			you: { photo: false, name: false, message: true, color: '' },
			paid_message: { photo: true, name: true, amount: true, message: true, color: '' },
			paid_sticker: { photo: true, name: true, amount: true, sticker: true },
			membership: { photo: true, name: false, message: true, color: '' },
			milestone: { photo: true, name: true, months: true, message: true, color: '' },
		},
		cssTexts: {
			'.normal': '',
			'.verified': '',
			'.member': '',
			'.moderator': '',
			'.owner': '',
			'.you': '',
			'.paid_message': '',
			'.paid_sticker': '',
			'.membership': '',
			'.milestone': '',
			'': '',
		},
		hotkeys: {
			layer: '',
			panel: '',
		},
		mutedWords: {
			mode: 0,
			replacement: '',
			regexp: false,
			plainList: [],
		},
		translation: {
			url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&dt=bd&dj=1&q=$q',
			regexp: false,
			/** @type {string[]} */
			plainList: [],
		},
	},

	/**
	 * @param {string[]} [keys] 
	 * @returns {Promise<Record<string, any>>}
	 */
	async get(keys) {
		const store = await browser.storage.local.get(keys);
		return store;
	},

	/**
	 * @param {Record<string, any>} store 
	 * @returns {Promise<void>}
	 */
	async set(store = Object.create(null)) {
		const assigned = structuredClone(Storage.DEFAULT);
		for (const k of Object.keys(assigned)) {
			// @ts-ignore
			Object.assign(assigned[k], store[k]);
		}
		await browser.storage.local.set(assigned);
	},

	async export() {
		const store = Storage.get()
		const blob = new Blob([ JSON.stringify(store) ], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.download = `ytlcf-config-${Date.now()}.json`;
		a.href = url;
		a.click();
	},

	async import() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json';
		input.addEventListener('cancel', () => {
			console.log('Config file import is canceled.');
		}, { passive: true });
		input.addEventListener('change', e => {
			const files = input.files;
			if (files && files.length > 0) {
				console.log('Config file selected: ' + files[0].name);
				const reader = new FileReader();
				reader.onload = async e => {
					const json = JSON.parse(/** @type {string} */ (e.target?.result));
					await Storage.set(json).then(refreshPage);
				};
				reader.readAsText(files[0]);
			}
		}, { passive: true });
		input.click();
	},

	async init() {
		await Storage.set().then(refreshPage);
	}
};

/**
 * Sends a signal to refresh all tabs running this extension.
 * @returns {Promise<void>}
 */
async function refreshPage() {
	await browser.runtime.sendMessage({ fire: 'reload' });
}