import './_globals.mjs';
import { assertEquals, assertAlmostEquals } from '@std/assert';
import { LiveChatLayoutCache, layoutChatItem } from '../src/modules/chat_layout.mjs';
import { store } from '../src/modules/store.mjs';

type Options = {
	width?: number;
	height?: number;
	wrappedWidth?: number;
	wrappedHeight?: number;
	fontForLine?: (line: number) => number;
	overlapScale?: number;
	rectOffset?: number;
};

class ElementStub {
	id: string;
	options: Options;
	classes = new Set<string>();
	attributes = new Map<string, string>();
	reads = { width: 0, height: 0, rect: 0, style: 0 };
	classList = { add: (name: string) => this.classes.add(name) };
	style = {
		top: '', bottom: '', opacity: '', zIndex: '',
		values: new Map<string, string>(),
		setProperty(name: string, value: string) { this.values.set(name, value); },
		getPropertyValue(name: string) { return this.values.get(name) ?? ''; },
	};
	constructor(id: string, readonly host: HostStub, options: Options = {}) {
		this.id = id;
		this.options = options;
	}
	setAttribute(name: string, value: string) { this.attributes.set(name, value); }
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
		return { width, height, top: roundedTop, bottom: roundedTop + height, left, right: left + width };
	}
	get element() { return this as unknown as HTMLElement; }
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
	set clientHeight(value: number) { this.height = value + 2 * this.border; }
	get clientWidth() { return Math.round(this.width - 2 * this.border); }
	set clientWidth(value: number) { this.width = value + 2 * this.border; }
	getBoundingClientRect() {
		return { top: this.top, height: this.height * this.scaleY, width: this.width * this.scaleX };
	}
	getComputedStyle() {
		const inset = this.boxSizing === 'border-box' ? 0 : 2 * (this.padding + this.border);
		return {
			width: `${this.width - inset}px`, height: `${this.height - inset}px`, boxSizing: this.boxSizing,
			paddingTop: `${this.padding}px`, paddingBottom: `${this.padding}px`,
			paddingLeft: `${this.padding}px`, paddingRight: `${this.padding}px`,
			borderTopWidth: `${this.border}px`, borderBottomWidth: `${this.border}px`,
			borderLeftWidth: `${this.border}px`, borderRightWidth: `${this.border}px`,
		} as CSSStyleDeclaration;
	}
}

function fixture(lanes = 10, configure: (host: HostStub) => void = () => {}) {
	const host = new HostStub();
	configure(host);
	const dom = { host, appendChild() {} } as unknown as ShadowRoot;
	const cache = new LiveChatLayoutCache(dom, lanes);
	return { host, cache, element: (id: string, options: Options = {}) => new ElementStub(id, host, options) };
}

function test(name: string, run: () => void) {
	Deno.test(name, () => {
		const before = structuredClone(store.data);
		const previousStyle = globalThis.getComputedStyle;
		const previousRandom = Math.random;
		const previousNow = Date.now;
		store.data.styles.line_height = '1';
		store.data.styles.layer_css = '';
		store.data.styles.max_width = '100%';
		for (const key of Object.keys(store.data.cssTexts)) store.data.cssTexts[key as keyof typeof store.data.cssTexts] = '';
		store.data.others.direction = 0;
		store.data.others.overlapping = 0;
		Date.now = () => 1000;
		globalThis.getComputedStyle = (elem: Element) => {
			if (elem instanceof HostStub) return elem.getComputedStyle();
			const fake = elem as unknown as ElementStub;
			fake.reads.style++;
			return { fontSize: `${fake.fontSize}px`, lineHeight: `${fake.fontSize * Number(store.data.styles.line_height)}px`, animationDuration: '8s' } as CSSStyleDeclaration;
		};
		try { run(); } finally {
			Object.assign(store.data.styles, before.styles);
			Object.assign(store.data.others, before.others);
			Object.assign(store.data.cssTexts, before.cssTexts);
			globalThis.getComputedStyle = previousStyle;
			Math.random = previousRandom;
			Date.now = previousNow;
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
		const result = cache.get('target')![0];
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
	assertEquals(cache.get('wrapped')![0].height, 30);
	assertEquals(cache.get('wrapped')!.length, 3);
});

test('a tall bottom-up message cannot enclose a preceding shorter message', () => {
	store.data.others.direction = 1;
	const { cache, element } = fixture();
	layoutChatItem(element('short').element, cache);
	const target = element('tall', { height: 20 });
	layoutChatItem(target.element, cache);
	assertEquals(target.attributes.get('data-line'), '1');
	assertEquals(cache.get('tall')![0].isCollidable(cache.get('short')![0]), false);
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
	assertEquals(cache.get('third')![0].isOverflow(cache.dom.host.getBoundingClientRect()), false);
});

test('subpixel rectangle rounding at the bottom edge keeps the first lane usable', () => {
	store.data.others.direction = 1;
	const { cache, element } = fixture();
	const target = element('rounded', { rectOffset: .000041961669921875 });
	layoutChatItem(target.element, cache);
	assertEquals(target.classes.has('overlap'), false);
	assertEquals(target.style.bottom, '0em');
	const layout = cache.get('rounded')![0];
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
	assertEquals(cache.get('overlap')!.length, 2);
	assertEquals(cache.get('overlap')![0].top, target.getBoundingClientRect().top);
	assertEquals(target.style.opacity, '0.6400000000000001');
	assertEquals(target.style.zIndex, '-2');
});

test('random placement consumes remaining lanes with fixed-zero randomness', () => {
	Math.random = () => 0;
	const { cache, element } = fixture(3);
	for (let i = 0; i < 3; i++) layoutChatItem(element(`full-${i}`).element, cache);
	const target = element('random');
	layoutChatItem(target.element, cache, 'random');
	assertEquals(target.attributes.get('data-line'), '2');
	assertEquals(target.reads.rect, 1);
});

test('random saturation retains a fitting lane instead of an overflowing one', () => {
	Math.random = () => 0;
	store.data.others.direction = 1;
	const { cache, element } = fixture(10, host => { host.clientHeight = 25; });
	layoutChatItem(element('first').element, cache);
	layoutChatItem(element('second').element, cache);
	const target = element('random');
	layoutChatItem(target.element, cache, 'random');
	assertEquals(target.attributes.get('data-line'), '1');
	assertEquals(cache.get('random')![0].isOverflow(cache.dom.host.getBoundingClientRect()), false);
});

test('zero lanes are safe in dense and random modes', () => {
	for (const mode of ['dense', 'random'] as const) {
		const { cache, element } = fixture(0);
		const target = element(mode);
		assertEquals(layoutChatItem(target.element, cache, mode), mode);
		assertEquals(target.attributes.get('data-line'), '0');
		assertEquals(cache.get(mode), undefined);
	}
});

test('scaled host placement and speed stay in viewport coordinates', () => {
	const { cache, element } = fixture(10, host => { host.scaleY = 2; host.scaleX = 1.5; });
	layoutChatItem(element('first').element, cache);
	const target = element('scaled');
	layoutChatItem(target.element, cache);
	const layout = cache.get('scaled')![0];
	assertEquals(target.attributes.get('data-line'), '1');
	assertEquals(layout.top, target.getBoundingClientRect().top);
	assertEquals(layout.height, 20);
	assertAlmostEquals(layout.speed, 120 * 1.5 / 8000);
	assertEquals(cache.get('scaled')!.length, 1);
});

for (const measured of [false, true]) {
	for (const direction of [0, 1]) {
		for (const mode of ['dense', 'random'] as const) {
			test(`fractional host fills every lane (${measured ? 'measured' : 'numeric'}, direction ${direction}, ${mode})`, () => {
				store.data.styles.line_height = '1.4';
				store.data.styles.layer_css = measured ? 'color: white' : '';
				store.data.others.direction = direction;
				Math.random = () => 0;
				const { cache, element } = fixture(8, host => {
					host.width = 659.0117797851562;
					host.height = 370.6941223144531;
				});
				for (let line = 0; line < 8; line++) {
					const target = element(`fractional-${line}`, { fontForLine: () => 32, height: 44.80004 });
					layoutChatItem(target.element, cache, mode);
					assertEquals(target.attributes.get('data-line'), `${line}`);
					assertEquals(target.classes.has('overlap'), false);
					assertEquals(cache.get(target.id)!.length, 1);
					assertAlmostEquals(cache.get(target.id)![0].top, target.getBoundingClientRect().top);
					assertAlmostEquals(cache.get(target.id)![0].speed, (659 + 20) / 8000);
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
			const layout = cache.get(target.id)![0];
			assertEquals(target.attributes.get('data-line'), `${line}`);
			assertEquals(cache.get(target.id)!.length, 1);
			assertAlmostEquals(layout.top, target.getBoundingClientRect().top);
			assertAlmostEquals(layout.speed, (656 + 20) * 1.5 / 8000);
		}
	});
}

test('subpixel tolerance still rejects a real vertical overlap', () => {
	const { cache, element } = fixture();
	layoutChatItem(element('tall', { height: 10.02 }).element, cache);
	const target = element('next');
	layoutChatItem(target.element, cache);
	assertEquals(target.attributes.get('data-line'), '2');
	assertEquals(cache.get('tall')!.length, 2);
});

test('positive subpixel height still occupies a lane', () => {
	const { cache, element } = fixture();
	const target = element('tiny', { height: .005 });
	layoutChatItem(target.element, cache);
	assertEquals(cache.get('tiny')!.length, 1);
});

test('custom CSS keeps measuring lane-dependent em positions', () => {
	store.data.cssTexts[''] = '[data-line="1"] { font-size: 20px }';
	const { cache, element } = fixture();
	layoutChatItem(element('first').element, cache);
	const target = element('custom', { fontForLine: line => line === 1 ? 20 : 10 });
	layoutChatItem(target.element, cache);
	assertEquals(target.style.top, '1em');
	assertEquals(cache.get('custom')![0].top, target.getBoundingClientRect().top);
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
	assertEquals(cache.get('custom-overlap')![0].top, target.getBoundingClientRect().top);
	assertEquals(cache.get('custom-overlap')![0].height, 20);
});

function hostHeight(cache: LiveChatLayoutCache, height: number) {
	(cache.dom.host as unknown as HostStub).clientHeight = height;
}

test('element-identity deletion preserves a newer layout with the same id', () => {
	const { cache, element } = fixture();
	const old = element('same');
	layoutChatItem(old.element, cache);
	const replacement = element('same');
	cache.delete('same');
	layoutChatItem(replacement.element, cache);
	assertEquals(cache.deleteElement(old.element).some(Boolean), false);
	assertEquals(cache.get('same')![0].matchesElement(replacement.element), true);
	assertEquals(cache.deleteElement(replacement.element).some(Boolean), true);
	assertEquals(cache.get('same'), undefined);
});
