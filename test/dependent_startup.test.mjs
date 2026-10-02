// Run: deno test --allow-read test/dependent_startup.test.mjs
// An optional checkout file URL ending in / after -- selects regression source.
import './_globals.mjs';
import { assert, assertEquals } from '@std/assert';

const sourceRoot = new URL(Deno.args[0] ?? '../', import.meta.url);
/** @param {string} path */
const read = path => Deno.readTextFileSync(new URL(path, sourceRoot));
const controllerSource = read('src/modules/chat_controller.mjs');
const mainSource = read('src/modules/main.mjs');
const frameSource = read('src/chatframe.js');
const NONCE = 'fixture-tab-nonce';

async function settle() {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

/**
 * Wire imports to browser/DOM stubs without changing the production logic.
 * @param {string[]} sources
 * @param {Record<string, unknown>} bindings
 */
function loadModules(sources, bindings) {
	const script = sources.map(source => source.replace(/^import .*;?\r?\n/gm, '').replace(/^export /gm, '')).join('\n');
	return new Function(...Object.keys(bindings), script + '\nreturn { initialize, state };')(...Object.values(bindings));
}

/** @typedef {EventTarget & Record<string, any>} StubElement */

function fixture({ live = false, mode = 0 } = {}) {
	/** @type {Map<string, StubElement>} */
	const nodes = new Map();
	/** @type {string[]} */
	const processed = [];
	/** @type {unknown[][]} */
	const logs = [];
	let listenCalls = 0;
	const account = Promise.withResolvers();
	/** @type {PromiseWithResolvers<string> | null} */
	let nextNonce = null;

	/** @param {string} [id] @returns {StubElement} */
	function element(id = '') {
		return Object.assign(new EventTarget(), {
			id, hidden: false, dataset: {}, style: { cssText: '', setProperty() {} },
			classList: { contains: () => false },
			querySelector: () => null, getElementById: () => null,
			/** @this {StubElement} @param {string} name @param {string} value */
			setAttribute(name, value) { this[name] = value; },
			/** @this {StubElement} @param {...StubElement} children */
			append(...children) {
				for (const child of children) {
					child.parentElement = this;
					nodes.set(child.id, child);
				}
			},
			/** @this {StubElement} @param {...StubElement} children */
			after(...children) { this.parentElement?.append(...children); },
			remove() { nodes.delete(id); },
		});
	}
	const body = element('body');
	const container = element('movie_player');
	const video = element('video');
	const menu = element('settings-menu');
	body.append(container);
	container.append(video, menu);
	const player = element('app');
	player.tagName = 'YTD-APP';
	/** @param {string} selector */
	player.querySelector = selector => selector === '#movie_player video' ? video
		: selector === '.ytp-settings-menu .ytp-panel-menu' ? menu
		: nodes.get(selector.slice(1)) || null;
	const document = Object.assign(new EventTarget(), {
		body, visibilityState: 'visible',
		/** @param {string} id */
		getElementById: id => nodes.get(id) || null,
		/** @param {string} selector */
		querySelector: selector => selector === '#movie_player video' ? video : null,
		createElement: () => element(),
	});
	const self = Object.assign(new EventTarget(), { document });
	const store = {
		others: { mode_livestream: mode, mode_replay: mode, layer_autofit: 0, simultaneous: 0 },
		styles: { layer_css: '' }, personDetection: {}, hotkeys: {}, data: { hotkeys: {} },
		async load() { return this; },
	};
	/** @param {string} level */
	function log(level) {
		/** @param {unknown[]} args */
		return (...args) => { logs.push([level, ...args]); };
	}
	const logger = { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
	const browser = {
		runtime: {
			/** @param {string} path */
			getURL: path => path,
			getManifest: () => ({ name: 'Fixture' }),
			/** @param {{fire?: string, injection?: string}} message */
			async sendMessage(message) {
				if (message.fire !== 'getNonce') return;
				if (nextNonce) {
					const pending = nextNonce;
					nextNonce = null;
					return await pending.promise;
				}
				return NONCE;
			},
		},
		i18n: {
			/** @param {string} key */
			getMessage: key => key,
		},
	};
	/** @type {Map<number, () => unknown>} */
	const timers = new Map();
	let nextTimer = 0;
	const bindings = {
		self, document, browser, store, s: store, logger,
		Event, EventTarget, CustomEvent, AbortController, DOMException,
		LiveChatLayer: class {
			constructor() { this.element = element('yt-lcf-layer'); this.root = element('shadow-root'); }
			hide() { this.element.hidden = true; }
			clear() {}
			autofit() {}
		},
		LiveChatPanel: class {
			constructor() { this.element = element('yt-lcf-panel'); this.form = null; }
			async createForm() {}
		},
		LiveChatLayoutCache: class {
			/** @param {string} id */
			delete(id) { processed.push(id); return [true]; }
		},
		LiveChatItemFactory: class { async load() {} },
		LiveChatContextMenu: class { constructor() { this.element = element('yt-lcf-context'); } },
		MutationObserver: class { observe() { listenCalls++; } disconnect() {} },
		updateMutedWordsList() {}, updateTlExclusionList() {},
		ReplayActionBuffer: class { size = 0; clear() {} update() {} pushActions() {} },
		getLiveChatActionsAsyncIterable: async function* () { yield []; },
		getReplayChatActionsAsyncIterable: async function* () { yield []; },
		isNotPip: () => true, isAdShowing: () => false, getText: () => '',
		/** @param {any} data @param {string} pointer */
		getValueByJSONPointer: (data, pointer) => pointer === '' ? data : data?.response,
		/** @param {string} url */
		fetch: url => { assertEquals(url, '/account_advanced'); return account.promise; },
		loadTemplateDocument: async () => ({
			body: { children: ['yt-lcf-cb', 'yt-lcf-pm', 'yt-lcf-pp'].map(id => element(id)) },
		}),
		/** @param {() => unknown} fn */
		setInterval(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
		/** @param {number} id */
		clearInterval(id) { timers.delete(id); },
		setTimeout() {}, // Independent replay's seek timer is outside this regression.
	};
	const { initialize, state } = loadModules([controllerSource, mainSource], bindings);
	function detail() {
		return {
			pageType: 'watch',
			response: {
				page: 'watch', playerResponse: { videoDetails: { videoId: 'fixture', title: 'Fixture', isLive: live } },
				response: { contents: { twoColumnWatchNextResults: { conversationBar: {
					liveChatRenderer: { continuations: [{ reloadContinuationData: { continuation: 'fixture' } }] },
				} } } },
			},
		};
	}
	const start = () => initialize({ target: player, detail: detail() });
	const finishAccount = (fail = false) => fail
		? account.reject(new TypeError('Failed to fetch'))
		: account.resolve({ text: async () => '' });
	return {
		document, logs, nodes, processed, start, finishAccount,
		async ready() { const startup = start(); finishAccount(); await startup; await settle(); },
		get listening() { return state.controller?.listening ?? false; },
		get disabled() { return nodes.get('yt-lcf-cb')?.['aria-disabled']; },
		get listenCalls() { return listenCalls; },
		holdNextNonce() {
			/** @type {PromiseWithResolvers<string>} */
			const pending = Promise.withResolvers();
			nextNonce = pending;
			return () => pending.resolve(NONCE);
		},
		navigateStart() { self.dispatchEvent(new Event('yt-navigate-start')); },
		async navigateFinish() {
			self.dispatchEvent(new CustomEvent('yt-navigate-finish', { detail: detail() }));
			await settle();
		},
		async frame() {
			const frameDocument = new EventTarget();
			/** @type {Map<number, () => unknown>} */
			const pending = new Map();
			let timerId = 0;
			const frameBrowser = {
				...browser, runtime: { ...browser.runtime, sendMessage: async () => NONCE },
			};
			const frameBindings = {
				document: frameDocument, top: self, chrome: frameBrowser, browser: frameBrowser,
				globalThis: { browser: frameBrowser },
				CustomEvent, DOMException,
				location: { pathname: live ? '/live_chat' : '/live_chat_replay' },
				/** @param {string} path */
				importModule: async path => path.includes('store') ? { store } : { logger },
				/** @param {() => unknown} fn */
				setTimeout(fn) { const id = ++timerId; pending.set(id, fn); return id; },
			};
			new Function(...Object.keys(frameBindings), frameSource.replace(/\bimport\(/g, 'importModule('))(...Object.values(frameBindings));
			await settle();
			return {
				get pending() { return pending.size; },
				async tick() {
					const callbacks = [...pending.values()];
					pending.clear();
					for (const callback of callbacks) callback();
					await settle();
				},
				/** @param {string} id */
				async action(id) {
					frameDocument.dispatchEvent(new CustomEvent('yt-action', { detail: {
						actionName: 'yt-live-chat-actions', args: [[{ markChatItemAsDeletedAction: { targetItemId: id } }]],
					} }));
					await settle();
				},
			};
		},
	};
}

for (const live of [false, true]) {
	for (const fail of [false, true]) {
		Deno.test('early ' + (live ? 'live' : 'replay') + ' frame retries after account fetch ' + (fail ? 'rejects' : 'resolves'), async () => {
			const page = fixture({ live });
			const startup = page.start();
			const frame = await page.frame();
			assert(page.nodes.has('yt-lcf-layer'), 'Layer exists while start() awaits the account fetch.');
			await frame.tick();
			assertEquals(frame.pending, 1, 'An unacknowledged event must be retried.');
			assertEquals(page.listening, false);
			page.finishAccount(fail);
			await startup;
			await settle();
			assertEquals(page.disabled, 'true');
			await frame.tick();
			assertEquals(frame.pending, 0);
			assertEquals(page.listening, true);
			assertEquals(page.disabled, 'false');
			assertEquals(page.listenCalls, 1);
			await frame.action('initial batch');
			await frame.action('next batch');
			assertEquals(page.processed, ['next batch']);
		});
	}
}

Deno.test('a late frame starts once and reopening preserves first-batch skipping', async () => {
	const page = fixture();
	await page.ready();
	const first = await page.frame();
	await first.tick();
	assertEquals(page.listenCalls, 1);
	await first.action('initial history');
	await first.action('before reopen');
	const reopened = await page.frame();
	await reopened.tick();
	assertEquals(reopened.pending, 0);
	assertEquals(page.listenCalls, 2);
	await reopened.action('reopened history');
	await reopened.action('after reopen');
	assertEquals(page.processed, ['before reopen', 'after reopen']);
});

Deno.test('SPA navigation removes old handshake and unused first-action listeners', async () => {
	const page = fixture();
	await page.ready();
	const oldFrame = await page.frame();
	await oldFrame.tick();
	page.navigateStart(); // No action arrived before leaving the old video.
	const nextFrame = await page.frame();
	await nextFrame.tick();
	assertEquals(nextFrame.pending, 1, 'The old page must not acknowledge a new frame.');
	assertEquals(page.listening, false);
	await page.navigateFinish();
	await nextFrame.tick();
	assertEquals(nextFrame.pending, 0);
	assertEquals(page.listenCalls, 2);
	await nextFrame.action('new history');
	await nextFrame.action('new message');
	assertEquals(page.processed, ['new message']);
});

Deno.test('a nonce response arriving after navigation cannot install a stale receiver', async () => {
	const page = fixture();
	await page.ready();
	page.navigateStart();
	const releaseNonce = page.holdNextNonce();
	await page.navigateFinish();
	page.navigateStart();
	releaseNonce();
	await settle();
	const frame = await page.frame();
	await frame.tick();
	assertEquals(frame.pending, 1);
	assertEquals(page.listening, false);
	await page.navigateFinish();
	await frame.tick();
	assertEquals(frame.pending, 0);
	assertEquals(page.listenCalls, 1);
	await frame.action('initial history');
	await frame.action('current message');
	assertEquals(page.processed, ['current message']);
});

Deno.test('dependent mode without its nonce-scoped frame keeps the switch disabled', async () => {
	const page = fixture();
	await page.ready();
	for (const type of ['ytlcf-start', 'ytlcf-start:wrong-nonce']) {
		assertEquals(page.document.dispatchEvent(new CustomEvent(type, { cancelable: true })), true);
	}
	assertEquals(page.disabled, 'true');
	assertEquals(page.listening, false);
	assertEquals(page.listenCalls, 0);
});

for (const live of [false, true]) {
	Deno.test('independent ' + (live ? 'live' : 'replay') + ' starts without the frame handshake', async () => {
		const page = fixture({ live, mode: 1 });
		await page.ready();
		const frame = await page.frame();
		assertEquals(frame.pending, 0);
		assertEquals(page.listening, true);
		assertEquals(page.disabled, 'false');
		assertEquals(page.listenCalls, 1);
		await frame.action('must not forward independent-mode frame actions');
		await frame.action('nor forward a second independent-mode frame action');
		assertEquals(page.processed, []);
	});
}

Deno.test('unacknowledged startup retains the existing bounded retry policy', async () => {
	const page = fixture();
	const startup = page.start();
	const frame = await page.frame();
	assert(page.nodes.has('yt-lcf-layer'));
	for (let i = 0; i < 40; i++) await frame.tick();
	assertEquals(frame.pending, 0);
	assertEquals(page.listening, false);
	assertEquals(page.logs.filter(entry => entry[0] === 'error').length, 1);
	page.finishAccount();
	await startup;
});
