import { logger } from './modules/logging.mjs';
import { LanguageDetectionController, TranslatorController } from './modules/translator.mjs';
import { MLEngineManager } from './modules/ml_engine.mjs';

// @ts-expect-error
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

const detector = new LanguageDetectionController();

/** @type {?TranslatorController} */
let translationController = null;

/** @type {?MLEngineManager} */
let personDetectionEngine = null;

browser.storage.local.get(['translation', 'others']).then(async s => {
	const { translator, url } = /** @type {typeof import("./modules/store.mjs").DEFAULT_CONFIG.translation} */ (s.translation);
	translationController = new TranslatorController(translator ?? 'internal', url);
	
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
				modelId: 'onnx-community/mediapipe_selfie_segmentation',
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
		const { mask, width = 256, height = 256 } = msg;
		personDetectionEngine?.run({ args: [ mask ] })
		.then(respond, err => {
			logger.warn(err?.message ?? err);
			respond([
				{
					label: null,
					score: null,
					mask: { data: new Uint8ClampedArray(width * height), width, height, channel: 1 },
				}
			]);
		});
	} else if ('fire' in msg) {
		events[msg.fire]?.()?.then(respond);
	}
	return true;
});
