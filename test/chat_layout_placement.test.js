import './_globals.js';
import { assertEquals, assertAlmostEquals } from '@std/assert';
import { restore, stub } from '@std/testing/mock';
import { FakeTime } from '@std/testing/time';
import { LiveChatLayoutCache, layoutChatItem } from '../src/modules/chat_layout.mjs';
import { store } from '../src/modules/store.mjs';

/**
 * @typedef Options
 * @prop {number} [width]
 * @prop {number} [height]
 * @prop {number} [wrappedWidth]
 * @prop {number} [wrappedHeight]
 * @prop {(line: number) => number} [fontForLine]
 * @prop {number} [overlapScale]
 * @prop {number} [rectOffset]
 */

class ElementStub {
	/** @type {Set<string>} */
	classes = new Set();
	/** @type {Map<string, string>} */
	attributes = new Map();
	reads = { width: 0, height: 0, rect: 0, style: 0 };
	classList = {
		add: (/** @type {string} */ name) => this.classes.add(name),
		values: () => this.classes.values(),
	};
	style = {
		top: '', bottom: '', opacity: '', zIndex: '',
		/** @type {Map<string, string>} */
		values: new Map(),
		/**
		 * @param {string} name @param {string} value
		 * @this {{ values: Map<string, string> }}
		 */
		setProperty(name, value) { this.values.set(name, value); },
		/**
		 * @param {string} name
		 * @this {{ values: Map<string, string> }}
		 */
		getPropertyValue(name) { return this.values.get(name) ?? ''; },
	};
	/**
	 * @param {string} id @param {HostStub} host @param {Options} [options]
	 */
	constructor(id, host, options = {}) {
		this.id = id;
		this.host = host;
		this.options = options;
	}
	/** @param {string} name @param {string} value */
	setAttribute(name, value) { this.attributes.set(name, value); }
	get fontSize() { return this.options.fontForLine?.(Number(this.attributes.get('data-line') ?? 0)) ?? 10; }
	get boxWidth() { return this.classes.has('wrap') ? this.options.wrappedWidth ?? 100 : this.options.width ?? 20; }
	get boxHeight() { return this.classes.has('wrap') ? this.options.wrappedHeight ?? 20 : this.options.height ?? 10; }
	get clientWidth() { this.reads.width++; return this.boxWidth; }
	get clientHeight() { this.reads.height++; return this.boxHeight; }
	getBoundingClientRect() {
		this.reads.rect++;
		const scale = this.classes.has('overlap') ? this.options.overlapScale ?? 1 : 1;
		const width = this.boxWidth * this.host.scaleX * scale;
		const height = this.boxHeight * this.host.scaleY * scale;
		const offset = Number.parseFloat(this.style.bottom || this.style.top || '0') * this.fontSize * this.host.scaleY;
		const originTop = this.host.top + this.host.border * this.host.scaleY;
		const top = this.style.bottom ? originTop + (this.host.height - 2 * this.host.border) * this.host.scaleY - offset - height : originTop + offset;
		const reversed = !!(store.data.others.direction & 2);
		const left = this.host.left + (reversed ? -width : this.host.clientWidth * this.host.scaleX);
		const roundedTop = top + (this.options.rectOffset ?? 0);
		// DOMRect so mutable `y` in moveTo() keeps `top`/`bottom` in sync like the real DOM.
		return new DOMRect(left, roundedTop, width, height);
	}
	get element() { return /** @type {HTMLElement} */ (/** @type {unknown} */ (this)); }
}

class HostStub {
	height = 100;
	width = 100;
	padding = 0;
	border = 0;
	boxSizing = 'border-box';
	top = 30;
	left = 20;
	scaleX = 1;
	scaleY = 1;
	get clientHeight() { return Math.round(this.height - 2 * this.border); }
	set clientHeight(/** @type {number} */ value) { this.height = value + 2 * this.border; }
	get clientWidth() { return Math.round(this.width - 2 * this.border); }
	set clientWidth(/** @type {number} */ value) { this.width = value + 2 * this.border; }
	getBoundingClientRect() {
		return { top: this.top, height: this.height * this.scaleY, width: this.width * this.scaleX };
	}
	/** @returns {CSSStyleDeclaration} */
	getComputedStyle() {
		const inset = this.boxSizing === 'border-box' ? 0 : 2 * (this.padding + this.border);
		return /** @type {CSSStyleDeclaration} */ (/** @type {unknown} */ ({
			width: `${this.width - inset}px`, height: `${this.height - inset}px`, boxSizing: this.boxSizing,
			paddingTop: `${this.padding}px`, paddingBottom: `${this.padding}px`,
			paddingLeft: `${this.padding}px`, paddingRight: `${this.padding}px`,
			borderTopWidth: `${this.border}px`, borderBottomWidth: `${this.border}px`,
			borderLeftWidth: `${this.border}px`, borderRightWidth: `${this.border}px`,
		}));
	}
}

/**
 * @param {number} [lanes] @param {(host: HostStub) => void} [configure]
 */
function fixture(lanes = 10, configure = () => {}) {
	const host = new HostStub();
	configure(host);
	const dom = /** @type {ShadowRoot} */ (/** @type {unknown} */ ({ host, appendChild() {} }));
	const cache = new LiveChatLayoutCache(dom, lanes);
	return {
		host, cache,
		/** @param {string} id @param {Options} [options] */
		element: (id, options = {}) => new ElementStub(id, host, options),
	};
}

/**
 * Narrows the `ChatLayoutInfo[] | undefined` that the cache hands back, so the
 * placement assertions can read the stored layouts directly. A missing entry is
 * a test bug, so this throws rather than silently comparing against undefined.
 * @param {LiveChatLayoutCache} cache @param {HTMLElement} element
 * @returns {NonNullable<ReturnType<LiveChatLayoutCache['get']>>}
 */
function laidOut(cache, element) {
	const layouts = cache.get(element);
	if (!layouts) throw new Error(`No layout stored for ${element.id}.`);
	return layouts;
}

/**
 * Pins the clock and randomness, swaps in the fake `getComputedStyle`, and
 * restores the ambient state after each case.
 * @param {string} name @param {() => void} run
 */
function test(name, run) {
	Deno.test(name, () => {
		const before = structuredClone(store.data);
		store.data.styles.line_height = '1';
		store.data.styles.layer_css = '';
		store.data.styles.max_width = '100%';
		for (const key of Object.keys(store.data.cssTexts)) store.data.cssTexts[key] = '';
		store.data.others.direction = 0;
		store.data.others.overlapping = 0;
		const time = new FakeTime(1000);
		stub(Math, 'random', () => 0);
		stub(globalThis, 'getComputedStyle', (/** @type {Element} */ elem) => {
			if (elem instanceof HostStub) return elem.getComputedStyle();
			const fake = /** @type {ElementStub} */ (/** @type {unknown} */ (elem));
			fake.reads.style++;
			return /** @type {CSSStyleDeclaration} */ (/** @type {unknown} */ ({
				fontSize: `${fake.fontSize}px`,
				lineHeight: `${fake.fontSize * Number(store.data.styles.line_height)}px`,
				animationDuration: '8s',
			}));
		});
		try { run(); } finally {
			Object.assign(store.data.styles, before.styles);
			Object.assign(store.data.others, before.others);
			Object.assign(store.data.cssTexts, before.cssTexts);
			restore();
			time.restore();
		}
	});
}

test('stock dense placement measures once regardless of candidate count', () => {
	const { cache, element } = fixture();
	for (let i = 0; i < 9; i++) layoutChatItem(element(`preceding-${i}`).element, cache);
	const target = element('target');
	layoutChatItem(target.element, cache);
	assertEquals(target.attributes.get('data-line'), '9');
	assertEquals(target.style.top, '9em');
	assertEquals(target.reads, { width: 2, height: 1, rect: 1, style: 1 });
});

for (let direction = 0; direction < 4; direction++) {
	test(`numeric rectangles match final placement in direction ${direction}`, () => {
		store.data.others.direction = direction;
		const { cache, element } = fixture();
		layoutChatItem(element('first').element, cache);
		const target = element('target');
		layoutChatItem(target.element, cache);
		const result = laidOut(cache, target.element)[0];
		const actual = target.getBoundingClientRect();
		assertEquals(target.attributes.get('data-line'), '1');
		assertAlmostEquals(result.top, actual.top);
		assertAlmostEquals(result.bottom, actual.bottom);
		assertAlmostEquals(result.getLeft(direction & 2 ? -1 : 1), actual.left);
	});
}

test('wrap dimensions and animation distance use the finalized size', () => {
	const { cache, element } = fixture();
	const target = element('wrapped', { width: 120, height: 10, wrappedWidth: 80, wrappedHeight: 30 });
	layoutChatItem(target.element, cache);
	assertEquals(target.classes.has('wrap'), true);
	assertEquals(target.style.getPropertyValue('--yt-lcf-translate-x'), '-180px');
	assertEquals(laidOut(cache, target.element)[0].height, 30);
	assertEquals(laidOut(cache, target.element).length, 3);
});

test('a tall bottom-up message cannot enclose a preceding shorter message', () => {
	store.data.others.direction = 1;
	const { cache, element } = fixture();
	const short = element('short');
	layoutChatItem(short.element, cache);
	const target = element('tall', { height: 20 });
	layoutChatItem(target.element, cache);
	assertEquals(target.attributes.get('data-line'), '1');
	assertEquals(laidOut(cache, target.element)[0].isCollidable(laidOut(cache, short.element)[0]), false);
});

test('bottom-up candidates stop at the upper host boundary', () => {
	store.data.others.direction = 1;
	const { cache, element } = fixture(10, host => { host.clientHeight = 25; });
	layoutChatItem(element('first').element, cache);
	layoutChatItem(element('second').element, cache);
	const target = element('third');
	layoutChatItem(target.element, cache);
	assertEquals(target.classes.has('overlap'), true);
	assertEquals(target.attributes.get('data-line'), '0');
	assertEquals(laidOut(cache, target.element)[0].isOverflow(cache.dom.host.getBoundingClientRect()), false);
});

test('subpixel rectangle rounding at the bottom edge keeps the first lane usable', () => {
	store.data.others.direction = 1;
	const { cache, element } = fixture();
	const target = element('rounded', { rectOffset: .000041961669921875 });
	layoutChatItem(target.element, cache);
	assertEquals(target.classes.has('overlap'), false);
	assertEquals(target.style.bottom, '0em');
	const layout = laidOut(cache, target.element)[0];
	assertEquals(layout.isOverflow({ top: 30, height: 100 }), false);
	assertEquals(layout.isOverflow({ top: 30, height: 99.98 }), true);
	assertEquals(layout.isOverflow({ top: layout.top + .00004, height: 100 }), false);
	assertEquals(layout.isOverflow({ top: layout.top + .02, height: 100 }), true);
});

test('dense overlap caches its final half-lane rectangle and both occupied lanes', () => {
	store.data.others.overlapping = 3;
	const { cache, element } = fixture(2, host => { host.clientHeight = 20; });
	layoutChatItem(element('first').element, cache);
	layoutChatItem(element('second').element, cache);
	const target = element('overlap');
	layoutChatItem(target.element, cache);
	assertEquals(target.style.top, '0.5em');
	assertEquals(target.attributes.get('data-line'), '0');
	assertEquals(laidOut(cache, target.element).length, 2);
	assertEquals(laidOut(cache, target.element)[0].top, target.getBoundingClientRect().top);
	assertEquals(target.style.opacity, '0.6400000000000001');
	assertEquals(target.style.zIndex, '-2');
});

test('random placement consumes remaining lanes with fixed-zero randomness', () => {
	const { cache, element } = fixture(3);
	for (let i = 0; i < 3; i++) layoutChatItem(element(`full-${i}`).element, cache);
	const target = element('random');
	layoutChatItem(target.element, cache, 'random');
	assertEquals(target.attributes.get('data-line'), '2');
	assertEquals(target.reads.rect, 1);
});

test('random saturation retains a fitting lane instead of an overflowing one', () => {
	store.data.others.direction = 1;
	const { cache, element } = fixture(10, host => { host.clientHeight = 25; });
	layoutChatItem(element('first').element, cache);
	layoutChatItem(element('second').element, cache);
	const target = element('random');
	layoutChatItem(target.element, cache, 'random');
	assertEquals(target.attributes.get('data-line'), '1');
	assertEquals(laidOut(cache, target.element)[0].isOverflow(cache.dom.host.getBoundingClientRect()), false);
});

test('zero lanes are safe in dense and random modes', () => {
	for (const mode of /** @type {const} */ (['dense', 'random'])) {
		const { cache, element } = fixture(0);
		const target = element(mode);
		assertEquals(layoutChatItem(target.element, cache, mode), mode);
		assertEquals(target.attributes.get('data-line'), '0');
		assertEquals(cache.get(target.element), undefined);
	}
});

test('scaled host placement and speed stay in viewport coordinates', () => {
	const { cache, element } = fixture(10, host => { host.scaleY = 2; host.scaleX = 1.5; });
	layoutChatItem(element('first').element, cache);
	const target = element('scaled');
	layoutChatItem(target.element, cache);
	const layout = laidOut(cache, target.element)[0];
	assertEquals(target.attributes.get('data-line'), '1');
	assertEquals(layout.top, target.getBoundingClientRect().top);
	assertEquals(layout.height, 20);
	assertAlmostEquals(layout.speed, 120 * 1.5 / 8000);
	assertEquals(laidOut(cache, target.element).length, 1);
});

for (const measured of [false, true]) {
	for (const direction of [0, 1]) {
		for (const mode of /** @type {const} */ (['dense', 'random'])) {
			test(`fractional host fills every lane (${measured ? 'measured' : 'numeric'}, direction ${direction}, ${mode})`, () => {
				store.data.styles.line_height = '1.4';
				store.data.styles.layer_css = measured ? 'color: white' : '';
				store.data.others.direction = direction;
				const { cache, element } = fixture(8, host => {
					host.width = 659.0117797851562;
					host.height = 370.6941223144531;
				});
				for (let line = 0; line < 8; line++) {
					const target = element(`fractional-${line}`, { fontForLine: () => 32, height: 44.80004 });
					layoutChatItem(target.element, cache, mode);
					assertEquals(target.attributes.get('data-line'), `${line}`);
					assertEquals(target.classes.has('overlap'), false);
					assertEquals(laidOut(cache, target.element).length, 1);
					assertAlmostEquals(laidOut(cache, target.element)[0].top, target.getBoundingClientRect().top);
					assertAlmostEquals(laidOut(cache, target.element)[0].speed, (659 + 20) / 8000);
				}
			});
		}
	}
}

for (const boxSizing of ['border-box', 'content-box']) {
	test(`fractional scaled ${boxSizing} host excludes padding and borders from scale`, () => {
		const { cache, element } = fixture(8, host => {
			host.width = 659.0117797851562;
			host.height = 370.6941223144531;
			host.scaleX = 1.5;
			host.scaleY = 2;
			host.padding = 3.25;
			host.border = 1.5;
			host.boxSizing = boxSizing;
		});
		for (let line = 0; line < 8; line++) {
			const target = element(`scaled-${line}`);
			layoutChatItem(target.element, cache);
			const layout = laidOut(cache, target.element)[0];
			assertEquals(target.attributes.get('data-line'), `${line}`);
			assertEquals(laidOut(cache, target.element).length, 1);
			assertAlmostEquals(layout.top, target.getBoundingClientRect().top);
			assertAlmostEquals(layout.speed, (656 + 20) * 1.5 / 8000);
		}
	});
}

test('subpixel tolerance still rejects a real vertical overlap', () => {
	const { cache, element } = fixture();
	const tall = element('tall', { height: 10.02 });
	layoutChatItem(tall.element, cache);
	const target = element('next');
	layoutChatItem(target.element, cache);
	assertEquals(target.attributes.get('data-line'), '2');
	assertEquals(laidOut(cache, tall.element).length, 2);
});

test('positive subpixel height still occupies a lane', () => {
	const { cache, element } = fixture();
	const target = element('tiny', { height: .005 });
	layoutChatItem(target.element, cache);
	assertEquals(laidOut(cache, target.element).length, 1);
});

test('custom CSS keeps measuring lane-dependent em positions', () => {
	store.data.cssTexts[''] = '[data-line="1"] { font-size: 20px }';
	const { cache, element } = fixture();
	layoutChatItem(element('first').element, cache);
	const target = element('custom', { fontForLine: (/** @type {number} */ line) => line === 1 ? 20 : 10 });
	layoutChatItem(target.element, cache);
	assertEquals(target.style.top, '1em');
	assertEquals(laidOut(cache, target.element)[0].top, target.getBoundingClientRect().top);
	assertEquals(target.reads.style, 3);
});

test('custom layer CSS measures the final overlap class and half-line position', () => {
	store.data.styles.layer_css = 'transform: scale(1)';
	store.data.others.overlapping = 2;
	const { cache, element } = fixture(1, host => { host.clientHeight = 10; });
	// Avoid the taller-than-host shortcut while still saturating the only lane.
	hostHeight(cache, 20);
	layoutChatItem(element('first').element, cache);
	const target = element('custom-overlap', { overlapScale: 2 });
	layoutChatItem(target.element, cache);
	assertEquals(target.classes.has('overlap'), true);
	assertEquals(target.style.top, '0.5em');
	assertEquals(laidOut(cache, target.element)[0].top, target.getBoundingClientRect().top);
	assertEquals(laidOut(cache, target.element)[0].height, 20);
});

/** @param {LiveChatLayoutCache} cache @param {number} height */
function hostHeight(cache, height) {
	/** @type {HostStub} */ (/** @type {unknown} */ (cache.dom.host)).clientHeight = height;
}

test('element-keyed cache keeps a newer layout when the same id is replaced', () => {
	const { cache, element } = fixture();
	const old = element('same');
	layoutChatItem(old.element, cache);
	const replacement = element('same');
	layoutChatItem(replacement.element, cache);
	assertEquals(cache.delete(old.element).some(Boolean), true);
	assertEquals(cache.get(old.element), undefined);
	assertEquals(cache.delete(old.element).some(Boolean), false);
	assertEquals(laidOut(cache, replacement.element).length, 1);
	assertEquals(cache.delete(replacement.element).some(Boolean), true);
	assertEquals(cache.get(replacement.element), undefined);
});
