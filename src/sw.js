import { logger } from './modules/logging.mjs';
import { store } from './modules/store.mjs';
import { toPascalCase } from './modules/utils.mjs';

import init from './injections/init.mjs';
import initPip from './injections/pip.mjs';

import { LanguageDetectionController, TranslatorController } from './modules/translator.mjs';
import { MLEngineManager } from './modules/ml_engine.mjs';

// @ts-expect-error: Polyfill browser API for Chrome 147 or older environments
globalThis.browser ??= chrome;

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

		const id = await browser.notifications.create({
			type: 'basic',
			title: manifest.name,
			iconUrl: manifest.icons?.['128'],
			message: browser.i18n.getMessage(`notification_title_on${toPascalCase(reason)}`, [manifest.version]),
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
		const record = await browser.storage.session.get(key);
		const nonce = record?.[key];
		if (typeof nonce === 'string') return nonce;
		else throw new DOMException('Nonce not found', 'NotFoundError');
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

/** @type {MLEngineManager | { run: () => Promise<import("../types/messaging.d.ts").SegmentationResult[]> }} */
let personDetectionEngine = {
	async run() {
		const width = 256, height = 144;
		const data = new Uint8Array(width * height);
		const mask = { data, width, height, channel: 1 };
		return [ { label: null, score: null, mask } ];
	}
};

const performanceLogger = {
	buffer: new Uint32Array(100),
	// skip first inference
	offset: -1,
	sum: 0,
	/** @param {number} v */
	write(v) {
		if (this.offset < 0) {
			this.offset = 0;
			return;
		}
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
		try {
			await personDetectionEngine.ensureReady();
		} catch (reason) {
			logger.warn('Failed to initialize ML engine:', reason);
			const err = new DOMException('Person detector is not defined.', 'NotSupportedError');
			personDetectionEngine.run = () => Promise.reject(err);
		}
	} else {
		logger.warn('Permission "trialML" was rejected.');
		s.personDetection.device = '';
	}
});

/** @import { YTLCFMessage } from "../types/messaging.d.ts" */
// @ts-expect-error: Type casting in parameter list causes signature mismatch with onMessage listener
browser.runtime.onMessage.addListener((/** @type {YTLCFMessage.Request.Any} */ msg, sender, respond) => {
	const tabId = sender.tab?.id;
	/** @type {(err: unknown) => void} */
	const handleError = err => {
		logger.warn(err);
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
				respond({
					error: {
						name: 'NotSupportedError',
						// @ts-expect-error: Response structure may not strictly match the message type schema
						message: `Unknown injection type: "${msg.injection}"`,
					},
				});
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
		personDetectionEngine.run({ args: [ blob ] })
		.then(result => {
			respond(result);
			performanceLogger.write(performance.now() - startTime);
		}, handleError);
	} else if ('fire' in msg) {
		if (Object.hasOwn(events, msg.fire)) {
			events[msg.fire](tabId).then(respond).catch(handleError);
		} else {
			handleError(new DOMException(`Unknown event: ${msg.fire}`, 'NotSupportedError'));
		}
	} else if ('request' in msg) {
		const { url, options } = msg.request;
		fetch(url, options)
		.then(res => {
			if (!res.ok) throw new DOMException(`${res.status} ${res.statusText}`, 'NetworkError');
			return res[msg.contentType]();
		})
		.then(data => respond({ data }))
		.catch(handleError);
	} else {
		handleError(new DOMException(`Unknown message type: ${JSON.stringify(msg)}`, 'NotSupportedError'));
	}
	return true;
});
