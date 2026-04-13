/// <reference path="../types/browser.d.ts" />
/// <reference path="../types/extends.d.ts" />

import { TranslatorController } from './modules/translator.mjs';

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

browser.storage.local.get('translation').then(s => {
	/** @type {typeof import("./modules/store.mjs").DEFAULT_CONFIG.translation} */
	const { translator, url } = s.translation;
	translationController = new TranslatorController(/** @type {"internal" | "external"} */ (translator ?? 'internal'), url);
});

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
