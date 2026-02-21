
import { store } from './store.mjs';

import { getChatMessage } from './chat_controller.mjs';

/**
 * @typedef LanguageDetection
 * @prop {string} source
 * @prop {boolean} isReliable
 */

/**
 * @typedef TranslationControllerOptions
 * @prop {object} translation
 * @prop {string} translation.translator
 * @prop {string} translation.url
 * @prop {boolean} translation.regexp
 * @prop {string[]} translation.plainList
 * @prop {object} others
 * @prop {number} others.except_lang
 */

class TranslationController {
	/**
	 * @param {TranslationControllerOptions} options
	 */
	constructor(options) {
		this.mode = options.translation.translator;
		this.templateUrl = options.translation.url;

		this.exceptedLanguages = navigator.languages.filter((_, i) => options.others.except_lang & 1 << i);

		const re = options.translation.regexp;
		const list = options.translation.plainList;
		this.exceptionRules = re ? {
			rules: list.map(r => new RegExp(r)),
			/** @param {string} s text */
			match(s) {
				for (const r of this.rules) if (r.test(s)) return true;
				return false;
			},
		}: {
			rules: list,
			/** @param {string} s text */
			match(s) {
				for (const r of this.rules) if (s.includes(r)) return true;
				return false;
			}
		};
	}

	/**
	 * Checks if the message will be translated.
	 * @param {string} text original message
	 * @returns {Promise<LanguageDetection>} detection result
	 */
	async check(text) {
		if (!text) throw 'Empty text was passed.';
		const detection = await browser.i18n.detectLanguage(text);
		const source = detection.languages.at(0)?.language;
		if (!source) throw 'Failed to detect the source language.';
		if (this.exceptedLanguages.includes(source)) {
			throw `Source language (${source}) is set as exceptions: ` + this.exceptedLanguages.join();
		}
		if (this.exceptionRules.match(text)) {
			throw 'Text contains an exception word.';
		}
		return { source, isReliable: detection.isReliable };
	}

	/**
	 * 
	 * @param {Record<string, string>} replacer 
	 */
	getReadyUrl(replacer) {
		let url = this.templateUrl;
		for (const [k, v] of Object.entries(replacer)) {
			url = url.replace(k, v);
		}
		return url;
	}

	/**
	 * @param {Node} node `<span>` element or text node
	 * @param {LanguageDetection} detection source launguage detection
	 * @param {string} target target launguage
	 * @returns {Promise<Node>} translated node
	 */
	async translateNode(node, detection, target) {
		const text = node.textContent;
		if (!text) return node;

		const span = document.createElement('span');
		const { source, isReliable } = detection;
		if (isReliable) {
			span.dataset.srclang = source;
		}
		
		const url = this.getReadyUrl({
			$sl: isReliable ? source : 'auto',
			$tl: target,
			$q: encodeURIComponent(text),
		});
		/** @type { { sentences: { trans: string }[], src: string }? } */
		const json = await fetch(url).then(res => res.json());
		if (json && !this.exceptedLanguages.includes(json.src)) {
			span.dataset.srclang ??= json.src;
			span.textContent = json.sentences.map(s => s.trans).join('') || '';
		} else {
			delete span.dataset.srclang;
			span.textContent = text;
		}
		return span;
	}
}

const translationCtl = new TranslationController(store);

export class ChatMessageContainer {
	/** @type {Array<HTMLSpanElement | Text>} */ original;
	/** @type {HTMLElement} */ suffix;
	/** @type {Node[]} */ translated = [];
	/** @type {boolean} */ hasTranslated = false;

	/**
	 * @param {LiveChat.RendererContent["message"]} message 
	 */
	constructor(message) {
		this.original = getChatMessage(message);
		this.suffix = document.createElement('small');
		this.suffix.classList.add('original');
	}

	detectAsync() {
		return Promise.allSettled(this.original.map(node => {
			const text = node.textContent;
			return translationCtl.check(text);
		}));
	}

	/**
	 * @param {"eager" | "lazy"} mode translation mode
	 * @param {string} target target language
	 * @param {boolean} suffix whether suffixes original message
	 */
	async translate(mode, target, suffix = false) {
		const detectionResults = await this.detectAsync();
		this.hasTranslated = detectionResults.some(p => p.status === 'fulfilled');
		const fn = mode === 'eager' ? this.#translateEager : this.#translateLazy;
		fn(detectionResults, target, suffix);
	}

	/**
	 * @param {PromiseSettledResult<LanguageDetection>[]} detectionResults results of detection promise
	 * @param {string} target target language
	 * @param {boolean} suffix whether suffixes original message
	 */
	async #translateEager(detectionResults, target, suffix) {
		this.translated = await Promise.all(detectionResults.map(async (p, i) => {
			const node = this.original[i];
			if (p.status === 'fulfilled') {
				return await translationCtl.translateNode(node, p.value, target);
			} else {
				return node;
			}
		}));
		if (suffix && !this.equals()) {
			this.suffix.append(...this.original);
		}
	}

	/**
	 * @param {PromiseSettledResult<LanguageDetection>[]} detectionResults results of detection promise
	 * @param {string} target target language
	 * @param {boolean} suffix whether suffixes original message
	 */
	async #translateLazy(detectionResults, target, suffix) {
		this.translated = this.original.map(node => node.cloneNode(true));
		this.translated = await Promise.all(detectionResults.map(async (p, i) => {
			const node = this.original[i];
			if (p.status === 'fulfilled') {
				const translated = await translationCtl.translateNode(node, p.value, target);
				const child = this.translated[i];
				child?.parentNode?.replaceChild(translated, child);
				return translated;
			} else {
				return node;
			}
		}));
		if (suffix && !this.equals()) {
			/** @param {Node} node */
			const cloneText = node => node instanceof Element && node.classList.contains('emoji') ? new Text() : node.cloneNode();
			this.suffix.append(...this.original.map(cloneText));
		}
	}

	equals() {
		const originalText = this.original.map(n => n.textContent).join('');
		const translatedText = this.translated.map(n => n.textContent).join('');
		return originalText === translatedText;
	}

	*[Symbol.iterator]() {
		if (this.hasTranslated) {
			for (const node of this.translated) yield node;
			yield this.suffix;
		} else {
			for (const node of this.original) yield node;
		}
	}
}