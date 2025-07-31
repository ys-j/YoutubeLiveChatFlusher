/// <reference path="../../extends.d.ts" />
/// <reference path="../../ytlivechatrenderer.d.ts" />

/**
 * Fetches the chat actions from the page response.
 * @param {any} response response of the video watching page
 * @param {Map<number, LiveChat.LiveChatItemAction[]>} outMap (mutating) container of chat actions
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
		const generator = getChatActionsAsyncIterable(signal, continuation, isReplay);
		for await (const actions of generator) {
			for (const container of actions) {
				const action = container?.replayChatItemAction;
				const key = Number.parseInt(action.videoOffsetTimeMsec);
				if (outMap.has(key)) {
					outMap.get(key)?.push(...action.actions);
				} else {
					outMap.set(key, action.actions);
				}
			}
		}
		return true;
	} else {
		throw 'This video has no chat.';
	}
}

/**
 * Generates the chat actions from the response of InnerTube API.
 * @param {AbortSignal} signal signal for aborting fetching
 * @param {string} initialContinuation initial continuation token
 * @param {boolean} [isReplay=false] if is replay
 * @yields {LiveChat.ReplayChatItemAction[]} chat actions
 */
async function* getChatActionsAsyncIterable(signal, initialContinuation, isReplay = false) {
	const url = new URL('/youtubei/v1/live_chat/get_live_chat' + (isReplay ? '_replay' : ''), location.origin);
	url.searchParams.set('prettyPrint', 'false');

	/** @type {string?} */
	let continuation = initialContinuation;
	if (isReplay) {
		/** @type { { actions: LiveChat.ReplayChatItemAction[] } } */
		let contents = { actions: [] };
		while (!signal.aborted && continuation && contents.actions) {
			contents = await getContentsAsync(url, continuation);
			yield contents.actions || [];
			continuation = getContinuation(contents, isReplay);
		}
	} else {
		/** @type { { actions: LiveChat.LiveChatItemAction[] } } */
		let contents = { actions: [] };
		let lastTimestamp = 0;
		const getTimestamp = a => {
			/** @type {LiveChat.RendererContent} */
			const renderer = Object.values(a.addChatItemAction.item).at(0);
			return Number.parseInt(renderer?.timestampUsec);
		}
		while (!signal.aborted && continuation) {
			contents = await getContentsAsync(url, continuation);
			if (contents.actions) {
				// Fire actions directly.
				const filtered = contents.actions.filter(a => !('addChatItemAction' in a) || getTimestamp(a) > lastTimestamp);
				const ev = new CustomEvent('ytlcf-actions', { detail: filtered });
				self.dispatchEvent(ev);
				const lastIndex = filtered.findLastIndex(a => 'addChatItemAction' in a);
				if (lastIndex > 0) lastTimestamp = getTimestamp(filtered[lastIndex]);
			}
			continuation = getContinuation(contents, isReplay);
			await sleep(200);
		}
	}
}

const defaultClient = {
	clientName: 'WEB',
	clientVersion: '2.20250730.01.00',
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
 * @param {string} continuation continuation token
 * @returns {Promise<any>} livechat contents object
 */
async function getContentsAsync(url, continuation) {
	const stored = sessionStorage.getItem('ytlcf-cfg');
	const data = stored ? JSON.parse(stored)?.data_ : null;
	const client = data?.['INNERTUBE_CONTEXT']?.client || defaultClient;
	const headers = new Headers();
	headers.append('Content-Type', 'application/json');
	if (data) headers.append('Authorization', await getAuthoricationAsync(data));
	try {
		const res = await fetch(url, {
			method: 'post',
			headers,
			body: JSON.stringify({
				context: { client },
				continuation,
			}),
		});
		const json = res.ok ? await res.json() : null;
		if (!json) throw 'Request failed.';
		return json.continuationContents?.liveChatContinuation;
	} catch (reason) {
		console.error(reason);
		const c = {
			liveChatReplayContinuationData: { continuation },
			invalidationContinuationData: { continuation },
		};
		return { continuations: [ c ] };
	}
}

/**
 * Gets the continuation token from the livechat contents object.
 * @param {any} contents livechat contents object
 * @param {boolean} isReplay if is replay
 * @returns {string?} continuation token
 */
function getContinuation(contents, isReplay) {
	const c = contents?.continuations?.[0];
	if (isReplay) {
		return c?.liveChatReplayContinuationData?.continuation;
	} else {
		return c?.invalidationContinuationData?.continuation || c?.timedContinuationData?.continuation;
	}
}

/**
 * Waits for the given number of milliseconds.
 * @param {number} ms milliseconds
 */
function sleep(ms) {
	/** @type {Promise<void>} */
	const promise = new Promise(resolve => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
	return promise;
}