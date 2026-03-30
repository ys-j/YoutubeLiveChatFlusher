/**
 * @typedef LanguageDetection
 * @prop {string} source
 * @prop {boolean} isReliable
 */

export class LanguageDetectionController {
	static SCRIPT_MAP = Object.freeze({
		'ja': /[\p{Script=Hiragana}\p{Script=Katakana}\uFF61-\uFF9F]/u,
		'ko': /\p{Script=Hangul}/u,
	});
	/** @type {LanguageDetectorSession?} */ #detector = null;
	isReady = false;

	async ready() {
		const availability = await self.LanguageDetector?.availability();
		if (availability === 'available') {
			const session = await self.LanguageDetector.create();
			if (session) this.#detector = session;
		}
		this.isReady = true;
	}
	
	/**
	 * Detects text language.
	 * @param {string} text 
	 * @returns {Promise<LanguageDetection>} detection
	 */
	async detect(text) {
		for (const [lang, pattern] of Object.entries(LanguageDetectionController.SCRIPT_MAP)) {
			if (pattern.test(text)) {
				return { source: lang, isReliable: true };
			}
		}
		if (this.#detector) {
			const result = await this.#detector.detect(text);
			const firstResult = result.at(0);
			if (firstResult && firstResult.confidence > .8) {
				return {
					source: firstResult.detectedLanguage,
					isReliable: true,
				};
			}
		}
		const result = await browser.i18n.detectLanguage(text);
		return {
			source: result.languages.at(0)?.language || 'und',
			isReliable: result.isReliable,
		};
	}
}

/**
 * @typedef TranslationControllerOptions
 * @prop {object} translation
 * @prop {boolean} translation.regexp
 * @prop {string[]} translation.plainList
 * @prop {object} others
 * @prop {number} others.except_lang
 */

export class TranslationController {
	/** @readonly */
	static TRANSLATABLE_PATTERN = /[\p{L}\p{N}]/u;
	/** @readonly */
	static REPEATING_PATTERN = /^\w+$|^(\S)\1{2,}$/

	/**
	 * @param {TranslationControllerOptions} options
	 */
	constructor(options) {
		this.exceptedLanguages = navigator.languages.filter((_, i) => options.others.except_lang & 1 << i);

		const re = options.translation.regexp;
		const list = options.translation.plainList.filter(l => l.trim());
		if (list.length > 0) {
			/** @type {(r: string) => string} */
			const transform = re ? r => `(?:${r})` : r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			this.exceptionRule = new RegExp(list.map(transform).join('|'));
		} else {
			this.exceptionRule = /$^/;
		}

		this.detector = new LanguageDetectionController();
	}

	/**
	 * Checks if the message will be translated.
	 * @param {string} text original message
	 * @returns {Promise<LanguageDetection?>} detection result
	 */
	async check(text) {
		if (!text) {
			console.warn('Empty text was passed.');
			return null;
		}
		if (!TranslationController.TRANSLATABLE_PATTERN.test(text)) {
			console.warn('Text does not contain any translatable characters:', text);
			return null;
		}
		if (TranslationController.REPEATING_PATTERN.test(text)) {
			console.debug('Text contains only repeating characters:', text);
			return null;
		}
		if (this.exceptionRule.test(text)) {
			console.debug('Text contains an exception word.');
			return null;
		}
		const detection = await this.detector.detect(text);
		if (this.exceptedLanguages.includes(detection.source)) {
			return null;
		}
		return detection;
	}

	/**
	 * Translates node into target language.
	 * @param {Node} node `<span>` element or text node
	 * @param {LanguageDetection} detection source launguage detection
	 * @param {string} target target launguage
	 * @returns {Promise<Node>} translated node
	 */
	async translate(node, detection, target) {
		const text = node.textContent;
		if (!text) return node;

		const span = document.createElement('span');
		
		/** @type {Record<string, string>} */
		const translation = { text, target };
		if (detection.isReliable) {
			translation.source = detection.source;
		}
		/** @type { { sentence: string, src: string } | undefined } */
		const res = await browser.runtime.sendMessage({ translation });
		if (res && !this.exceptedLanguages.includes(res.src) && res.sentence !== text) {
			span.setAttribute('data-srclang', res.src);
			span.textContent = res.sentence;
		} else {
			span.textContent = text;
		}
		return span;
	}
}
