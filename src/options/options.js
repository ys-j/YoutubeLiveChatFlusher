/// <reference path="../../types/browser.d.ts" />

import { store as s } from '../modules/store.mjs';

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
	const a = document.createElement('a');
	const blob = new Blob([ JSON.stringify(s.data) ], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	a.download = `ytlcf-config-${Date.now()}.json`;
	a.href = url;
	a.click();
}, { passive: true });

const importBtn = document.getElementById('btn-import');
importBtn?.addEventListener('click', async () => {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'application/json';
	input.addEventListener('cancel', () => {
		console.log('Config file import is canceled.');
	}, { passive: true });
	input.addEventListener('change', () => {
		const files = input.files;
		if (files && files.length > 0) {
			console.log('Config file selected: ' + files[0].name);
			const reader = new FileReader();
			reader.onload = async e => {
				const json = JSON.parse(/** @type {string} */ (e.target?.result));
				await s.load(json);
				await browser.storage.local.set(s.data);
				browser.runtime.sendMessage({ fire: 'reload' });
			};
			reader.readAsText(files[0]);
		}
	}, { passive: true });
	input.click();
}, { passive: true });

const initBtn = document.getElementById('btn-init');
initBtn?.addEventListener('click', async () => {
	await s.reset();
	browser.runtime.sendMessage({ fire: 'reload' });
	location.reload();
}, { passive: true });

const saveBtn = /** @type {HTMLButtonElement?} */ (document.getElementById('btn-save'));

const form = document.forms[0];

/** @type {Record<string, HTMLInputElement | HTMLSelectElement | RadioNodeList>} */ // @ts-ignore
const {
	mode_livestream,
	mode_replay,
	hotkey_layer,
	hotkey_panel,
	autostart,
	message_pause,
	translation_blacklist_regexp,
	translation_blacklist,
	translation_url
} = form.elements;

s.load().then(() => {
	// mode
	mode_livestream.value = s.others.mode_livestream.toString();
	mode_replay.value = s.others.mode_replay.toString();

	// autostart
	autostart.value = s.others.autostart.toString();

	// message pause
	message_pause.value = s.others.message_pause.toString();

	// hotkeys
	hotkey_layer.value = s.hotkeys.layer;
	hotkey_panel.value = s.hotkeys.panel;

	// translation
	/** @type {HTMLInputElement} */
	(translation_blacklist_regexp).checked = s.translation.regexp;
	translation_blacklist.value = s.translation.plainList.join('\n');
	translation_url.value = s.translation.url;
});

const status = document.getElementById('status');
form.addEventListener('change', () => {
	if (saveBtn) saveBtn.disabled = false;
	if (status) status.hidden = false;
});

form.addEventListener('submit', async e => {
	e.preventDefault();
	const config = {
		/** @type {Partial<typeof s.data.others>} */
		others: {
			mode_livestream: Number.parseInt(mode_livestream.value),
			mode_replay: Number.parseInt(mode_replay.value),
			autostart: Number.parseInt(autostart.value),
			message_pause: Number.parseInt(message_pause.value),
		},
		/** @type {Partial<typeof s.data.hotkeys>} */
		hotkeys: {
			layer: hotkey_layer.value,
			panel: hotkey_panel.value,
		},
		/** @type {Partial<typeof s.data.translation>} */
		translation: {
			regexp: /** @type {HTMLInputElement} */ (translation_blacklist_regexp).checked,
			plainList: translation_blacklist.value.split(/\n+/).filter(s => s.length > 0),
			url: translation_url.value,
		},
	};
	await s.load(config);
	await browser.storage.local.set(s.data);
	if (status) status.hidden = true;
	await browser.runtime.sendMessage({ fire: 'reload' });
});