import './_globals.mjs';

import { assertEquals } from '@std/assert';
import { LiveChatLayoutCache } from '../src/modules/chat_layout.mjs';

/**
 * Minimal ShadowRoot stub. The tests only exercise LiveChatLayoutCache's lane
 * bookkeeping, and none of the exercised methods touch `.dom`, so an empty
 * object is safe here — we just need it to satisfy the `ShadowRoot` parameter.
 * @returns {ShadowRoot}
 */
function fakeDom() {
	return /** @type {ShadowRoot} */ (/** @type {unknown} */ ({}));
}

/**
 * The cache is keyed by the laid-out element, so the tests only need distinct
 * object identities as keys; the real DOM is not involved here.
 * @param {string} id label used to keep the test readable
 * @returns {HTMLElement}
 */
function elem(id) {
	return /** @type {HTMLElement} */ (/** @type {unknown} */ ({ id }));
}

/**
 * Builds a minimal layout record for the pure data-structure tests.
 * The real ChatLayoutInfo needs a DOM element; here we only exercise
 * LiveChatLayoutCache which reads lineStart / lineEnd.
 * @param {number} lineStart
 * @param {number} lineEnd
 * @returns {Parameters<LiveChatLayoutCache['set']>[1]} minimal stand-in for the DOM-backed type
 */
function layout(lineStart, lineEnd) {
	return /** @type {Parameters<LiveChatLayoutCache['set']>[1]} */ (/** @type {unknown} */ ({ lineStart, lineEnd }));
}

Deno.test('constructor allocates the requested number of lanes', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 3);
	assertEquals(cache.get(elem('missing')), undefined);
	assertEquals(cache.distinctSize, 0);
});

Deno.test('set places a layout across its lane range and get returns it', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	const target = elem('msg-1');
	cache.set(target, layout(0, 2)); // occupies lanes 0 and 1

	assertEquals(cache.get(target), [layout(0, 2), layout(0, 2)]);
});

Deno.test('set with an empty lane range stores nothing', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	const target = elem('empty');
	cache.set(target, layout(3, 3)); // lineStart === lineEnd
	assertEquals(cache.get(target), undefined);
	assertEquals(cache.distinctSize, 0);
});

Deno.test('set with a lane range larger than the map is clamped', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 2);
	const target = elem('wide');
	cache.set(target, layout(0, 10)); // clamped to available lanes only

	assertEquals(cache.get(target), [layout(0, 10), layout(0, 10)]);
});

Deno.test('distinctSize counts distinct layouts across lanes', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	assertEquals(cache.distinctSize, 0);

	cache.set(elem('a'), layout(0, 1)); // one lane
	cache.set(elem('b'), layout(1, 2)); // another lane
	assertEquals(cache.distinctSize, 2);

	cache.set(elem('c'), layout(0, 2)); // spans two lanes but counts once
	assertEquals(cache.distinctSize, 3);
});

Deno.test('delete removes a layout from every lane it occupies', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	const target = elem('msg-1');
	cache.set(target, layout(0, 2));

	const results = cache.delete(target);
	assertEquals(results, [true, true, false, false]);
	assertEquals(cache.get(target), undefined);
	assertEquals(cache.distinctSize, 0);
});

Deno.test('delete of an absent element returns all-false per lane', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 3);
	assertEquals(cache.delete(elem('nope')), [false, false, false]);
});

Deno.test('a removed same-id element cannot delete the replacement layout', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	const old = elem('msg-1');
	cache.set(old, layout(0, 1));
	const replacement = elem('msg-1');
	cache.set(replacement, layout(1, 2));

	cache.delete(old);
	assertEquals(cache.delete(old), [false, false, false, false]);
	assertEquals(cache.get(replacement), [layout(1, 2)]);
	assertEquals(cache.distinctSize, 1);
});

Deno.test('clear empties every lane', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	const a = elem('a');
	const b = elem('b');
	cache.set(a, layout(0, 1));
	cache.set(b, layout(1, 2));
	assertEquals(cache.distinctSize, 2);

	cache.clear();
	assertEquals(cache.distinctSize, 0);
	assertEquals(cache.delete(a), [false, false, false, false]);
});

Deno.test('resize grows and shrinks the lane count', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 2);
	cache.set(elem('a'), layout(0, 1));

	cache.resize(4); // add lanes
	assertEquals(cache.distinctSize, 1);

	cache.resize(1); // truncate to a single lane (lane 1 dropped)
	assertEquals(cache.distinctSize, 1);
});
