/// <reference path="../../extends.d.ts" />
/// <reference path="../../ytlivechatrenderer.d.ts" />

/**
 * Fetches the chat actions from the page response.
 * @param {any} response response of the video watching page
 * @param {Map<number, Set<string>>} outMap (mutating) container of chat actions stringified as JSON
 * @param {AbortSignal} signal signal for aborting fetching
 * @return {Promise<boolean>} if video has chat
 */
export async function fetchChatActions(response, outMap, signal) {
	const liveChatRenderer = response?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer;
	/** @type {boolean} */
	const isReplay = liveChatRenderer?.isReplay || false;
	/** @type {string?} */
	const continuation = liveChatRenderer?.continuations?.[0]?.reloadContinuationData?.continuation;
	if (continuation) {
		outMap.clear();
		const generator = isReplay
			? getReplayChatActionsAsyncIterable(signal, continuation)
			: getLiveChatActionsAsyncIterable(signal, continuation);
		for await (const actions of generator) {
			for (const container of actions) {
				const action = container?.replayChatItemAction;
				const key = Number.parseInt(action.videoOffsetTimeMsec);
				if (outMap.has(key)) {
					for (const a of action.actions) {
						outMap.get(key)?.add(JSON.stringify(a));
					}
				} else {
					outMap.set(key, new Set(action.actions.map(a => JSON.stringify(a))));
				}
			}
		}
		return true;
	} else {
		throw 'This video has no chat.';
	}
}

/**
 * Generates the replay chat actions from the response of InnerTube API.
 * @param {AbortSignal} signal signal for aborting fetching
 * @param {string} initialContinuation initial continuation token
 * @returns {AsyncGenerator<LiveChat.ReplayChatItemAction[]>} chat actions generator
 */
async function* getReplayChatActionsAsyncIterable(signal, initialContinuation) {
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
				const playbackRate = JSON.parse(sessionStorage.getItem('yt-player-playback-rate') || '{"data":"1"}').data || '1';
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
 * @returns {AsyncGenerator<never>} empty generator
 */
async function* getLiveChatActionsAsyncIterable(signal, initialContinuation) {
	const url = new URL('/youtubei/v1/live_chat/get_live_chat', location.origin);
	url.searchParams.set('prettyPrint', 'false');

	/** @type { { continuation: string } } */
	let body = { continuation: initialContinuation };
	/** @type { { actions: LiveChat.LiveChatItemAction[] } } */
	let contents = { actions: [] };
	let lastTimestamp = 0;
	/** @type { (a: any) => number } */
	const getTimestamp = a => {
		/** @type {LiveChat.RendererContent} */
		const renderer = Object.values(a.addChatItemAction.item).at(0);
		return Number.parseInt(renderer?.timestampUsec);
	}
	while (!signal.aborted && body.continuation) {
		contents = await getContentsAsync(url, body);
		if (contents.actions) {
			// Fire actions directly.
			const filtered = contents.actions.filter(a => !('addChatItemAction' in a) || getTimestamp(a) > lastTimestamp);
			const ev = new CustomEvent('ytlcf-actions', { detail: filtered });
			self.dispatchEvent(ev);
			const lastIndex = filtered.findLastIndex(a => 'addChatItemAction' in a);
			if (lastIndex > 0) lastTimestamp = getTimestamp(filtered[lastIndex]);
		}
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
	const data = stored ? JSON.parse(stored)?.data_ : null;
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