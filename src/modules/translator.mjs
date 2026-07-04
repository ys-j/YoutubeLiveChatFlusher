import { logger } from './logging.mjs';
import { LRUCache } from './lrucache.mjs';

/**
 * @typedef LanguageDetection
 * @prop {string} source
 * @prop {boolean} isReliable
 */

 /**
  * @typedef ExternalTranslatorGetConfig
  * @prop {string} url
  * @prop {"GET"} method
  * @prop {"Google" | "OpenAI"} responseStyle
  */

 /**
  * @typedef ExternalTranslatorPostConfig
  * @prop {string} url
  * @prop {"POST"} method
  * @prop {string} apiKey
  * @prop {string} modelName
  * @prop {string} [json]
  * @prop {"Google" | "OpenAI"} responseStyle
  */


export class LanguageDetectionController {
	/** @readonly */
	static SCRIPT_MAP = Object.freeze({
		'ja': /[\p{Script=Hiragana}\p{Script=Katakana}\uFF61-\uFF9F]/u,
		'ko': /[\p{Script=Hangul}]/u,
	});
	/** @type {?LanguageDetector} */ #detector = null;
	isReady = false;

	async ready() {
		const availability = 'LanguageDetector' in self ? await LanguageDetector.availability() : null;
		if (availability === 'available') {
			const session = await LanguageDetector.create();
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
			const results = await this.#detector.detect(text);
			const r = results.at(0);
			const isReliable = (r?.confidence || 0) > .9;
			const source = r?.detectedLanguage;
			if (isReliable && source) return { source, isReliable };
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
	/** @type {Map<string, Translator | ExternalTranslator>} */
	#translators = new Map();
	/** @type {TranslationCache} */
	#cache;

	/**
	 * @param {"internal" | "external"} mode translator mode
	 * @param {ExternalTranslatorGetConfig | ExternalTranslatorPostConfig} [externalConfig] external config
	 * @param {object} [options]
	 * @param {object} [options.cache]
	 * @param {number} options.cache.capacity
	 * @param {number} options.cache.maxLength
	 */
	constructor(
		mode,
		externalConfig = {
			url: ExternalTranslator.DEFAULT_URL,
			method: ExternalTranslator.DEFAULT_METHOD,
			responseStyle: ExternalTranslator.DEFAULT_RESPONSE_STYLE,
		},
		{ cache = { capacity: 100, maxLength: 10 } } = {}
	) {
		this.mode = mode;
		this.externalConfig = externalConfig;
		this.#cache = new TranslationCache(cache.capacity);
		this.options = { cache };
	}

	/**
	 * Translates text from the source language to the target language asynchronously.
	 * @param {string} text text to be translated
	 * @param {string} tl target language
	 * @param {string} sl source language
	 * @returns {Promise<TranslationResult>} promise of translation result
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
			const availability = await Translator.availability(options);
			if (availability === 'available') {
				const translator = await Translator.create(options);
				this.#translators.set(key, translator);
				return {
					sentence: await translator.translate(text),
					src: sl,
				};
			} else {
				logger.warn(`Built-in translator is fallbacked to external one because language model [${sl} to ${tl}] is not enabled yet (${availability} now).`);
				if (availability === 'downloading') skip = true;
			}
		}
		translator = new ExternalTranslator(this.externalConfig, options);
		if (!skip) this.#translators.set(key, translator);

		/** @type {Promise<TranslationResult>} */
		const req = translator.translate(text)
		.then(sentence => ({ sentence, src: /** @type {ExternalTranslator} */ (translator).lastSrc }))
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


export class ExternalTranslator {
	/** @readonly */
	static DEFAULT_URL = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&dt=bd&dj=1&q=$q';
	/** @readonly */
	static DEFAULT_METHOD = 'GET';
	/** @readonly */
	static DEFAULT_RESPONSE_STYLE = 'Google';
	static DEFAULT_SYSTEM_PROMPT = [
		'You are a translation API. Translate the input text into $tl and return ONLY a single JSON object.',
		'Do not include any markdown formatting, backticks, or explanations.',
		'Expected format:',
		'{ "sentence": "translated text", "src": "source language code (ISO 639-1)" }',
	].join('\n');
	static languageNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

	/** @type {URL} */ url;
	/** @type {RequestInit} */ reqInit;
	/** @type {string} */ responseStyle;
	/** @type {?string} */ #query = null;
	/** @type {?string} */ #json = null;
	/** @type {string} */ lastSrc = 'und';

	/**
	 * @param {ExternalTranslatorGetConfig | ExternalTranslatorPostConfig} config
	 * @param {TranslatorCreateCoreOptions} options
	 */
	constructor(config, options) {
		const { url, method, responseStyle } = config;
		this.reqInit = { method };
		this.responseStyle = responseStyle;
		switch (method) {
			case 'GET':
				try {
					this.url = this.#initGet({ url }, options);
					if (!this.#query) throw `Translator URL has no $q token: ${url}`;
				} catch (cause) {
					logger.error(cause);
					this.url = this.#initGet({ url: ExternalTranslator.DEFAULT_URL }, options);
				}
				break;
			case 'POST':
				this.url = this.#initPost(config, options);
				break;
		}
	}

	/**
	 * @param {Omit<ExternalTranslatorGetConfig, "method" | "responseStyle">} req
	 * @param {TranslatorCreateCoreOptions} options
	 */
	#initGet(req, { sourceLanguage: sl, targetLanguage: tl }) {
		const url = new URL(req.url);
		const p = url.searchParams;
		for (const [k, v] of p) {
			if (v === '$sl') p.set(k, sl);
			else if (v === '$tl') p.set(k, tl);
			else if (v === '$q') this.#query = k;
		}
		return url;
	}

	/**
	 * @param {Omit<ExternalTranslatorPostConfig, "method" | "responseStyle">} req
	 * @param {TranslatorCreateCoreOptions} options
	 */
	#initPost(req, { sourceLanguage, targetLanguage }) {
		this.reqInit.headers = new Headers();
		if (req.apiKey) this.reqInit.headers.set('Authorization', `Bearer ${req.apiKey}`);
		this.reqInit.headers.set('Content-Type', 'application/json');

		const [sl, tl] = [sourceLanguage, targetLanguage].map(v => {
			try {
				return ExternalTranslator.languageNames.of(v);
			} catch {
				return null;
			}
		});
		if (!tl) throw new Error(`Failed to determine target language: ${targetLanguage}`);
		this.#json = (req.json ?? JSON.stringify({
			model: req.modelName,
			messages: [
				{ role: 'system', content: ExternalTranslator.DEFAULT_SYSTEM_PROMPT },
				{ role: 'user', content: '$q' },
			],
			reasoning: { effort: 'none' },
			response_format: { type: 'json_object' },
			temperature: 0,
		})).replace(/\$sl/g, sl ?? 'undetermined language').replace(/\$tl/g, tl);
		return new URL(req.url);
	}

	/**
	 * @param {string} text source message
	 */
	async translate(text) {
		/** @type {Request} */
		let req;
		if (this.#json) {
			this.reqInit.body = this.#json.replace(/\$q/g, text);
			req = new Request(this.url, this.reqInit);
		} else {
			const url = new URL(this.url);
			if (this.#query) url.searchParams.set(this.#query, text);
			req = new Request(url);
		}
		const res = await fetch(req).then(res => {
			if (res.ok) return res.json();
			else throw new Error(`Fetch Error: ${res.status} ${res.statusText}`);
		}).catch(logger.warn);

		/** @type {string | undefined} */
		let result;
		switch (this.responseStyle) {
			case 'Google': {
				/** @type { { sentences?: { trans?: string }[], src?: string }? } */
				const json = res;
				this.lastSrc = json?.src || 'und';
				result = json?.sentences?.map?.(s => s.trans)?.join('');
				break;
			}
			case 'OpenAI': {
				/** @type { { choices?: { message?: { content?: string } }[] }? } */
				const json = res;
				const content = JSON.parse(json?.choices?.at?.(0)?.message?.content ?? '{}');
				this.lastSrc = content?.src || 'und';
				result = content?.sentence;
				break;
			}
		}
		if (!result) logger.warn(`No result from translator:`, this.url.href, res);
		return result || text;
	}

	destroy() {}
}
