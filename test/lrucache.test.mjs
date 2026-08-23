import './_globals.mjs';

import { assertEquals, assertThrows } from '@std/assert';
import { LRUCache } from '../src/modules/lrucache.mjs';

/**
	 * Walks the doubly-linked list and returns keys from oldest (head) to most recent (tail).
	 * @param {LRUCache<any, any>} cache
	 * @returns {any[]} keys ordered least- -> most-recently-used
	 */
function order(cache) {
	/** @type {any[]} */
	const out = [];
	let node = cache.head;
	while (node) {
		out.push(node.key);
		node = node.next;
	}
	return out;
}

Deno.test('constructor rejects capacity below 2', () => {
	assertThrows(() => new LRUCache(1), RangeError);
	assertThrows(() => new LRUCache(-5), RangeError);
});

Deno.test('stores and retrieves values by key', () => {
	const cache = new LRUCache(3);
	cache.set('a', 1);
	cache.set('b', 2);
	assertEquals(cache.get('a'), 1);
	assertEquals(cache.get('b'), 2);
	assertEquals(cache.size, 2);
});

Deno.test('get returns undefined for missing keys', () => {
	const cache = new LRUCache(3);
	assertEquals(cache.get('nope'), undefined);
	assertEquals(cache.size, 0);
});

Deno.test('updating an existing key refreshes its recency', () => {
	const cache = new LRUCache(3);
	cache.set('a', 1);
	cache.set('b', 2);
	cache.set('c', 3);
	// a is now the least-recently-used head.
	assertEquals(order(cache), ['a', 'b', 'c']);

	cache.get('b'); // promote b
	assertEquals(order(cache), ['a', 'c', 'b']);

	cache.set('a', 99); // update value and move a to most recent
	assertEquals(cache.get('a'), 99);
	assertEquals(order(cache), ['c', 'b', 'a']);
});

Deno.test('evicts the least-recently-used entry when over capacity', () => {
	const cache = new LRUCache(2);
	cache.set('a', 1);
	cache.set('b', 2);
	cache.set('c', 3); // evicts 'a' (oldest)

	assertEquals(cache.get('a'), undefined);
	assertEquals(cache.get('b'), 2);
	assertEquals(cache.get('c'), 3);
	assertEquals(order(cache), ['b', 'c']);
});

Deno.test('recency, not insertion order, determines eviction', () => {
	const cache = new LRUCache(2);
	cache.set('a', 1);
	cache.set('b', 2);
	cache.get('a'); // make b the oldest
	cache.set('c', 3); // should evict 'b' instead of 'a'

	assertEquals(cache.get('b'), undefined);
	assertEquals(cache.get('a'), 1);
	assertEquals(cache.get('c'), 3);
});

Deno.test('delete removes a node and reports status', () => {
	const cache = new LRUCache(3);
	cache.set('a', 1);
	cache.set('b', 2);
	cache.set('c', 3);

	assertEquals(cache.delete('b'), true);
	assertEquals(cache.get('b'), undefined);
	assertEquals(cache.size, 2);
	assertEquals(order(cache), ['a', 'c']);

	// deleting an absent key returns false without changing anything
	assertEquals(cache.delete('zzz'), false);
	assertEquals(cache.size, 2);
});

Deno.test('deleting the head or tail keeps the list intact', () => {
	const cache = new LRUCache(3);
	cache.set('a', 1);
	cache.set('b', 2);
	cache.set('c', 3);

	assertEquals(cache.delete('a'), true); // head
	assertEquals(order(cache), ['b', 'c']);
	assertEquals(cache.head?.key, 'b');

	assertEquals(cache.delete('c'), true); // tail
	assertEquals(order(cache), ['b']);
	assertEquals(cache.tail?.key, 'b');

	assertEquals(cache.delete('b'), true); // last node
	assertEquals(cache.size, 0);
	assertEquals(cache.head, null);
	assertEquals(cache.tail, null);
});

Deno.test('re-inserting a deleted key starts fresh', () => {
	const cache = new LRUCache(2);
	cache.set('a', 1);
	cache.set('b', 2);
	cache.delete('a');
	cache.set('a', 10); // 'a' becomes most recent again

	assertEquals(order(cache), ['b', 'a']);
	assertEquals(cache.get('a'), 10);
});
