/// <reference path="../../extends.d.ts" />
/// <reference path="../../ytlivechatrenderer.d.ts" />

/**
 * @param {any} response 
 * @param {Map<number, LiveChat.LiveChatItemAction[]>} outMap 
 * @param {AbortSignal} signal
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
 * @param {AbortSignal} signal 
 * @param {string} initialContinuation 
 * @param {boolean} [isReplay=false] 
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
	clientVersion: '2.20240731.40.00',
	mainAppWebInfo: { graftUrl: location.href },
};

/**
 * @param {URL} url URL
 * @param {string} continuation continuation token
 * @returns {Promise<any>} livechat contents object
 */
function getContentsAsync(url, continuation) {
	const stored = sessionStorage.getItem('ytlcf-cfg');
	const client = stored && JSON.parse(stored)?.data_?.['INNERTUBE_CONTEXT']?.client || defaultClient;
	return fetch(url, {
		method: 'post',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			context: { client },
			continuation,
		}),
	})
	.then(res => {
		if (res.ok) return res.json();
		else throw 'Request failed.';
	})
	.then(json => json?.continuationContents?.liveChatContinuation)
	.catch(reason => {
		console.error(reason);
		const c = {
			liveChatReplayContinuationData: { continuation },
			invalidationContinuationData: { continuation },
		};
		return { continuations: [ c ] };
	});
}

/**
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
 * @param {number} ms 
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