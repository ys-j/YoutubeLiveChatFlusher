import './_globals.mjs';
import { assertEquals } from '@std/assert';
import initPip from '../src/injections/pip.mjs';

/** @typedef {EventTarget & Record<string, any>} StubElement */

class MouseEventStub extends Event {
	/** @param {string} type @param {MouseEventInit} [init] */
	constructor(type, init = {}) {
		super(type, init);
		this.clientX = init.clientX ?? 0;
		this.clientY = init.clientY ?? 0;
		this.buttons = init.buttons ?? 0;
	}
}

async function fixture() {
	/** @returns {StubElement} */
	const element = () => Object.assign(new EventTarget(), {
		style: {}, dataset: {}, parentElement: null, children: [],
		querySelector: () => null,
		/** @this {StubElement} @param {...StubElement} nodes */
		append(...nodes) { for (const node of nodes) node.parentElement = this; },
		/** @this {StubElement} @param {StubElement} node */
		before(node) { node.parentElement = this.parentElement; },
		/** @this {StubElement} */
		remove() { this.parentElement = null; },
		/** @this {StubElement} @param {string} key @param {string} value */
		setAttribute(key, value) { this[key] = value; },
	});
	const parent = Object.assign(element(), { clientWidth: 1280, clientHeight: 720 });
	const container = element();
	parent.append(container);
	const menu = element();
	const video = Object.assign(element(), { videoWidth: 0, videoHeight: 0 });
	const overlay = element();
	/** @type {number[][]} */
	const sizes = [];
	let wakeups = 0;
	let settingsOpen = true;
	let settingsOpenAtRequest = true;
	const settings = Object.assign(element(), {
		click() { settingsOpen = false; },
	});
	const player = Object.assign(element(), {
		/** @param {number} width @param {number} height */
		setSize(width, height) { sizes.push([width, height]); },
		wakeUpControls() { wakeups++; },
		/** @param {string} selector */
		querySelector: selector => selector === 'video' ? video
			: selector === '.ytp-iv-video-content' ? overlay
			: selector.startsWith('.ytp-settings-button') && settingsOpen ? settings : null,
	});
	/** @param {string} selector */
	container.querySelector = selector => selector === '#movie_player' ? player : player.querySelector(selector);
	const moved = Promise.withResolvers();
	const body = element();
	body.appendChild = (/** @type {StubElement} */ node) => { body.append(node); moved.resolve(undefined); };
	const pipDocument = {
		body, head: element(), documentElement: { attributes: { setNamedItem() {} } },
		/** @param {string} selector */
		querySelector: selector => selector === '#movie_player' || selector === 'ytd-player' ? player
			: selector === 'video' ? video : null,
		getElementsByTagName: () => [],
	};
	const pipWindow = Object.assign(new EventTarget(), {
		document: pipDocument, innerWidth: 640, innerHeight: 360,
	});
	const layer = Object.assign(element(), { closest: () => container });
	const document = Object.assign(new EventTarget(), {
		body: element(), documentElement: { attributes: [] }, styleSheets: [],
		createElement: element,
		/** @param {string} id */
		getElementById: id => id === 'yt-lcf-pp' ? menu : id === 'yt-lcf-layer' ? layer : null,
		querySelector: () => null,
		contains: () => true,
	});
	container.ownerDocument = document;
	const top = Object.assign(new EventTarget(), {
		document,
		documentPictureInPicture: { requestWindow: () => {
			settingsOpenAtRequest = settingsOpen;
			return Promise.resolve(pipWindow);
		} },
	});
	const initialize = new Function('document', 'top', 'self', 'MouseEvent', `return (${initPip.toString()});`)(document, top, top, MouseEventStub);
	initialize('data:text/javascript,export const logger = { info() {}, warn() {} };', 'test-nonce', { hotkeys: {} });
	menu.dispatchEvent(new Event('click'));
	await moved.promise;
	return { document, pipWindow, video, container, parent, sizes, settingsOpenAtRequest, settingsOpen: () => settingsOpen, wakeups: () => wakeups };
}

Deno.test('PiP fits the native player on open, before video metadata arrives', async () => {
	const { sizes } = await fixture();
	assertEquals(sizes, [[640, 360]]);
});

Deno.test('PiP resizes the whole player synchronously on every window resize', async () => {
	const { pipWindow, sizes } = await fixture();
	pipWindow.innerWidth = 900;
	pipWindow.innerHeight = 600;
	pipWindow.dispatchEvent(new Event('resize'));
	pipWindow.innerWidth = 320;
	pipWindow.innerHeight = 480;
	pipWindow.dispatchEvent(new Event('resize'));
	assertEquals(sizes, [[640, 360], [900, 600], [320, 480]]);
});

Deno.test('PiP closes settings and wakes native controls on mouse movement', async () => {
	const f = await fixture();
	assertEquals(f.settingsOpenAtRequest, false);
	assertEquals(f.settingsOpen(), false);
	f.pipWindow.dispatchEvent(new Event('mousemove'));
	assertEquals(f.wakeups(), 1);
});

Deno.test('PiP forwards mouse movement and release to the opener drag listeners', async () => {
	const f = await fixture();
	/** @type {{ type: string, x: number, y: number, buttons: number }[]} */
	const received = [];
	for (const type of ['mousemove', 'mouseup']) {
		f.document.addEventListener(type, event => {
			const e = /** @type {MouseEventStub} */ (event);
			received.push({ type: e.type, x: e.clientX, y: e.clientY, buttons: e.buttons });
		});
	}
	f.pipWindow.dispatchEvent(new MouseEventStub('mousemove', { clientX: 250, clientY: 330, buttons: 1 }));
	f.pipWindow.dispatchEvent(new MouseEventStub('mouseup', { clientX: 400, clientY: 330, buttons: 0 }));
	assertEquals(received, [
		{ type: 'mousemove', x: 250, y: 330, buttons: 1 },
		{ type: 'mouseup', x: 400, y: 330, buttons: 0 },
	]);
	assertEquals(f.wakeups(), 1);
	f.pipWindow.dispatchEvent(new Event('pagehide'));
	f.pipWindow.dispatchEvent(new MouseEventStub('mouseup', { clientX: 500, clientY: 330 }));
	assertEquals(received.length, 2);
});

Deno.test('closing PiP restores native layout and removes media resize listeners', async () => {
	const { pipWindow, video, container, parent, sizes } = await fixture();
	pipWindow.dispatchEvent(new Event('pagehide'));
	assertEquals(container.parentElement, parent);
	assertEquals(sizes, [[640, 360], [1280, 720]]);
	video.dispatchEvent(new Event('loadeddata'));
	video.dispatchEvent(new Event('loadedmetadata'));
	assertEquals(sizes.length, 2);
	assertEquals(video.style.pointerEvents, '');
});
