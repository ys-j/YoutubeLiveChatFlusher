/**
 * Checks whether now in PiP-mode
 * @returns {boolean} whether not PiP-mode now
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
	// Use DOMParser because Document.parseHTMLUnsafe() crashes on Firefox 149 and lower.
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
 * Escapes the text in order to convert into regular expression.
 * @param {string} str plain text
 * @returns escaped text
 */
const escapeRegExp = str => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');

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
