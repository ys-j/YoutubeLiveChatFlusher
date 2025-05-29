/// <reference path="../browser.d.ts" />

self.browser ??= chrome;

const manifest = browser.runtime.getManifest();

const events = {
	/**
	 * @param {number} tabId 
	 * @param {string} url
	 */
	async toggleAction(tabId, url) {
		const urlObj = new URL(url);
		/** @type {string[] | undefined} */
		const hosts = manifest.host_permissions;
		const isHostMatch = hosts?.some(url => url.match(/:\/\/([^\/]*)/)?.[1] === urlObj.hostname);
		return browser.action[isHostMatch ? 'enable' : 'disable'](tabId);
	},
	async reload() {
		const ytTabs = await browser.tabs.query({ url: manifest.host_permissions });
		for (const tab of ytTabs) browser.tabs.reload(tab.id, { bypassCache: true });
	},
	async openOptions() {
		return browser.runtime.openOptionsPage();
	},
};

browser.action.onClicked.addListener(() => {
	events.openOptions();
});

browser.runtime.onMessage.addListener(async (message, sender, response) => {
	events[message.fire]?.()?.then(response);
});

browser.tabs.onUpdated.addListener((tabId, info, tab) => {
	if (info.url) events.toggleAction(tabId, info.url);
});
browser.tabs.onCreated.addListener(tab => {
	if (tab.url) events.toggleAction(tab.id, tab.url);
});