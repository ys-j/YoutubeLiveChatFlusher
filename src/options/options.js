/// <reference path="../../browser.d.ts" />

import { Storage } from '../modules/utils.js';

// @ts-ignore
self.browser ??= chrome;
const manifest = browser.runtime.getManifest();
document.documentElement.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

/** @type {NodeListOf<HTMLElement>} */
const i18nElems = document.querySelectorAll('[data-i18n]');
for (const el of i18nElems) {
	const key = el.dataset.i18n;
	if (key) {
		const msg = browser.i18n.getMessage(key);
		if (msg) el.textContent = msg;
	}
}
/** @type {NodeListOf<HTMLInputElement | HTMLTextAreaElement>} */
const i18nPlaceholders = document.querySelectorAll('[data-i18n-placeholder]');
for (const el of i18nPlaceholders) {
	const key = el.dataset.i18nPlaceholder;
	if (key) {
		const msg = browser.i18n.getMessage(key);
		if (msg) el.placeholder = msg;
	}
}

/** @type {NodeListOf<HTMLElement>} */
const manifestElems = document.querySelectorAll('[data-manifest]');
for (const el of manifestElems) {
	const key = el.dataset.manifest;
	if (key && key in manifest) el.textContent = manifest[key];
}

const exportBtn = document.getElementById('btn-export');
exportBtn?.addEventListener('click', () => {
	Storage.export();
}, { passive: true });

const importBtn = document.getElementById('btn-import');
importBtn?.addEventListener('click', async () => {
	await Storage.import();
	location.reload();
}, { passive: true });

const initBtn = document.getElementById('btn-init');
initBtn?.addEventListener('click', async () => {
	await Storage.init();
	location.reload();
}, { passive: true });

const saveBtn = /** @type {HTMLButtonElement?} */ (document.getElementById('btn-save'));

const form = document.forms.namedItem('form');
if (form) {
	const controls = form.elements;
	const config = structuredClone(Storage.DEFAULT);
	const storage = await Storage.get(['others', 'hotkeys', 'translation']);
	for (const k of Object.keys(config)) {
		Object.assign(config[k], storage[k]);
	}
	/** @type {Record<string, HTMLInputElement | HTMLSelectElement | RadioNodeList>} */ //@ts-ignore
	const {
		mode_livestream,
		mode_replay,
		hotkey_layer,
		hotkey_panel,
		autostart,
		translation_blacklist_regexp,
		translation_blacklist,
		translation_url
	} = controls;

	// mode
	mode_livestream.value = config.others.mode_livestream.toString();
	mode_replay.value = config.others.mode_replay.toString();

	// autostart
	autostart.value = config.others.autostart.toString();
	
	// hotkeys
	hotkey_layer.value = config.hotkeys.layer;
	hotkey_panel.value = config.hotkeys.panel;

	// translation
	/** @type {HTMLInputElement} */
	(translation_blacklist_regexp).checked = config.translation.regexp;
	translation_blacklist.value = config.translation.plainList.join('\n');
	translation_url.value = config.translation.url;

	const status = document.getElementById('status');
	form.addEventListener('change', () => {
		if (saveBtn) saveBtn.disabled = false;
		if (status) status.hidden = false;
	});
	
	form.addEventListener('submit', async e => {
		e.preventDefault();
		const store = await Storage.get();
		console.log(store);
		store.others.mode_livestream = Number.parseInt(mode_livestream.value);
		store.others.mode_replay = Number.parseInt(mode_replay.value);
		store.others.autostart = Number.parseInt(autostart.value);
		store.hotkeys.layer = hotkey_layer.value;
		store.hotkeys.panel = hotkey_panel.value;
		store.translation.regexp = /** @type {HTMLInputElement} */ (translation_blacklist_regexp).checked;
		store.translation.plainList = translation_blacklist.value.split(/\n+/).filter(s => s.length > 0);
		store.translation.url = translation_url.value;
		await Storage.set(store);
		if (status) status.hidden = true;
		browser.runtime.sendMessage({ fire: 'reload' });
	}, { passive: false });
}