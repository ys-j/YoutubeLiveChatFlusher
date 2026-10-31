// Run: deno test --allow-read test/chat_layer.test.js
// A checkout file URL after -- selects regression source.
import './_globals.js';
import { assertEquals } from '@std/assert';

const sourceRoot = new URL(Deno.args[0] ?? '../', import.meta.url);
const source = Deno.readTextFileSync(new URL('src/modules/chat_layer.mjs', sourceRoot));

function fixture() {
	/** @type {() => void} */
	let resize = () => {};
	/** @type {(records: { removedNodes: FakeElement[] }[], observer?: unknown) => void} */
	let notify = () => {};
	/** @type {{ removedNodes: FakeElement[] }[]} */
	let pending = [];
	// Mimics the observer instance the real MutationObserver passes as the callback's 2nd arg.
	const observerStub = {
		takeRecords() { const records = pending; pending = []; return records; },
		disconnect() {},
		observe() {},
	};
	class FakeElement {
		id = '';
		tagName;
		/** @type {FakeElement | null} */
		parentNode = null;
		/** @type {FakeElement[]} */
		children = [];
		style = { display: '', setProperty() {} };
		hidden = false;
		ariaHidden = 'false';
		tabIndex = 0;
		/** @param {string} [tagName] */
		constructor(tagName = 'DIV') { this.tagName = tagName; }
		get childElementCount() { return this.children.length; }
		setAttribute() {}
		attachShadow() { return new FakeElement('SHADOW'); }
		getBoundingClientRect() { return { width: 0, height: 0 }; }
		querySelectorAll() { return this.children.filter(node => ['LINK', 'STYLE'].includes(node.tagName)); }
		/** @this {FakeElement} @param {...FakeElement} nodes */
		append(...nodes) {
			for (const node of nodes) {
				if (node.parentNode) node.remove();
				node.parentNode = this;
				this.children.push(node);
			}
			pending.push({ removedNodes: [] });
		}
		/** @this {FakeElement} */
		remove() {
			if (!this.parentNode) return;
			const siblings = this.parentNode.children;
			siblings.splice(siblings.indexOf(this), 1);
			this.parentNode = null;
			pending.push({ removedNodes: [this] });
		}
		/** @this {FakeElement} @param {...FakeElement} nodes */
		replaceChildren(...nodes) {
			for (const node of [...this.children]) node.remove();
			this.append(...nodes);
		}
	}
	const layouts = new Map();
	const layoutCache = {
		clear: () => layouts.clear(),
		/** @param {FakeElement} element */
		delete(element) {
			return layouts.delete(element);
		},
	};
	/** @type {{ panel: object, layoutCache: typeof layoutCache | undefined }} */
	const controller = { panel: {}, layoutCache: undefined };
	const bindings = {
		HTMLElement: FakeElement,
		document: { createElement: (/** @type {string} */ tag) => new FakeElement(tag.toUpperCase()) },
		browser: { runtime: { getURL: (/** @type {string} */ path) => path } },
		s: { others: { px_per_sec: 0 }, styles: { animation_duration: '8s' } },
		ResizeObserver: class {
			/** @param {() => void} callback */
			constructor(callback) { resize = callback; }
			observe() {}
		},
		MutationObserver: class {
			/** @param {(records: { removedNodes: FakeElement[] }[], observer?: unknown) => void} callback */
			constructor(callback) { notify = callback; }
			observe() {}
		},
	};
	const layerSource = source.slice(0, source.indexOf('export class VideoFrameSegmenter'))
		.replace(/^import .*;?\r?\n/gm, '').replace(/^export /gm, '');
	const Layer = new Function(...Object.keys(bindings), layerSource + '\nreturn LiveChatLayer;')(...Object.values(bindings));
	const layer = new Layer(controller);
	controller.layoutCache = layoutCache;
	function flush() {
		while (pending.length) {
			const records = pending;
			pending = [];
			notify(records, observerStub);
		}
	}
	/** @param {string} id */
	function add(id) {
		const node = new FakeElement();
		node.id = id;
		layer.root.append(node);
		layouts.set(node, id);
		return node;
	}
	flush();
	return { layer, layouts, add, flush, resize, FakeElement };
}

Deno.test('clear releases cached DOM references synchronously and retains styles', () => {
	const f = fixture();
	f.add('a');
	f.add('b');
	assertEquals(f.layer.clear(), f.layer);
	assertEquals(f.layouts.size, 0);
	assertEquals(f.layer.count, 0);
	assertEquals(f.layer.root.childElementCount, 3);
	f.flush();
});

Deno.test('limit evicts oldest messages and their cached references', () => {
	const f = fixture();
	f.layer.limit = 2;
	f.add('oldest');
	f.add('second');
	f.add('newest');
	f.flush();
	assertEquals(f.layer.root.children.slice(3).map((/** @type {{ id: string }} */ node) => node.id), ['second', 'newest']);
	assertEquals([...f.layouts.keys()].map(node => node.id), ['second', 'newest']);
});

Deno.test('arbitrary removal and replacement release the removed element only', () => {
	const f = fixture();
	f.add('removed').remove();
	const replaced = f.add('replaced');
	replaced.remove();
	f.add('replacement');
	f.flush();
	assertEquals([...f.layouts.keys()].map(node => node.id), ['replacement']);
});

Deno.test('remove and reappend preserves the same cached element', () => {
	const f = fixture();
	const node = f.add('same');
	node.remove();
	f.layer.root.append(node);
	f.flush();
	assertEquals(f.layouts.get(node), 'same');
});

Deno.test('old same-ID removal does not delete a newly laid out replacement', () => {
	const f = fixture();
	f.add('same').remove();
	const replacement = f.add('same');
	f.flush();
	assertEquals(f.layouts.get(replacement), 'same');
});

Deno.test('hide and resize release messages and cache through clear', () => {
	const f = fixture();
	f.add('hidden');
	f.layer.hide();
	assertEquals(f.layouts.size, 0);
	assertEquals(f.layer.count, 0);
	assertEquals(f.layer.element.hidden, true);
	f.add('resized');
	f.resize();
	assertEquals(f.layouts.size, 0);
	assertEquals(f.layer.count, 0);
	f.flush();
});

Deno.test('same-ID replacement without relayout releases the stale cache', () => {
	const f = fixture();
	const old = f.add('same');
	f.flush();
	old.remove();
	const replacement = new f.FakeElement();
	replacement.id = 'same';
	f.layer.root.append(replacement);
	f.flush();
	assertEquals(f.layouts.size, 0);
	assertEquals(f.layer.count, 1);
});

Deno.test('default limit remains unlimited', () => {
	const f = fixture();
	for (let i = 0; i < 100; i++) f.add(`${i}`);
	f.flush();
	assertEquals(f.layer.count, 100);
	assertEquals(f.layouts.size, 100);
});
