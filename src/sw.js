import { logger } from './modules/logging.mjs';
import { store } from './modules/store.mjs';

import { LanguageDetectionController, TranslatorController } from './modules/translator.mjs';
import { MLEngineManager } from './modules/ml_engine.mjs';

// @ts-expect-error
self.browser ??= chrome;

const loadingStore = store.load();

const manifest = browser.runtime.getManifest();

const events = {
	async reload() {
		browser.runtime.reload();
	},
	async reloadTabs() {
		const tabs = await browser.tabs.query({ url: manifest.host_permissions });
		return Promise.allSettled(tabs.map(tab => browser.tabs.reload(tab.id, { bypassCache: true })));
	},
	async openOptions() {
		return browser.runtime.openOptionsPage();
	},

	/**
	 * Sends an installation notification to the user.
	 * @param {import("webextension-polyfill").Runtime.OnInstalledReason} reason
	 */
	async notify(reason) {
		const canNofify = await browser.permissions.contains({ permissions: ['notifications'] });
		if (!canNofify) return;

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
	if (
		reason !== 'browser_update'
		&& previousVersion !== manifest.version
		&& (await loadingStore).others.notification_updated
	) {
		await events.notify(reason);
	} else {
		await events.reloadTabs();
	}
});

const detector = new LanguageDetectionController();

/** @type {?TranslatorController} */
let translationController = null;

/** @type {?MLEngineManager} */
let personDetectionEngine = null;

const performanceLogger = {
	buffer: new Uint32Array(100),
	offset: 0,
	/** @param {number} v */
	write(v) {
		if (this.offset >= this.buffer.length) {
			this.offset = 0;
			logger.info('Average inference time (over 100 runs):', this.avarage(), 'ms');
		}
		this.buffer[this.offset++] = v;
	},
	avarage() {
		let sum = 0, count = 0;
		for (const v of this.buffer) {
			if (v > 0) {
				sum += v;
				count++;
			}
		}
		return sum / count;
	},
};

loadingStore.then(async s => {
	const {
		translator, url, method, responseStyle,
		apiKey, modelName, bodyType, bodyContent,
	} = /** @type {typeof import("./modules/store.mjs").DEFAULT_CONFIG.translation} */ (s.translation);
	const config = method === 'GET'
		? { url, method, responseStyle }
		: { url, method, responseStyle, apiKey, modelName, json: bodyType === 'OpenAI' ? undefined : bodyContent };

	translationController = new TranslatorController(translator ?? 'internal', config);

	const { device, backend } = /** @type {typeof import("./modules/store.mjs").DEFAULT_CONFIG.personDetection} */ (s.personDetection);
	if (!device || !manifest.optional_permissions?.includes('trialML')) return;

	const granted = await browser.permissions.contains({ permissions: ['trialML'] });
	if (granted) {
		personDetectionEngine = new MLEngineManager({
			modelHub: 'huggingface',
			taskName: 'image-segmentation',
			modelId: 'onnx-community/mediapipe_selfie_segmentation_landscape',
			device,
			dtype: device === 'gpu' ? 'fp32' : 'q8',
			backend,
		});
		await personDetectionEngine.ensureReady();
	} else {
		logger.warn('Permission "trialML" was rejected.');
		s.personDetection.device = '';
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
		const startTime = performance.now();
		personDetectionEngine?.run({ args: [ blob ] })
		.then(respond, err => {
			logger.warn(err?.message ?? err);
			const mask = { data: new Uint8Array(width * height), width, height, channel: 1 };
			respond([ { label: null, score: null, mask } ]);
		})
		.finally(() => performanceLogger.write(performance.now() - startTime));
	} else if ('fire' in msg) {
		const eventType = /** @type {"reload" | "reloadTabs" | "openOptions"} */ (msg.fire);
		events[eventType]().then(respond);
	} else if ('request' in msg) {
		/** @type { { url: string, options?: RequestInit } } */
		const { url, options } = msg.request;
		try {
			if (new URL(url).protocol !== 'https:') return;
		} catch {
			return;
		}
		fetch(url, options)
		.then(res => res.text())
		.then(respond);
	}
	return true;
});
