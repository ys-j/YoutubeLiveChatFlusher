import { store } from './store.mjs';
import { isNotPip } from './utils.mjs';

import { LiveChatController } from './chat_controller.mjs';
import { ReplayActionBuffer, getReplayChatActionsAsyncIterable, getLiveChatActionsAsyncIterable } from './chat_actions.js';
import { initPipMenu } from './pip.js';

const state = {
	isLive: false,
	succeeded: true,
	action: new ReplayActionBuffer(),
	abortController: new AbortController(),
	/** @type {LiveChatController?} */
	controller: null,

	reset() {
		this.abortController.abort();
		this.abortController = new AbortController();
		this.action.clear();
		this.controller?.close();
	},
};

/**
 * @typedef NavigateFinishEventDetail
 * @prop {string} pageType
 * @prop {object} response
 * @prop {any} response.response
 * @prop {any} response.playerResponse
 * @prop {any} [response.contents]
 */

/**
 * @param { CustomEvent<NavigateFinishEventDetail> | { target: EventTarget, detail: NavigateFinishEventDetail } } e 
 */
export async function initialize(e) {
	// run app
	const player = /** @type {HTMLElement} */ (e.target);
	state.controller = new LiveChatController(player);
	await state.controller.start().then(() => {
		self.dispatchEvent(new CustomEvent('ytlcf-ready'));
		initPipMenu();
	}).catch(reason => {
		console.warn(reason);
		state.succeeded = false;
	});
	if (state.succeeded) {
		self.addEventListener('yt-navigate-finish', onYtNavigateFinish, { passive: true });
		onYtNavigateFinish(e);
	} else {
		self.addEventListener('yt-navigate-finish', initialize, { passive: true, once: true });
		return;
	}

	// when page load started
	self.addEventListener('yt-navigate-start', () => {
		state.reset();
	}, { passive: true });

	document.body.addEventListener('keydown', e => {
		if (e.repeat) return;
		switch (e.key) {
			case store.hotkeys.layer: {
				const checkbox = /** @type {HTMLElement?} */ (player.querySelector('#yt-lcf-cb'));
				checkbox?.click();
				break;
			}
			case store.hotkeys.panel: {
				const popupmenu = /** @type {HTMLElement?} */ (player.querySelector('#yt-lcf-pm'));
				popupmenu?.click();
				break;
			}
		}
	}, { passive: true });
}


/**
 * @this {HTMLVideoElement}
 */
function onSeeking() {
	const shiftSec = !state.isLive && store.others.time_shift || 0;
	const currentOffset = (this.currentTime - shiftSec) * 1000 | 0;
	const ev = new CustomEvent('ytlcf-seek', { detail: { offset: currentOffset } });
	state.abortController.signal.dispatchEvent(ev);
	state.action.update(currentOffset);
}

/**
 * @this {HTMLVideoElement}
 */
function onTimeUpdate() {
	const shiftSec = !state.isLive && store.others.time_shift || 0;
	const player = state.controller?.layer.element.parentElement;
	if (player) {
		const isAdShowing = ['ad-showing', 'ad-interrupting'].map(c => player.classList.contains(c)).includes(true);
		if (isAdShowing) return;
	}
	const currentOffset = (this.currentTime - shiftSec) * 1000 | 0;
	const pendingActions = state.action.getPendingActions(currentOffset);
	if (pendingActions.length > 0) {
		const ev = new CustomEvent('ytlcf-action', { detail: pendingActions });
		state.controller?.dispatchEvent(ev);
	}
}

/**
 * @param { CustomEvent<NavigateFinishEventDetail> | { target: EventTarget, detail: NavigateFinishEventDetail } } e 
 */
async function onYtNavigateFinish(e) {
	self.addEventListener('ytlcf-start', () => {
		state.controller?.listen();
	}, { passive: true, once: true });
	if (e.detail?.pageType !== 'watch') return;
	
	/** @type {HTMLVideoElement | null | undefined} */
	const video = (isNotPip() ? self : self.documentPictureInPicture?.window)?.document.querySelector('#movie_player video');
	const videoContainer = video?.parentElement;
	if (!videoContainer) return;
	const parent = videoContainer.parentElement;
	if (state.controller?.layer && parent?.contains(state.controller.layer.element)) {
		videoContainer.after(state.controller.layer.element);
	}
	const mainResponse = e.detail?.response;
	const response = (mainResponse && 'contents' in mainResponse) ? mainResponse : mainResponse?.response;
	if (!response) return;
	const videoDetails = mainResponse?.playerResponse?.videoDetails
		|| mainResponse.contents?.twoColumnWatchNextResults?.results?.results?.contents?.at(0)?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer;
	state.isLive = videoDetails?.isLive || videoDetails?.isUpcoming || false;

	const modeName = state.isLive ? 'mode_livestream' : 'mode_replay';
	const modeValue = store.others?.[modeName] ?? 1;
	if (modeValue === 0) return;

	let timer = 0;
	timer = setInterval(() => {
		if (state.action.size > 0) {
			clearInterval(timer);
			video.addEventListener('seeking', onSeeking, { passive: true });
			video.addEventListener('timeupdate', onTimeUpdate, { passive: true });
		}
	}, 250);
	video.removeEventListener('seeking', onSeeking);
	video.removeEventListener('timeupdate', onTimeUpdate);

	// Fetching chat actions async
	const liveChatRenderer = response?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer
		?? response?.contents?.singleColumnWatchNextResults?.results?.results;
	/** @type {string?} */
	const initialContinuation = liveChatRenderer?.continuations?.at(0)?.reloadContinuationData?.continuation;
	if (!initialContinuation) {
		const message = `This video has no chat: ${videoDetails?.videoId || 'failed to get video id'}`;
		console.warn(message);
		clearInterval(timer);
		return;
	}
	state.controller?.listen();
	if (state.isLive) {
		const generator = getLiveChatActionsAsyncIterable(state.abortController.signal, initialContinuation);
		for await (const actions of generator) {
			const ev = new CustomEvent('ytlcf-action', { detail: actions });
			state.controller?.dispatchEvent(ev);
		}
	} else {
		setTimeout(() => onSeeking.call(video), 250);
		const generator = getReplayChatActionsAsyncIterable(state.abortController.signal, initialContinuation);
		for await (const actions of generator) {
			state.action.pushActions(actions);
		}
	}
	clearInterval(timer);
}