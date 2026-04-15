/**
 * @template K, V
 * @typedef LRUCacheNode
 * @prop {K} key
 * @prop {V} value
 * @prop {LRUCacheNode<K, V>?} prev
 * @prop {LRUCacheNode<K, V>?} next
 */

/**
 * @template {keyof any} K
 * @template V
 */
export class LRUCache {
	/**
	 * @param {number} capacity capacity of LRU cache
	 */
	constructor(capacity) {
		if (capacity < 2) throw RangeError('Capacity must be at least 2.')
		this.limit = capacity;
		this.size = 0;
		/** @type {Record<K, LRUCacheNode<K, V>>} */
		this.cache = Object.create(null);
		/** @type {LRUCacheNode<K, V>?} */
		this.head = null;
		/** @type {LRUCacheNode<K, V>?} */
		this.tail = null;
	}

	/**
	 * @param {LRUCacheNode<K, V>} node 
	 */
	#updateMostRecent(node) {
		if (node === this.tail) return;

		// unlink this node
		if (node.prev) node.prev.next = node.next;
		if (node.next) node.next.prev = node.prev;

		if (node === this.head) this.head = node.next;

		// append (link) this node
		node.prev = this.tail;
		node.next = null;
		if (this.tail) this.tail.next = node;
		this.tail = node;
		if (!this.head) this.head = node;
	}

	/**
	 * Gets value and updates most recent list.
	 * @param {K} key 
	 * @returns {V | undefined} value
	 */
	get(key) {
		const node = this.cache[key];
		if (!node) return undefined;
		this.#updateMostRecent(node);
		return node.value;
	}

	/**
	 * Sets value to cache or updates most recent list.
	 * @param {K} key 
	 * @param {V} value 
	 */
	set(key, value) {
		/** @type {LRUCacheNode<K, V>?} */
		let node = this.cache[key];
		if (node) {
			node.value = value;
			this.#updateMostRecent(node);
			return;
		}
		if (this.size >= this.limit && this.head) {
			const recycled = this.head;
			delete this.cache[recycled.key];

			recycled.key = key;
			recycled.value = value;
			this.cache[key] = recycled;
			
			this.#updateMostRecent(recycled);
			return;
		}
		node = { key, value, prev: null, next: null };
		this.cache[key] = node;
		this.#updateMostRecent(node);
		this.size++;
	}

	/**
	 * @param {K} key 
	 */
	delete(key) {
		/** @type {LRUCacheNode<K, V>?} */
		const node = this.cache[key];
		if (!node) return false;

		delete this.cache[key];
		this.size--;
		// unlink this node
		if (node.prev) node.prev.next = node.next;
		else this.head = node.next;
		if (node.next) node.next.prev = node.prev;
		else this.tail = node.prev;
		return true;
	}
}
