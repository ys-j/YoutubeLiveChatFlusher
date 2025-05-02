/**
 * @param {any} response 
 * @param {Map<number, LiveChat.LiveChatItemAction[]>} outMap 
 * @return {Promise<boolean>} if video has chat
 */
export async function fetchChatActions(response, outMap) {
	const liveChatRenderer = response?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer;
	/** @type {boolean} */
	const isReplay = liveChatRenderer?.isReplay || false;
	/** @type {string?} */
	const continuation = liveChatRenderer?.continuations?.[0]?.reloadContinuationData?.continuation;
	if (continuation) {
		outMap.clear();
		const generator = getChatActionsAsyncIterable(continuation, isReplay);
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
		// return false;
	}
}

/**
 * @param {string} initialContinuation 
 * @param {boolean} [isReplay=false] 
 */
async function* getChatActionsAsyncIterable(initialContinuation, isReplay = false) {
	const url = new URL('/youtubei/v1/live_chat/get_live_chat' + (isReplay ? '_replay' : ''), location.origin);
	url.searchParams.set('prettyPrint', 'false');

	/** @type {string?} */
	let continuation = initialContinuation;
	let contents = { actions: [] };
	while (continuation && contents.actions) {
		contents = await getContentsAsync(url, continuation);
		yield /** @type { LiveChat.ReplayChatItemAction[] } */ (contents.actions || []);
		continuation = getContinuation(contents);
	}
}

/**
 * @param {URL} url URL
 * @param {string} continuation continuation token
 * @returns {Promise<any>} livechat contents object
 */
async function getContentsAsync(url, continuation) {
	const json = await fetch(url, {
		method: 'post',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			context: {
				client: {
					clientName: 'WEB',
					clientVersion: '2.20240731.40.00',
					mainAppWebInfo: { graftUrl: location.href },
				},
			},
			continuation,
		}),
	}).then(res => res.json());
	return json?.continuationContents?.liveChatContinuation;
}

/**
 * @param {any} contents livechat contents object
 * @returns {string?} continuation token
 */
function getContinuation(contents) {
	for (const c of contents?.continuations || []) {
		if ('liveChatReplayContinuationData' in c) {
			return c.liveChatReplayContinuationData?.continuation;
		}
	}
	return null;
}