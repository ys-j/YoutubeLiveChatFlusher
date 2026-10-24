// Run: deno test --allow-read test/chat_layer_test.ts
// A checkout file URL after -- selects regression source.
import './_globals.mjs';
import { assertEquals } from '@std/assert';

const sourceRoot = new URL(Deno.args[0] ?? '../', import.meta.url);
const source = Deno.readTextFileSync(new URL('src/modules/chat_layer.mjs', sourceRoot));

function fixture() {
	let resize = () => {};
	let notify = (_records: { removedNodes: FakeElement[] }[], _observer?: unknown) => {};
	let pending: { removedNodes: FakeElement[] }[] = [];
	// Mimics the observer instance the real MutationObserver passes as the callback's 2nd arg.
	const observerStub = {
		takeRecords() { const records = pending; pending = []; return records; },
		disconnect() {},
		observe() {},
	};
	class FakeElement {
		id = '';
		parentNode: FakeElement | null = null;
		children: FakeElement[] = [];
		style = { display: '', setProperty() {} };
		hidden = false;
		ariaHidden = 'false';
		tabIndex = 0;
		constructor(tagName = 'DIV') { this.tagName = tagName; }
		tagName: string;
		get childElementCount() { return this.children.length; }
		setAttribute() {}
		attachShadow() { return new FakeElement('SHADOW'); }
		getBoundingClientRect() { return { width: 0, height: 0 }; }
		querySelectorAll() { return this.children.filter(node => ['LINK', 'STYLE'].includes(node.tagName)); }
		append(...nodes: FakeElement[]) {
			for (const node of nodes) {
				if (node.parentNode) node.remove();
				node.parentNode = this;
				this.children.push(node);
			}
			pending.push({ removedNodes: [] });
		}
		remove() {
			if (!this.parentNode) return;
			const siblings = this.parentNode.children;
			siblings.splice(siblings.indexOf(this), 1);
			this.parentNode = null;
			pending.push({ removedNodes: [this] });
		}
		replaceChildren(...nodes: FakeElement[]) {
			for (const node of [...this.children]) node.remove();
			this.append(...nodes);
		}
	}
	const layouts = new Map<string, { element: FakeElement }>();
	const layoutCache = {
		clear: () => layouts.clear(),
		delete(id: string) {
			layouts.delete(id);
		},
		deleteElement(element: FakeElement) {
			if (layouts.get(element.id)?.element === element) layouts.delete(element.id);
		},
	};
	const controller = { panel: {}, layoutCache: undefined as typeof layoutCache | undefined };
	const bindings = {
		HTMLElement: FakeElement,
		document: { createElement: (tag: string) => new FakeElement(tag.toUpperCase()) },
		browser: { runtime: { getURL: (path: string) => path } },
		s: { others: { px_per_sec: 0 }, styles: { animation_duration: '8s' } },
		ResizeObserver: class {
			constructor(callback: () => void) { resize = callback; }
			observe() {}
		},
		MutationObserver: class {
			constructor(callback: typeof notify) { notify = callback; }
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
	function add(id: string) {
		const node = new FakeElement();
		node.id = id;
		layer.root.append(node);
		layouts.set(id, { element: node });
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
	assertEquals(f.layer.root.children.slice(3).map((node: { id: string }) => node.id), ['second', 'newest']);
	assertEquals([...f.layouts.keys()], ['second', 'newest']);
});

Deno.test('arbitrary removal and replacement release the removed element only', () => {
	const f = fixture();
	f.add('removed').remove();
	const replaced = f.add('replaced');
	replaced.remove();
	f.add('replacement');
	f.flush();
	assertEquals([...f.layouts.keys()], ['replacement']);
});

Deno.test('remove and reappend preserves the same cached element', () => {
	const f = fixture();
	const node = f.add('same');
	node.remove();
	f.layer.root.append(node);
	f.flush();
	assertEquals(f.layouts.get('same')?.element, node);
});

Deno.test('old same-ID removal does not delete a newly laid out replacement', () => {
	const f = fixture();
	f.add('same').remove();
	const replacement = f.add('same');
	f.flush();
	assertEquals(f.layouts.get('same')?.element, replacement);
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
