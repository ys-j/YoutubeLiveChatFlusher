/// <reference lib="esnext" />
/// <reference path="../../types/extends.d.ts" />
/// <reference path="../../types/ytlivechatrenderer.d.ts" />

export class ReplayActionBuffer {
	/** @type {Map<number, Set<string>>} */
	#map = new Map();
	#lastOffset = 0;
	
	/**
	 * Parses the raw replay actions and adds them to buffer.
	 * @param {LiveChat.ReplayChatItemAction[]} rawActions 
	 */
	pushActions(rawActions) {
		for (const container of rawActions) {
			const rawAction = container.replayChatItemAction;
			const time = Number.parseInt(rawAction.videoOffsetTimeMsec);
			const actions = rawAction.actions;
			const set = this.#map.get(time);
			if (set) {
				actions.forEach(a => set.add(JSON.stringify(a)));
			} else {
				this.#map.set(time, new Set(actions.map(a => JSON.stringify(a))));
			}
		}
	}

	/**
	 * Gets the pending actions between the last offset and the current one.
	 * @param {number} currentOffset 
	 * @returns {any[]} 
	 */
	getPendingActions(currentOffset) {
		/** @type {(time: number) => boolean} */
		const predicate = time => Math.max(this.#lastOffset, currentOffset - 1000) < time && time <= currentOffset;
		const targetKeys = Array.from(this.#map.keys().filter(predicate));
		this.#lastOffset = currentOffset;
		return Array.from(targetKeys, k => Array.from(this.#map.get(k) || [], s => JSON.parse(s))).flat();
	}

	clear() {
		this.#map.clear();
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
		// @ts-ignore
		seekInfo = /** @type { { offset: number } } */ (e.detail);
		controller.abort();
	}, { passive: true });

	let prev = body.continuation;
	let prevOffset = 0;
	while (!signal.aborted && prev) {
		let i = 0;
		while (continuations.has(prev) && ++i < continuations.size) {
			if (isRecursiveMap(continuations)) return [];
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
			const offset = Number.parseInt(contents.actions?.at(-1)?.replayChatItemAction.videoOffsetTimeMsec || '-1');
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

const defaultClient = {
	clientName: 'WEB',
	clientVersion: '2.20251022.01.00',
	mainAppWebInfo: { graftUrl: location.href },
};

/**
 * Fetches the value of Authorization header.
 * @param {Record<string, string>} data stored data
 * @returns {Promise<string>} authorization value
 */
async function getAuthoricationAsync(data) {
	const datasyncId = data['DATASYNC_ID'].split('||')[0];
	const timestamp = Math.floor(Date.now() / 1e3);
	const cookies = new Map(document.cookie.split(/;\s*/).map(kv => {
		const pos = kv.indexOf('=');
		return pos >= 0 ? [ kv.substring(0, pos), kv.substring(pos + 1) ] : [ '', '' ];
	}));
	const sApisId = cookies.get('SAPISID');
	const bytes = new TextEncoder().encode([datasyncId, timestamp, sApisId, location.origin].join(' '));
	const digested = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes));
	const hash = Array.from(digested, b => b.toString(16).padStart(2, '0')).join('');
	return ['SAPISIDHASH', 'SAPISID1PHASH', 'SAPISID3PHASH'].map(k => `${k} ${timestamp}_${hash}_u`).join(' ');
}

/**
 * Fetches the livechat contents object from the given URL and continuation token.
 * @param {URL} url URL
 * @param { { continuation: string } } body continuation token container
 * @returns {Promise<any>} livechat contents object
 */
async function getContentsAsync(url, body) {
	const stored = sessionStorage.getItem('ytlcf-cfg');
	const data = stored ? JSON.parse(stored) : null;
	const client = data?.['INNERTUBE_CONTEXT']?.client || defaultClient;
	const headers = new Headers();
	headers.set('Content-Type', 'application/json');
	if (data) headers.set('Authorization', await getAuthoricationAsync(data));
	try {
		const res = await fetch(url, {
			method: 'post',
			headers,
			body: JSON.stringify({
				context: { client },
				...body,
			}),
		});
		const json = res.ok ? await res.json() : null;
		if (!json) throw 'Request failed.';
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
function sleep(ms, options = {}) {
	/** @type {Promise<void>} */
	return new Promise(resolve => {
		const timer = Number.isFinite(ms) ? setTimeout(() => resolve(), ms) : 0;
		if (options.signal) {
			options.signal.onabort = () => {
				clearTimeout(timer);
				resolve();
			};
		}
	});
}

/**
 * Determines whether the map is recursive.
 * @param {Map<any, any>} map map object
 * @returns {boolean} if the map is recursive
 */
function isRecursiveMap(map) {
	const keys = Array.from(map.keys());
	const values = Array.from(map.values());
	values.unshift(values.pop());
	for (let i = 0; i < keys.length; i++) {
		if (keys[i] !== values[i]) return false;
	}
	return true;
};