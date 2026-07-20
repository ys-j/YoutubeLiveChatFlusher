/**
 * Checks if now in PiP-mode
 * @returns {boolean} if not PiP-mode now
 */
export function isNotPip() {
	return !self.documentPictureInPicture?.window;
}

const domParser = new DOMParser();

/**
 * Loads template html as DOM.
 * @param {string} path file path of templete html
 * @param {string[]} [i18nAttrs] attributes that require i18n
 * @returns {Promise<Document>} document object
 */
export async function loadTemplateDocument(path, i18nAttrs = []) {
	const url = browser.runtime.getURL(path);
	const text = await fetch(url).then(res => res.text());
	// Firefox 149+ will crash with Document.parseHTMLUnsafe().
	const doc = domParser.parseFromString(text.replace(/\r?\n|\t+/g, ''), 'text/html');
	for (const el of doc.querySelectorAll('[data-i18n]')) {
		const key = el.getAttribute('data-i18n');
		if (key) el.textContent = browser.i18n.getMessage(key);
	}
	for (const attr of i18nAttrs) {
		/** @type {NodeListOf<HTMLElement>} */
		const elems = doc.querySelectorAll(`[data-i18n-${attr}]`);
		for (const el of elems) {
			const key = el.getAttribute(`data-i18n-${attr}`);
			if (key) el.setAttribute(attr, browser.i18n.getMessage(key));
		}
	}
	return doc;
}

/**
 * Checks whether the player is showing ads or not.
 * @param {HTMLElement} player player element
 * @returns {boolean} whether thr player is showing ads
 */
export function isAdShowing(player) {
	return ['ad-showing', 'ad-interrupting'].some(c => player.classList.contains(c));
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
 * Escapes the text in order to convert into regular expression.
 * @param {string} str plain text
 * @returns escaped text
 */
export const escapeRegExp = str => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');

/**
 * Refreshes the regular expression list from the original list.
 * @param {RegExp[]} reList regular expression list
 * @param {object} opt
 * @param {boolean} opt.regexp whether the original list is regular expression
 * @param {string[]} opt.plainList original list
 */
export function refreshWordsList(reList, { regexp, plainList }) {
	reList.length = 0;
	if (regexp) {
		for (const s of plainList) reList.push(new RegExp(s, 'g'));
	} else if (plainList.length > 0) {
		const re = new RegExp(plainList.map(escapeRegExp).join('|'), 'g');
		reList.push(re);
	}
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
 * Formats milliseconds number to "h:mm:ss.fff"-style.
 * @param {number} ms milliseconds
 */
export function formatMilliseconds(ms) {
	const SECOND = 1000;
	const MINUTE = 60 * SECOND;
	const HOUR = 60 * MINUTE;
	/** @type {(f: number, digits?: number) => string} */
	const zfill = (f, digits = 2) => `${Math.floor(f)}`.padStart(digits, '0');
	const h = Math.floor(ms / HOUR);
	const mm = zfill((ms % HOUR) / MINUTE);
	const ss = zfill((ms % MINUTE) / SECOND);
	const fff = zfill(ms % SECOND, 3);
	return (h > 0 ? `${h}:` : '') + `${mm}:${ss}.${fff}`;
}
