import { logger } from './modules/logging.mjs';
import { store } from './modules/store.mjs';

import { LanguageDetectionController, TranslatorController } from './modules/translator.mjs';
import { MLEngineManager } from './modules/ml_engine.mjs';

// @ts-expect-error
self.browser ??= chrome;

const loadingStore = store.load();

const manifest = browser.runtime.getManifest();
const hosts = manifest.host_permissions;

const events = {
	async reload() {
		browser.runtime.reload();
	},
	async reloadTabs() {
		const tabs = await browser.tabs.query({ url: hosts });
		await Promise.all(tabs.map(tab => browser.tabs.reload(tab.id)));
	},
	async openOptions() {
		return browser.runtime.openOptionsPage();
	},

	/**
	 * Sends an installation notification to the user.
	 * @param {import("webextension-polyfill").Runtime.OnInstalledReason} reason
	 */
	async notify(reason) {
		/** @type {(str: string) => string} */
		const toUpperCamel = str => str.toLowerCase().replace(/(?:^|_+)(\w)/g, (_, m) => m.toUpperCase());
		const id = await browser.notifications.create({
			type: 'basic',
			title: manifest.name,
			iconUrl: manifest.icons?.['128'],
			message: browser.i18n.getMessage(`notification_title_on${toUpperCamel(reason)}`, [manifest.version]),
		});
		browser.notifications.onClicked.addListener((notificationId) => {
			if (notificationId === id) events.reloadTabs();
		});
	},
};

browser.action.onClicked.addListener(() => {
	events.openOptions();
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
	const tab = await browser.tabs.get(tabId);
	await browser.action[tab.url ? 'enable' : 'disable'](tabId);
});
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status !== 'complete') return;
	await browser.action[tab.active && tab.url ? 'enable' : 'disable'](tabId);
});

browser.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
	if (reason === 'browser_update') return;
	if (previousVersion === manifest.version) return;
	const s = await loadingStore;
	if (s.others.notification) events.notify(reason);
});

const detector = new LanguageDetectionController();

/** @type {?TranslatorController} */
let translationController = null;

/** @type {?MLEngineManager} */
let personDetectionEngine = null;

loadingStore.then(async s => {
	const {
		translator, url, method, responseStyle,
		apiKey, modelName, bodyType, bodyContent,
	} = /** @type {typeof import("./modules/store.mjs").DEFAULT_CONFIG.translation} */ (s.translation);
	const config = method === 'GET'
		? { url, method, responseStyle }
		: { url, method, responseStyle, apiKey, modelName, json: bodyType === 'OpenAI' ? undefined : bodyContent };

	translationController = new TranslatorController(translator ?? 'internal', config);

	const { person_detection } = /** @type {typeof import("./modules/store.mjs").DEFAULT_CONFIG.others} */ (s.others);
	const engineOption = /** @type {const} */ ([
		undefined,
		{ dtype: 'q8', device: 'wasm' },
		{ dtype: 'fp32', device: 'gpu' },
	]).at(person_detection);
	if (engineOption && manifest.optional_permissions?.includes('trialML')) {
		const granted = await browser.permissions.contains({ permissions: ['trialML'] });
		if (granted) {
			personDetectionEngine = new MLEngineManager({
				modelHub: 'huggingface',
				taskName: 'image-segmentation',
				modelId: 'onnx-community/mediapipe_selfie_segmentation_landscape',
				...engineOption,
			});
			await personDetectionEngine.ensureReady();
		} else {
			logger.warn('Permission "trialML" was rejected.');
		}
	}
});

browser.runtime.onMessage.addListener((_message, _sender, respond) => {
	const msg = /** @type {Record<string, any>} */ (_message);
	if ('detection' in msg) {
		/** @type {Record<string, string>} */
		const { text } = msg.detection;
		(detector.isReady ? Promise.resolve() : detector.ready())
		.then(() => detector.detect(text))
		.then(respond);
	} else if ('translation' in msg) {
		/** @type {Record<string, string>} */
		const { text, source, target: tl } = msg.translation;
		(
			source
			? Promise.resolve(source)
			: detector.detect(text).then(d => d.isReliable && d.source || 'auto')
		)
		.then(sl => translationController?.translate(text, tl, sl))
		.then(respond);
	} else if ('mask' in msg && personDetectionEngine) {
		const { mask: blob, width = 256, height = 144 } = msg;
		console.time('personDetectionEngine.run');
		personDetectionEngine?.run({ args: [ blob ] })
		.then(respond, err => {
			logger.warn(err?.message ?? err);
			const mask = { data: new Uint8ClampedArray(width * height), width, height, channel: 1 };
			respond([ { label: null, score: null, mask } ]);
		})
		.finally(() => console.timeEnd('personDetectionEngine.run'));
	} else if ('fire' in msg) {
		const eventType = /** @type {"reload"} */ (msg.fire);
		events[eventType]?.()?.then(respond);
	}
	return true;
});
