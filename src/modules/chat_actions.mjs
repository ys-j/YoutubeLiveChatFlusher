import { fetchInnerTube } from './innertube.mjs';

export class ReplayActionBuffer {
	/** @type {Map<number, Set<LiveChat.LiveChatItemAction>>} */
	#map = new Map();
	/** @type {number[]} */
	#sortedTimes = [];
	#lastOffset = 0;

	/**
	 * Parses the raw replay actions and adds them to buffer.
	 * @param {LiveChat.ReplayChatItemAction[]} rawActions
	 */
	pushActions(rawActions) {
		let sortNeeded = false;
		for (const container of rawActions) {
			const rawAction = container.replayChatItemAction;
			const time = +rawAction.videoOffsetTimeMsec;
			const actions = rawAction.actions;

			let set = this.#map.get(time);
			if (!set) {
				set = new Set();
				this.#map.set(time, set);
				this.#sortedTimes.push(time);
				sortNeeded = true;
			}
			for (const a of actions) set.add(a);
		}
		if (sortNeeded) this.#sortedTimes.sort((a, b) => a - b);
	}

	/**
	 * Gets the pending actions between the last offset and the current one.
	 * @param {number} currentOffset
	 * @returns {LiveChat.LiveChatItemAction[]}
	 */
	getPendingActions(currentOffset) {
		if (currentOffset < this.#lastOffset) {
			this.update(currentOffset - 1000);
		}
		/** @type {LiveChat.LiveChatItemAction[]} */
		const result = [];
		const lowerBound = this.#lastOffset + 1;
		if (currentOffset < lowerBound || this.#sortedTimes.length === 0) {
			this.update(currentOffset);
			return result;
		}
		const startIndex = binarySearch(this.#sortedTimes, lowerBound);
		for (let i = startIndex, l = this.#sortedTimes.length; i < l; i++) {
			const time = this.#sortedTimes[i];
			if (time > currentOffset) break;
			this.#map.get(time)?.forEach(a => result.push(a));
		}
		this.update(currentOffset);
		return result;
	}

	clear() {
		this.#map.clear();
		this.#sortedTimes.length = 0;
		this.#lastOffset = 0;
	}

	/**
	 * @param {number} offset
	 */
	update(offset) {
		this.#lastOffset = offset;
	}

	get size() {
		return this.#map.size;
	}
}

/**
 * Generates the replay chat actions from the response of InnerTube API.
 * @param {AbortSignal} signal signal for aborting fetching
 * @param {string} initialContinuation initial continuation token
 * @returns {AsyncGenerator<LiveChat.ReplayChatItemAction[]>} chat actions generator
 */
export async function* getReplayChatActionsAsyncIterable(signal, initialContinuation) {
	const url = new URL('/youtubei/v1/live_chat/get_live_chat_replay', location.origin);
	url.searchParams.set('prettyPrint', 'false');

	/** @type {Map<string, string>} */
	const continuations = new Map();
	/** @type { { continuation: string } } */
	let body = { continuation: initialContinuation };
	/** @type { { actions: LiveChat.ReplayChatItemAction[] } } */
	let contents = { actions: [] };

	/** @type { { offset: number } | undefined } */
	let seekInfo;
	let controller = new AbortController();
	signal.addEventListener('ytlcf-seek', e => {
		seekInfo = /** @type { { offset: number } } */ (e.detail);
		controller.abort();
	}, { passive: true });

	let prev = body.continuation;
	let prevOffset = 0;
	while (!signal.aborted && prev) {
		let i = 0;
		while (continuations.has(prev) && ++i < continuations.size) {
			if (isCyclicMap(continuations)) return [];
			prev = continuations.get(prev) || '';
			body = { continuation: prev };
		}
		contents = await getContentsAsync(url, body);
		let sleepMs = 250;
		if (contents.actions) yield contents.actions;
		if (seekInfo) {
			body = getContinuation(contents, true, seekInfo.offset);
			prevOffset = seekInfo.offset;
			seekInfo = undefined;
			controller.abort();
		} else {
			body = getContinuation(contents, true);
			if (prev !== initialContinuation) continuations.set(prev, body.continuation);
			const offset = Number.parseInt(contents.actions?.at(-1)?.replayChatItemAction.videoOffsetTimeMsec || '-1', 10);
			if (offset >= prevOffset) {
				const playbackRate = JSON.parse(sessionStorage.getItem('yt-player-playback-rate') || `{"data":"1"}`).data || '1';
				const offsetDiff = (offset - prevOffset) / Number.parseFloat(playbackRate) - 250 | 0;
				sleepMs = Math.max(250, offsetDiff);
				prevOffset = offset;
			} else {
				sleepMs = Infinity;
				continuations.clear();
			}
		}
		prev = body.continuation;
		controller = new AbortController();
		await sleep(sleepMs, { signal: controller.signal });
	}
}

/**
 * Generates the live chat actions from the response of InnerTube API.
 * @param {AbortSignal} signal signal for aborting fetching
 * @param {string} initialContinuation initial continuation token
 * @returns {AsyncGenerator<LiveChat.LiveChatItemAction[]>} empty generator
 */
export async function* getLiveChatActionsAsyncIterable(signal, initialContinuation) {
	const url = new URL('/youtubei/v1/live_chat/get_live_chat', location.origin);
	url.searchParams.set('prettyPrint', 'false');

	/** @type { { continuation: string } } */
	let body = { continuation: initialContinuation };
	/** @type { { actions: LiveChat.LiveChatItemAction[] } } */
	let contents = { actions: [] };
	while (!signal.aborted && body.continuation) {
		contents = await getContentsAsync(url, body);
		yield contents.actions || [];
		body = getContinuation(contents, false);
		await sleep(250);
	}
}

/**
 * Fetches the livechat contents object from the given URL and continuation token.
 * @param {URL} url URL
 * @param { { continuation: string } } body continuation token container
 * @returns {Promise<any>} livechat contents object
 */
async function getContentsAsync(url, body) {
	try {
		const json = await fetchInnerTube(url, body, { auth: true });
		return json.continuationContents?.liveChatContinuation;
	} catch (reason) {
		console.error(reason);
		const c = {
			liveChatReplayContinuationData: body,
			invalidationContinuationData: body,
		};
		return { continuations: [ c ] };
	}
}

/**
 * Gets the continuation token from the livechat contents object.
 * @param {any} contents livechat contents object
 * @param {boolean} isReplay if is replay
 * @param {number} [offset] player offset (milliseconds)
 * @returns { { continuation: string, currentPlayerState?: { playerOffsetMs: string } } } continuation token
 */
function getContinuation(contents, isReplay, offset) {
	const c = contents?.continuations?.at(offset ? -1 : 0);
	if ('playerSeekContinuationData' in c) {
		return {
			continuation: c?.playerSeekContinuationData?.continuation,
			currentPlayerState: { playerOffsetMs: (offset || 0).toString() },
		};
	} else {
		const continuation = isReplay
			? c?.liveChatReplayContinuationData?.continuation
			: c?.invalidationContinuationData?.continuation || c?.timedContinuationData?.continuation;
		return { continuation };
	}
}

/**
 * Waits for the given number of milliseconds.
 * @param {number} ms milliseconds
 * @param {object} [options] options
 * @param {AbortSignal} [options.signal] signal for aborting sleep
 * @returns {Promise<void>} void promise
 */
function sleep(ms, { signal } = {}) {
	/** @type {PromiseWithResolvers<void>} */
	const { promise, resolve } = Promise.withResolvers();
	if (signal?.aborted) {
		resolve();
		return promise;
	}
	/** @type {number | undefined} */
	let timer = undefined;
	const onDone = () => {
		clearTimeout(timer);
		signal?.removeEventListener('abort', onDone);
		resolve();
	};
	if (ms > 0 && Number.isFinite(ms)) timer = setTimeout(onDone, ms);
	signal?.addEventListener('abort', onDone, { once: true });
	return promise;
}

/**
 * Determines whether the map is cyclic.
 * @param {Map<any, any>} map map object
 * @returns {boolean} if the map is cyclic
 */
function isCyclicMap(map) {
	const iter = map.entries();
	const { value, done } = iter.next();
	if (done) return false;

	const [firstKey, firstVal] = value;
	let prevVal = firstVal;
	for (const [key, val] of iter) {
		if (key !== prevVal) return false;
		prevVal = val;
	}
	return prevVal === firstKey;
}

/**
 * Finds the lowest index in a sorted array where the element is greater than or equal to the target value.
 * @param {number[]} arr sorted array of numbers
 * @param {number} target the value to search for
 * @returns {number} the index of lower bound
 */
function binarySearch(arr, target) {
	let low = 0;
	let high = arr.length;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (arr[mid] < target) low = mid + 1;
		else high = mid;
	}
	return low;
}
