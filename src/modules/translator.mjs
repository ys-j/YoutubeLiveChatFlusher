import { LRUCache } from './lrucache.mjs';

/**
 * @typedef LanguageDetection
 * @prop {string} source
 * @prop {boolean} isReliable
 */

export class LanguageDetectionController {
	/** @readonly */
	static SCRIPT_MAP = Object.freeze({
		'ja': /[\p{Script=Hiragana}\p{Script=Katakana}\uFF61-\uFF9F]/u,
		'ko': /[\p{Script=Hangul}]/u,
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
			if (firstResult && firstResult.confidence > .9) {
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
 * @typedef TranslationResult
 * @prop {string} sentence
 * @prop {string} src
 */

class TranslationCache {
	/** @type {Map<string, LRUCache<string, Promise<TranslationResult>>>} */
	#container = new Map();

	/**
	 * @param {number} capacity cache capacity
	 */
	constructor(capacity) {
		this.capacity = capacity;
	}

	/**
	 * Gets the translated cache if exists.
	 * @param {string} target target language
	 * @param {string} plain soruce text
	 * @returns {Promise<TranslationResult> | undefined} translation result or undefined
	 */
	get(target, plain) {
		const cache = this.#container.get(target);
		return cache?.get(plain);
	}

	/**
	 * Caches the translation result.
	 * @param {string} target target language
	 * @param {string} plain soruce text
	 * @param {Promise<TranslationResult>} result translation result
	 */
	set(target, plain, result) {
		let cache = this.#container.get(target);
		if (!cache) {
			cache = new LRUCache(this.capacity);
			this.#container.set(target, cache);
		}
		cache.set(plain, result);
	}

	/**
	 * @param {string} target target language
	 * @param {string} plain soruce text
	 */
	delete(target, plain) {
		const cache = this.#container.get(target);
		if (!cache) return false;
		return cache.delete(plain);
	}
}


export class TranslatorController {
	/** @type {Map<string, TranslatorSession | ExternalTranslatorSession>} */
	#translators = new Map();
	/** @type {TranslationCache} */
	#cache;

	/**
	 * @param {"internal" | "external"} mode translator mode
	 * @param {string} [url] external URL
	 * @param {object} [options]
	 * @param {object} [options.cache]
	 * @param {number} options.cache.capacity
	 * @param {number} options.cache.maxLength
	 */
	constructor(mode, url, options) {
		this.mode = mode;
		this.url = url ?? ExternalTranslatorSession.DEFAULT_URL;
		this.options = Object.assign({
			cache: { capacity: 100, maxLength: 10 },
		}, options);
		this.#cache = new TranslationCache(this.options.cache.capacity);
	}

	/**
	 * Translates text from the source language to the target language asynchronously.
	 * @param {string} text text to be translated
	 * @param {string} tl target language
	 * @param {string} sl source language
	 * @returns {Promise<TranslationResult>} promise of transtion result
	 */
	async translate(text, tl, sl = 'auto') {
		const cache = this.#cache.get(tl, text);
		if (cache) return cache;

		const options = {
			sourceLanguage: sl,
			targetLanguage: tl,
		};
		const key = `${sl},${tl}`;
		let translator = this.#translators.get(key);
		if (translator) {
			const src = sl === 'auto' && 'lastSrc' in translator ? translator.lastSrc : sl;
			const req = translator.translate(text).then(sentence => ({ sentence, src }));
			if ('lastSrc' in translator) this.tryCache(tl, text, req);
			return req;
		}

		let skip = false;
		if (this.mode === 'internal' && sl !== 'auto' && 'Translator' in self) {
			const availability = await self.Translator.availability(options);
			if (availability === 'available') {
				const translator = await self.Translator.create(options);
				this.#translators.set(key, translator);
				return {
					sentence: await translator.translate(text),
					src: sl,
				};
			} else {
				console.warn(`Built-in translator is fallbacked to external one because language model [${sl} to ${tl}] is not enabled yet (${availability} now).`);
				if (availability === 'downloading') skip = true;
			}
		}
		translator = new ExternalTranslatorSession({ url: this.url, ...options });
		if (!skip) this.#translators.set(key, translator);

		/** @type {Promise<TranslationResult>} */
		const req = translator.translate(text)
		.then(sentence => ({ sentence, src: /** @type {ExternalTranslatorSession} */ (translator).lastSrc }))
		.catch(reason => {
			this.#cache.delete(tl, text);
			throw reason;
		});
		this.tryCache(tl, text, req);
		return req;
	}

	/**
	 * Tries to cache the translation result.
	 * @param {string} tl target language
	 * @param {string} text source text
	 * @param {Promise<TranslationResult>} request promise of translation request
	 * @returns {boolean} whether succeeded
	 */
	tryCache(tl, text, request) {
		if (text.length <= this.options.cache.maxLength) {
			this.#cache.set(tl, text, request);
			return true;
		}
		return false;
	}
}


class ExternalTranslatorSession {
	static DEFAULT_URL = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&dt=bd&dj=1&q=$q';

	/** @type {string?} */ #q = null;
	/** @type {string} */ lastSrc = 'und';

	/**
	 * @param {TranslatorCreateCoreOptions & { url: string }} options
	 */
	constructor(options) {
		try {
			this.url = new URL(options.url);
			this.#setParams(options);
			if (!this.#q) {
				throw `Translator URL has no $q token: ${options.url}`;
			}
		} catch {
			this.url = new URL(ExternalTranslatorSession.DEFAULT_URL);
			this.#setParams(options);
		}
	}

	/**
	 * @param {TranslatorCreateCoreOptions} options
	 */
	#setParams({ sourceLanguage: sl, targetLanguage: tl }) {
		const p = this.url.searchParams;
		for (const [k, v] of p) {
			if (v === '$sl') p.set(k, sl);
			else if (v === '$tl') p.set(k, tl);
			else if (v === '$q') this.#q = k;
		}
	}

	/**
	 * @param {string} text source message
	 */
	async translate(text) {
		const p = this.url.searchParams;
		if (this.#q) p.set(this.#q, text);
		/** @type { { sentences: { trans: string }[], src: string }? } */
		const json = await fetch(this.url).then(res => res.json()).catch(console.warn);
		this.lastSrc = json?.src || 'und';
		return json?.sentences.map(s => s.trans).join('') || text;
	}

	destroy() {}
}
