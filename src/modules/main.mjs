import { logger } from './logging.mjs';
import { store } from './store.mjs';
import { getText } from './utils.mjs';

import { LiveChatController } from './chat_controller.mjs';
import { ReplayActionBuffer, getReplayChatActionsAsyncIterable, getLiveChatActionsAsyncIterable } from './chat_actions.mjs';

const state = {
	isLive: false,
	action: new ReplayActionBuffer(),
	abortController: new AbortController(),
	/** @type {?LiveChatController} */
	controller: null,

	reset() {
		this.abortController.abort();
		this.abortController = new AbortController();
		this.action.clear();
		this.controller?.close();
	},
};

/** @enum {number} */
const FetchingModeEnum = Object.freeze({
	DEPENDENT: 0,
	INDEPENDENT: 1,
});

/**
 * @typedef NavigateFinishEventDetail
 * @prop {string} pageType
 * @prop {object} response
 * @prop {any} response.response
 * @prop {any} response.playerResponse
 * @prop {any} [response.contents]
 * @prop {any} [response.currentVideoEndpoint]
 * @prop {any} [response.playerOverlays]
 */

/**
 * @param { CustomEvent<NavigateFinishEventDetail> | { target: EventTarget, detail: NavigateFinishEventDetail } } e
 */
export async function initialize(e) {
	const player = /** @type {HTMLElement} */ (e.target);
	state.controller = new LiveChatController(player);
	try {
		await state.controller.start();
		self.dispatchEvent(new CustomEvent('ytlcf-ready'));
		
		// Initilize document picture-in-picture
		const script = document.createElement('script');
		script.id = 'yt-lcf-pip-script';
		script.src = browser.runtime.getURL('/injections/pip.mjs');
		script.type = 'module';
		script.dataset.paramCssUrl = browser.runtime.getURL('/styles/content.css');
		script.dataset.paramPipMarkerText = browser.i18n.getMessage('pip_marker');
		document.body.append(script);
		
		self.addEventListener('yt-navigate-finish', onYtNavigateFinish, { passive: true });
		onYtNavigateFinish(e);
	} catch (reason) {
		logger.warn(`Waiting for next navigation due to setup failure:`, reason);
		self.addEventListener('yt-navigate-finish', initialize, { once: true, passive: true });
		return;
	}

	self.addEventListener('yt-navigate-start', () => {
		state.reset();
	}, { passive: true });

	document.body.addEventListener('keydown', e => {
		if (e.repeat) return;
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		switch (e.key) {
			case store.hotkeys.layer: {
				const checkbox = /** @type {?HTMLElement} */ (player.querySelector('#yt-lcf-cb'));
				checkbox?.click();
				break;
			}
			case store.hotkeys.panel: {
				const popupmenu = /** @type {?HTMLElement} */ (player.querySelector('#yt-lcf-pm'));
				popupmenu?.click();
				break;
			}
		}
	}, { passive: true });

	/** @type {?HTMLVideoElement} */
	const video = document.querySelector('#movie_player video');
	video?.addEventListener('ratechange', function () {
		sessionStorage.setItem('yt-player-playback-rate', `{"data":"${this.playbackRate}"}`);
	}, { passive: true });
}

/**
 * @param { CustomEvent<NavigateFinishEventDetail> | { target: EventTarget, detail: NavigateFinishEventDetail } } e
 */
async function onYtNavigateFinish(e) {
	if (e.detail?.pageType !== 'watch') return;
	const toggle = state.controller?.player.querySelector('#yt-lcf-cb');
	toggle?.setAttribute('aria-disabled', 'true');

	/** @type {?HTMLVideoElement | undefined} */
	const video = (self.documentPictureInPicture?.window || self)?.document.querySelector('#movie_player video');
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
	const info = {
		videoId: videoDetails.videoId || mainResponse.currentVideoEndpoint?.watchEndpoint?.videoId,
		title: videoDetails.title || getText(mainResponse.playerOverlays?.playerOverlayRenderer?.videoDetails?.playerOverlayVideoDetailsRenderer?.title),
	};
	state.isLive = videoDetails?.isLive || videoDetails?.isUpcoming || false;

	const videoType = state.isLive ? 'livestream' : 'replay';
	const modeValue = store.others?.[`mode_${videoType}`] ?? FetchingModeEnum.INDEPENDENT;

	switch (modeValue) {
		case FetchingModeEnum.DEPENDENT:
			logger.info(`Running in dependent mode for ${videoType} (${info.videoId}):`, info.title);
			document.addEventListener('ytlcf-start', () => {
				state.controller?.listen();
				toggle?.removeAttribute('aria-disabled');
			}, { passive: true });
			break;
		case FetchingModeEnum.INDEPENDENT: {
			const timer = setInterval(() => {
				if (state.action.size > 0) {
					clearInterval(timer);
					video.addEventListener('seeking', onSeeking, { passive: true });
					video.addEventListener('timeupdate', onTimeUpdate, { passive: true });
				}
			}, 250);
			video.removeEventListener('seeking', onSeeking);
			video.removeEventListener('timeupdate', onTimeUpdate);

			const liveChatRenderer = response?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer
				?? response?.contents?.singleColumnWatchNextResults?.results?.results;
			/** @type {?string} */
			const initialContinuation = liveChatRenderer?.continuations?.at(0)?.reloadContinuationData?.continuation;
			if (initialContinuation) {
				logger.info(`Running in independent mode for ${videoType} (${info.videoId}):`, info.title);
				state.controller?.listen();
				toggle?.removeAttribute('aria-disabled');
				if (state.isLive) {
					const generator = getLiveChatActionsAsyncIterable(state.abortController.signal, initialContinuation);
					for await (const actions of generator) {
						const ev = new CustomEvent('ytlcf-action', { detail: actions });
						document.dispatchEvent(ev);
					}
				} else {
					setTimeout(() => onSeeking.call(video), 250);
					const generator = getReplayChatActionsAsyncIterable(state.abortController.signal, initialContinuation);
					for await (const actions of generator) {
						state.action.pushActions(actions);
					}
				}
			} else {
				logger.warn('Failed to fetch the chats in independent mode (this video has no chat):', info);
			}
			clearInterval(timer);
			break;
		}
	}
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
		document.dispatchEvent(ev);
	}
}
