import { logger } from '../modules/logging.mjs';
import { DEFAULT_CONFIG, store as s } from '../modules/store.mjs';

import { TranslatorController } from '../modules/translator.mjs';

// @ts-expect-error
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
	// @ts-expect-error
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
		logger.debug('Config file import is canceled.');
	}, { passive: true });
	input.addEventListener('change', () => {
		const files = input.files;
		if (files && files.length > 0) {
			logger.debug('Config file selected:', files[0].name);
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
	await browser.runtime.sendMessage({ fire: 'reload' });
	location.reload();
}, { passive: true });

const saveBtn = /** @type {?HTMLButtonElement} */ (document.getElementById('btn-save'));

const [form, tester] = document.forms;

/** @type {Record<string, RadioNodeList>} */
// @ts-expect-error
const {
	mode_livestream, mode_replay,
	autostart,
	message_pause,
	person_detection,
	translation_method,
	translation_bodyType,
	translation_responseStyle,
} = form.elements;

/** @type {Record<string, HTMLInputElement>} */
// @ts-expect-error
const {
	hotkey_layer_key, hotkey_layer_alt,
	hotkey_panel_key, hotkey_panel_alt,
	hotkey_pip_key, hotkey_pip_alt,
	translation_blacklist_regexp,
	translation_url, translation_apiKey, translation_modelName,
} = form.elements;

/** @type {Record<string, HTMLSelectElement>} */
// @ts-expect-error
const { translation_translator } = form.elements;

/** @type {Record<string, HTMLTextAreaElement>} */
// @ts-expect-error
const {
	translation_blacklist,
	translation_bodyContent,
} = form.elements;

function updateTranslationControls() {
	const isPostMethod = translation_method.value === 'POST';
	const isCustomBody = translation_bodyType.value === 'custom';
	translation_apiKey.disabled = translation_modelName.disabled = !isPostMethod;
	translation_apiKey.required = translation_modelName.required = !isCustomBody;
	translation_bodyContent.disabled = translation_bodyContent.hidden = !isPostMethod || !isCustomBody;
}

s.load().then(() => {
	// mode
	mode_livestream.value = s.others.mode_livestream.toString();
	mode_replay.value = s.others.mode_replay.toString();

	// autostart
	autostart.value = s.others.autostart.toString();

	// hotkeys
	hotkey_layer_key.value = s.hotkeys.layer.key ?? s.hotkeys.layer;
	hotkey_layer_alt.checked = s.hotkeys.layer.alt;
	hotkey_panel_key.value = s.hotkeys.panel.key ?? s.hotkeys.panel;
	hotkey_panel_alt.checked = s.hotkeys.panel.alt;
	hotkey_pip_key.value = s.hotkeys.pip.key;
	hotkey_pip_alt.checked = s.hotkeys.pip.alt;

	// message pause
	message_pause.value = s.others.message_pause.toString();

	// person detection
	person_detection.value = s.others.person_detection.toString();

	// translation
	/** @type {HTMLInputElement} */
	(translation_blacklist_regexp).checked = s.translation.regexp;
	translation_blacklist.value = s.translation.plainList.join('\n');
	translation_translator.value = s.translation.translator;
	translation_method.value = s.translation.method;
	translation_url.value = s.translation.url;
	translation_bodyType.value = s.translation.bodyType;
	translation_apiKey.value = s.translation.apiKey;
	translation_modelName.value = s.translation.modelName;
	updateTranslationControls();
	translation_bodyContent.value = s.translation.bodyContent;
	translation_responseStyle.value = s.translation.responseStyle;

	for (const el of form.querySelectorAll('[data-when-method="POST"]')) {
		/** @type {HTMLElement} */ (el).hidden = s.translation.method !== 'POST';
	}
});

const status = document.getElementById('status');
form.addEventListener('change', e => {
	if (/** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */ (e.target).form !== form) return;
	if (saveBtn) saveBtn.disabled = false;
	if (status) status.hidden = false;
	updateTranslationControls();
	if (!translation_bodyContent.disabled) {
		translation_bodyContent.setCustomValidity((v => {
			try {
				const json = JSON.parse(v || '{}');
				if (typeof json !== 'object' || json === null) throw json;
				else return '';
			} catch {
				return browser.i18n.getMessage('translation_invalidRequestBody');
			}
		})(translation_bodyContent.value));
	}
	for (const el of form.querySelectorAll('[data-when-method="POST"]')) {
		/** @type {HTMLElement} */ (el).hidden = translation_method.value !== 'POST';
	}
});

form.addEventListener('submit', async e => {
	e.preventDefault();
	if (Number.parseInt(person_detection.value, 10) > 0) {
		/** @type { { permissions: ["trialML"] } } */
		const permission = { permissions: ['trialML'] };
		const granted = await browser.permissions.request(permission);
		if (!granted) person_detection.value = '0';
	}

	const config = {
		/** @type {Partial<typeof s.data.others>} */
		others: {
			// @ts-expect-error
			mode_livestream: Number.parseInt(mode_livestream.value, 10),
			// @ts-expect-error
			mode_replay: Number.parseInt(mode_replay.value, 10),
			autostart: Number.parseInt(autostart.value, 10),
			message_pause: Number.parseInt(message_pause.value, 10),
			person_detection: Number.parseInt(person_detection.value, 10),
		},
		/** @type {Partial<typeof s.data.hotkeys>} */
		hotkeys: {
			layer: { key: hotkey_layer_key.value, alt: hotkey_layer_alt.checked },
			panel: { key: hotkey_panel_key.value, alt: hotkey_panel_alt.checked },
			pip: { key: hotkey_pip_key.value, alt: hotkey_pip_alt.checked },
		},
		/** @type {Partial<typeof s.data.translation>} */
		translation: {
			regexp: /** @type {HTMLInputElement} */ (translation_blacklist_regexp).checked,
			plainList: translation_blacklist.value.split(/\n+/).filter(s => s.length > 0),
			translator: /** @type {"external" | "internal"} */ (translation_translator.value),
			method: /** @type {"GET" | "POST"} */ (translation_method.value),
			url: translation_url.value,
			bodyType: /** @type {typeof s.translation.bodyType} */ (translation_bodyType.value),
			apiKey: translation_apiKey.value,
			modelName: translation_modelName.value,
			bodyContent: translation_bodyContent.value,
			responseStyle: /** @type {typeof s.translation.responseStyle} */ (translation_responseStyle.value),
		},
	};
	await s.load(config);
	await browser.storage.local.set(s.data);
	if (status) status.hidden = true;
	await browser.runtime.sendMessage({ fire: 'reload' });
});

tester.addEventListener('submit', e => {
	e.preventDefault();
	const test_translation_text = /** @type {HTMLInputElement} */ (tester.elements.test_translation_text);
	if (!test_translation_text.value.trim()) return;

	const test_translation_output = /** @type {HTMLOutputElement} */ (tester.elements.test_translation_output);
	const btn = /** @type {?HTMLButtonElement} */ (document.getElementById('btn-test-translation'));

	const mode = /** @type {typeof s.data.translation.translator} */ (translation_translator.value);
	const config = /** @type {typeof s.data.translation.method} */ (translation_method.value) === 'GET'
		? {
			url: translation_url.value,
			method: /** @type {const} */ ('GET'),
			responseStyle: /** @type {typeof s.data.translation.responseStyle} */ (translation_responseStyle.value),
		} : {
			url: translation_url.value,
			method: /** @type {const} */ ('POST'),
			responseStyle: /** @type {typeof s.data.translation.responseStyle} */ (translation_responseStyle.value),
			apiKey: translation_apiKey.value,
			modelName: translation_modelName.value,
			json: translation_bodyType.value === 'OpenAI' ? undefined : translation_bodyContent.value,
		};

	const controller = new TranslatorController(mode, config);

	test_translation_output.value = '';
	const timer = setInterval(() => {
		test_translation_output.value += '.';
	}, 1000);
	if (btn) btn.disabled = true;

	controller.translate(test_translation_text.value, navigator.language)
	.then(res => {
		test_translation_output.value = JSON.stringify(res);
	})
	.catch(err => {
		logger.error(err);
		test_translation_output.value = Error.isError(err) && err.stack || String(err);
	})
	.finally(() => {
		clearInterval(timer);
		if (btn) btn.disabled = false;
	});
});

document.getElementById('btn-reset-translation')?.addEventListener('click', () => {
	translation_method.value = DEFAULT_CONFIG.translation.method;
	translation_url.value = DEFAULT_CONFIG.translation.url;
	translation_responseStyle.value = DEFAULT_CONFIG.translation.responseStyle;
	translation_url.dispatchEvent(new Event('change', { bubbles: true }));
});
