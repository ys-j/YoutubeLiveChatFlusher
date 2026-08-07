import { logger } from './modules/logging.mjs';
import { store } from './modules/store.mjs';

import init from './injections/init.mjs';
import initPip from './injections/pip.mjs';

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
		const tabs = await browser.tabs.query({
			discarded: false,
			url: manifest.host_permissions,
		});
		return Promise.allSettled(tabs.map(tab => browser.tabs.reload(tab.id, { bypassCache: true })));
	},
	async openOptions() {
		return browser.runtime.openOptionsPage();
	},

	/**
	 * Sends an installation notification to the user.
	 * @param {"install" | "update" | "reload"} reason
	 */
	async notify(reason) {
		const canNotify = await browser.permissions.contains({ permissions: ['notifications'] });
		if (!canNotify) return;

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

	/**
	 * Returns the nonce for the given tab ID.
	 * @param {number} [tabId]
	 * @returns {Promise<string>}
	 */
	async getNonce(tabId = -1) {
		const key = `nonce:${tabId}`;
		const store = await browser.storage.session.get(key);
		const nonce = store?.[key];
		if (typeof nonce === 'string') return nonce;
		else throw 'Nonce not found';
	}
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
browser.tabs.onRemoved.addListener(async tabId => {
	await browser.storage.session.remove(`nonce:${tabId}`);
});

browser.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
	if (
		reason !== 'browser_update'
		&& (await loadingStore).others.notification_updated
	) {
		const isSameVersion = previousVersion === manifest.version;
		await events.notify(isSameVersion ? 'reload' : reason);
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
	sum: 0,
	/** @param {number} v */
	write(v) {
		this.buffer[this.offset++] = v;
		this.sum += v;
		if (this.offset >= this.buffer.length) {
			logger.info('Average inference time (over 100 runs):', this.sum / this.buffer.length, 'ms');
			this.offset = 0;
			this.sum = 0;
		}
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

/** @import { YTLCFMessage } from "../types/messaging.d.ts" */
// @ts-expect-error
browser.runtime.onMessage.addListener((/** @type {YTLCFMessage.Request.Any} */ msg, sender, respond) => {
	const tabId = sender.tab?.id;
	/** @type {(err: unknown) => void} */
	const handleError = err => {
		logger.error(err);
		if (Error.isError(err)) {
			const { name, message } = err;
			respond({ error: { name, message } })
		} else {
			respond({ error: { message: `${err}` } });
		}
	};

	if ('injection' in msg && tabId) {
		const target = { tabId };
		const loggingPath = browser.runtime.getURL('./modules/logging.mjs');
		switch (msg.injection) {
			case 'init': {
				const { nonce } = msg.details;
				browser.storage.session.set({ [`nonce:${tabId}`]: nonce })
				.then(() => {
					const func = init;
					const args = [ loggingPath, nonce ];
					return browser.scripting.executeScript({ target, func, args, world: 'MAIN' });
				})
				.then(respond)
				.catch(handleError);
				break;
			}
			case 'pip': {
				events.getNonce(tabId)
				.then(nonce => {
					const func = initPip;
					const args = [ loggingPath, nonce, msg.details ];
					return browser.scripting.executeScript({ target, func, args, world: 'MAIN' });
				})
				.then(respond)
				.catch(handleError);
				break;
			}
			default:
				respond(null);
		}
	} else if ('detection' in msg) {
		const { text } = msg.detection;
		(detector.isReady ? Promise.resolve() : detector.ready())
		.then(() => detector.detect(text))
		.then(respond);
	} else if ('translation' in msg) {
		const { text, source, target: tl } = msg.translation;
		(
			source
			? Promise.resolve(source)
			: detector.detect(text).then(d => d.isReliable && d.source || 'auto')
		)
		.then(sl => translationController?.translate(text, tl, sl))
		.then(respond);
	} else if ('mask' in msg) {
		const { mask: blob } = msg;
		const startTime = performance.now();
		(
			personDetectionEngine?.run({ args: [ blob ] })
			|| Promise.reject(new DOMException('Person detector is not defined.', 'NotSupportedError'))
		)
		.then(respond, handleError)
		.finally(() => performanceLogger.write(performance.now() - startTime));
	} else if ('fire' in msg) {
		events[msg.fire](tabId).then(respond).catch(handleError);
	} else if ('request' in msg) {
		const { url, options } = msg.request;
		fetch(url, options)
		.then(res => {
			if (!res.ok) throw `Request failed: ${res.status} ${res.statusText}`;
			return res[msg.contentType]();
		})
		.then(data => respond({ data }))
		.catch(handleError);
	} else {
		respond(void 0);
	}
	return true;
});
