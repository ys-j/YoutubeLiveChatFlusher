import { logger } from './logging.mjs';
import { store } from './store.mjs';
import { isAdShowing, getText, getValueByJSONPointer } from './utils.mjs';

import { LiveChatController } from './chat_controller.mjs';
import { ReplayActionBuffer, getReplayChatActionsAsyncIterable, getLiveChatActionsAsyncIterable } from './chat_actions.mjs';

const manifest = browser.runtime.getManifest();

const state = {
	isLive: false,
	/** @type {"desktop" | "mobile"} */
	device: 'desktop',
	action: new ReplayActionBuffer(),
	abortController: new AbortController(),
	/** @type {?LiveChatController} */
	controller: null,

	/** Resets the internal state for the next navigation. */
	reset() {
		this.abortController.abort();
		this.abortController = new AbortController();
		this.action.clear();
		this.controller?.close();
	},
};

const FetchingModeEnum = Object.freeze({
	MOBILE: -1,
	DEPENDENT: 0,
	INDEPENDENT: 1,
});
/** @typedef {typeof FetchingModeEnum[keyof typeof FetchingModeEnum]} FetchingModeEnum */

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
 * @typedef StateNavigateEndEventDetail
 * @prop {string} href
 * @prop {object} data
 * @prop {boolean} data.loading
 * @prop {object} data.response
 * @prop {boolean} data.response.loading
 * @prop {string} data.response.page
 * @prop {any} data.response.response
 * @prop {any} data.response.playerResponse
 */

/**
 * @param { { target: EventTarget, detail: NavigateFinishEventDetail } } e
 */
export async function initialize(e) {
	const player = /** @type {HTMLElement} */ (e.target);
	state.controller = new LiveChatController(player);
	state.device = state.controller.device;
	const navEvtDefs = state.device === 'desktop'
		? { start: 'yt-navigate-start', end: 'yt-navigate-finish', pointer: '' }
		: { start: 'state-navigatestart', end: 'state-navigateend', pointer: '/data' };
	try {
		// @ts-expect-error
		const pageType = e.detail.pageType ?? e.detail.response?.page;
		if (pageType !== 'watch') throw `page-type is not "watch" but "${pageType}"`;

		await state.controller.start();
		logger.info(`${manifest.name} is ready!`);

		onYtNavigateFinish(pageType, e.detail.response);
		self.addEventListener(navEvtDefs.end, e => {
			const data = getValueByJSONPointer(e.detail, navEvtDefs.pointer + '/response');
			onYtNavigateFinish(data.page, data);
		});

		if (state.device === 'desktop') {
			// Initilize document picture-in-picture
			await browser.runtime.sendMessage({
				injection: 'pip',
				details: {
					cssUrl: browser.runtime.getURL('/styles/content.css'),
					pipMarkerText: browser.i18n.getMessage('pip_marker'),
					hotkeys: store.data.hotkeys,
				},
			});
		}
	} catch (reason) {
		logger.warn(`Waiting for next navigation due to setup failure:`, reason);
		self.addEventListener(navEvtDefs.end, e => {
			initialize({
				target: player,
				detail: getValueByJSONPointer(e.detail, navEvtDefs.pointer),
			});
		}, { once: true });
		return;
	}

	self.addEventListener(navEvtDefs.start, () => state.reset());

	document.body.addEventListener('keydown', e => {
		if (e.repeat) return;
		if (e.ctrlKey || e.metaKey) return;
		switch (e.key) {
			case store.hotkeys.layer.key:
				if (e.altKey === store.hotkeys.layer.alt) {
					const checkbox = /** @type {?HTMLElement} */ (player.querySelector('#yt-lcf-cb'));
					checkbox?.click();
				}
				break;
			case store.hotkeys.panel.key:
				if (e.altKey === store.hotkeys.panel.alt) {
					const popupmenu = /** @type {?HTMLElement} */ (player.querySelector('#yt-lcf-pm'));
					popupmenu?.click();
				}
				break;
			case store.hotkeys.pip.key:
				if (e.altKey === store.hotkeys.pip.alt) {
					const pipmenu = /** @type {?HTMLElement} */ (player.querySelector('#yt-lcf-pp'));
					pipmenu?.click();
				}
				break;
		}
	}, { passive: true });
}

/**
 * @param {string} pageType
 * @param {any} response
 */
async function onYtNavigateFinish(pageType, response) {
	if (pageType !== 'watch') return;

	const toggle = {
		element: state.controller?.player?.querySelector('#yt-lcf-cb'),
		disable() { this.element?.setAttribute('aria-disabled', 'true'); },
		enable() { this.element?.setAttribute('aria-disabled', 'false'); },
	};
	toggle.disable();

	/** @type {?HTMLVideoElement | undefined} */
	const video = (self.documentPictureInPicture?.window || self)?.document.querySelector('#movie_player video');
	const videoContainer = video?.parentElement;
	if (!videoContainer) return;
	if (state.controller?.layer) videoContainer.after(state.controller.layer.element);

	const res = (response && 'contents' in response) ? response : response?.response;
	if (!res) return;

	const videoDetails = response?.playerResponse?.videoDetails
		|| response.contents?.twoColumnWatchNextResults?.results?.results?.contents?.at(0)?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer;
	const info = {
		videoId: videoDetails?.videoId || response.currentVideoEndpoint?.watchEndpoint?.videoId,
		title: videoDetails?.title || getText(response.playerOverlays?.playerOverlayRenderer?.videoDetails?.playerOverlayVideoDetailsRenderer?.title),
	};
	state.isLive = videoDetails?.isLive
		|| videoDetails?.isUpcoming
		|| getText(response.playerOverlays?.playerOverlayRenderer?.liveIndicatorText)
		|| false;

	const videoType = state.isLive ? 'livestream' : 'replay';
	const modeValue = state.device === 'mobile' ? FetchingModeEnum.MOBILE : store.others?.[`mode_${videoType}`] ?? FetchingModeEnum.INDEPENDENT;

	const nonce = await browser.runtime.sendMessage({ fire: 'getNonce' });

	/** @type {?string} */
	let initialContinuation = null;
	switch (modeValue) {
		case FetchingModeEnum.DEPENDENT:
			logger.info(`Running in dependent mode for ${videoType} (${info.videoId}):`, info.title);
			document.addEventListener(`ytlcf-start:${nonce}`, () => {
				state.controller?.listen();
				toggle.enable();
			});
			break;
		case FetchingModeEnum.MOBILE: {
			const desktopContent = await browser.runtime.sendMessage({
				request: { url: `https://www.youtube.com/watch?v=${info.videoId}&app=desktop` },
				contentType: 'text',
			});
			let warning = null;
			if (!desktopContent || 'error' in desktopContent) {
				warning = 'Failed to fetch the desktop page from mobile mode:';
			} else {
				const pat = /"continuations":\s*\[\s*\{\s*"reloadContinuationData":\s*\{\s*"continuation":\s*"([^"]+)"/;
				const match = desktopContent.data.match(pat)?.at(1);
				if (match) initialContinuation = match;
				else warning = 'Failed to fetch the chats in mobile mode (this video has no chat):';
			}
			if (warning) {
				logger.warn(warning, info);
				break;
			} else {
				logger.info(`Running in mobile mode for ${videoType} (${info.videoId}):`, info.title);
			}
			// fall through
		}
		case FetchingModeEnum.INDEPENDENT: {
			const timer = setInterval(() => {
				if (state.action.size > 0) {
					clearInterval(timer);
					video.addEventListener('seeking', onSeeking, { passive: true });
					video.addEventListener('ratechange', onRateChange, { passive: true });
					video.addEventListener('timeupdate', onTimeUpdate, { passive: true });
				}
			}, 250);
			video.removeEventListener('seeking', onSeeking);
			video.removeEventListener('ratechange', onRateChange);
			video.removeEventListener('timeupdate', onTimeUpdate);

			const liveChatRenderer = res?.contents?.twoColumnWatchNextResults?.conversationBar?.liveChatRenderer
				?? res?.contents?.singleColumnWatchNextResults?.results?.results;
			/** @type {?string} */
			initialContinuation ||= liveChatRenderer?.continuations?.at(0)?.reloadContinuationData?.continuation;
			if (initialContinuation) {
				logger.info(`Running in independent mode for ${videoType} (${info.videoId}):`, info.title);
				state.controller?.listen();
				toggle.enable();
				if (state.isLive) {
					const generator = getLiveChatActionsAsyncIterable(state.abortController.signal, initialContinuation);
					for await (const actions of generator) {
						const ev = new CustomEvent(`ytlcf-action:${nonce}`, { detail: actions });
						document.dispatchEvent(ev);
					}
				} else {
					setTimeout(() => {
						onSeeking.call(video);
						onRateChange.call(video);
					}, 250);
					const generator = getReplayChatActionsAsyncIterable(state.abortController.signal, initialContinuation, nonce);
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

	/**
	 * @this {HTMLVideoElement}
	 */
	function onSeeking() {
		const shiftSec = !state.isLive && store.others.time_shift || 0;
		const currentOffset = (this.currentTime - shiftSec) * 1000 | 0;
		const ev = new CustomEvent(`ytlcf-seek:${nonce}`, { detail: { offset: currentOffset } });
		state.abortController.signal.dispatchEvent(ev);
		state.action.update(currentOffset);
	}

	/**
	 * @this {HTMLVideoElement}
	 */
	function onRateChange() {
		const ev = new CustomEvent(`ytlcf-ratechange:${nonce}`, { detail: { rate: this.playbackRate } });
		state.abortController.signal.dispatchEvent(ev);
	}

	/**
	 * @this {HTMLVideoElement}
	 */
	function onTimeUpdate() {
		const shiftSec = !state.isLive && store.others.time_shift || 0;
		const player = state.controller?.layer.element.parentElement;
		if (player && isAdShowing(player)) return;
		const currentOffset = (this.currentTime - shiftSec) * 1000 | 0;
		const pendingActions = state.action.getPendingActions(currentOffset);
		if (pendingActions.length > 0) {
			const ev = new CustomEvent(`ytlcf-action:${nonce}`, { detail: pendingActions });
			document.dispatchEvent(ev);
		}
	}
}
