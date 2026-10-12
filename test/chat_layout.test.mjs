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
	assertEquals(cache.get('missing'), undefined);
	assertEquals(cache.distinctSize, 0);
});

Deno.test('set places a layout across its lane range and get returns it', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	cache.set('msg-1', layout(0, 2)); // occupies lanes 0 and 1

	assertEquals(cache.get('msg-1'), [layout(0, 2), layout(0, 2)]);
});

Deno.test('set with an empty lane range stores nothing', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	cache.set('empty', layout(3, 3)); // lineStart === lineEnd
	assertEquals(cache.get('empty'), undefined);
	assertEquals(cache.distinctSize, 0);
});

Deno.test('set with a lane range larger than the map is clamped', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 2);
	cache.set('wide', layout(0, 10)); // clamped to available lanes only

	assertEquals(cache.get('wide'), [layout(0, 10), layout(0, 10)]);
});

Deno.test('distinctSize counts distinct layouts across lanes', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	assertEquals(cache.distinctSize, 0);

	cache.set('a', layout(0, 1)); // one lane
	cache.set('b', layout(1, 2)); // another lane
	assertEquals(cache.distinctSize, 2);

	cache.set('c', layout(0, 2)); // spans two lanes but counts once
	assertEquals(cache.distinctSize, 3);
});

Deno.test('delete removes a layout from every lane it occupies', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	cache.set('msg-1', layout(0, 2));

	const results = cache.delete('msg-1');
	assertEquals(results, [true, true, false, false]);
	assertEquals(cache.get('msg-1'), undefined);
	assertEquals(cache.distinctSize, 0);
});

Deno.test('delete of an absent id returns all-false per lane', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 3);
	assertEquals(cache.delete('nope'), [false, false, false]);
});

Deno.test('clear empties every lane', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 4);
	cache.set('a', layout(0, 1));
	cache.set('b', layout(1, 2));
	assertEquals(cache.distinctSize, 2);

	cache.clear();
	assertEquals(cache.distinctSize, 0);
	assertEquals(cache.delete('a'), [false, false, false, false]);
});

Deno.test('resize grows and shrinks the lane count', () => {
	const cache = new LiveChatLayoutCache(fakeDom(), 2);
	cache.set('a', layout(0, 1));

	cache.resize(4); // add lanes
	assertEquals(cache.distinctSize, 1);

	cache.resize(1); // truncate to a single lane (lane 1 dropped)
	assertEquals(cache.distinctSize, 1);
});
