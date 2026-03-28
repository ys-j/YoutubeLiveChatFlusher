/// <reference path="../types/browser.d.ts" />
/// <reference path="../types/extends.d.ts" />

self.browser ??= chrome;

const manifest = browser.runtime.getManifest();

/** @type {Record<string, Function>} */
const events = {
	/**
	 * @param {number} tabId 
	 * @param {string} url
	 */
	async toggleAction(tabId, url) {
		const urlObj = new URL(url);
		/** @type {string[] | undefined} */
		const hosts = manifest.host_permissions;
		const isHostMatch = hosts?.some(url => url.match(/:\/\/([^/]*)/)?.[1] === urlObj.hostname);
		return browser.action[isHostMatch ? 'enable' : 'disable'](tabId);
	},
	async reload() {
		browser.runtime.reload();
	},
	async openOptions() {
		return browser.runtime.openOptionsPage();
	},
};

browser.action.onClicked.addListener(() => {
	events.openOptions();
});

browser.tabs.onUpdated.addListener((tabId, info, _tab) => {
	if (info.url) events.toggleAction(tabId, info.url);
});
browser.tabs.onCreated.addListener(tab => {
	if (tab.url) events.toggleAction(tab.id, tab.url);
});

/** @type {TranslatorController?} */
let translationController = null;

browser.runtime.onMessage.addListener((message, _sender, respond) => {
	if ('translation' in message) {
		/** @type {Record<string, string>} */
		const { text, source, target: tl } = message.translation;
		(
			source
			? Promise.resolve(source)
			: browser.i18n.detectLanguage(text).then(d => d.isReliable && d.languages.at(0)?.language || 'auto')
		)
		.then(sl => translationController?.translate(text, tl, sl))
		.then(respond);
	} else if ('fire' in message) {
		events[message.fire]?.()?.then(respond);
	}
	return true;
});


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
		const json = await fetch(this.url).then(res => res.json());
		this.lastSrc = json?.src || 'und';
		return json?.sentences.map(s => s.trans).join('') || text;
	}

	destroy() {}
}

class TranslatorController {
	/** @type {Map<string, TranslatorSession | ExternalTranslatorSession>} */
	#map = new Map();

	/**
	 * @param {"internal" | "external"} mode translator mode 
	 * @param {string} [url] external URL
	 */
	constructor(mode, url) {
		this.mode = mode;
		this.url = url ?? ExternalTranslatorSession.DEFAULT_URL;
	}

	/**
	 * @param {string} text text to be translated
	 * @param {string} tl target language
	 * @param {string} sl source language
	 */
	async translate(text, tl, sl = 'auto') {
		const options = {
			sourceLanguage: sl,
			targetLanguage: tl,
		};
		const key = `${sl},${tl}`;
		let translator = this.#map.get(key);
		if (translator) {
			const sentence = await translator.translate(text);
			const src = sl === 'auto' && 'lastSrc' in translator ? translator.lastSrc : sl;
			return { sentence, src };
		}

		let skip = false;
		if (this.mode === 'internal' && sl !== 'auto' && 'Translator' in self) {
			const availability = await self.Translator.availability(options);
			if (availability === 'available') {
				const translator = await self.Translator.create(options);
				this.#map.set(key, translator);
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
		if (!skip) this.#map.set(key, translator);
		const sentence = await translator.translate(text);
		return {
			sentence,
			// @ts-expect-error
			src: translator.lastSrc,
		};
	}
}

browser.storage.local.get('translation').then(s => {
	/** @type {typeof import("./modules/store.mjs").DEFAULT_CONFIG.translation} */
	const { translator, url } = s.translation;
	translationController = new TranslatorController(/** @type {"internal" | "external"} */ (translator ?? 'internal'), url);
});