/// <reference lib="esnext" />
/// <reference path="../browser.d.ts" />
/// <reference path="../extends.d.ts" />
/// <reference path="../ytlivechatrenderer.d.ts" />


self.browser ??= chrome;

const isNotPip = () => !self.documentPictureInPicture?.window;

/** @type {Map<number, Set<string>>} */
const actionMap = new Map();

const manifest = browser.runtime.getManifest();
document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

// inject script
self.addEventListener('ytlcf-message', e => {
	if (!e.detail) return;
	const { ytInitialData, ytcfg } = e.detail;
	if (ytInitialData) sessionStorage.setItem('ytlcf-initial-data', ytInitialData);
	if (ytcfg) sessionStorage.setItem('ytlcf-cfg', ytcfg);
	const target = document.querySelector('ytd-app') || document.getElementById('player-container-id');
	const detail = {
		pageType: ['/watch', '/live'].includes(location.pathname) ? 'watch' : 'browser',
		response: JSON.parse(ytInitialData),
	};
	if (target) initialize({ target, detail });
}, { passive: true });

setTimeout(() => {
	const script = document.createElement('script');
	script.src = browser.runtime.getURL('./modules/injection.js');
	document.body.append(script);
}, 1000);

self.addEventListener('ytlcf-ready', e => {
	e.stopImmediatePropagation();
	console.info(manifest.name + ' is ready!');
	const settingsButton = document.querySelector('.ytp-settings-button');
	settingsButton?.classList.add(e.type);
}, { passive: true });

document.addEventListener('yt-action', e => {
	const name = e.detail?.actionName;
	switch (name) {
		case 'ytd-watch-player-data-changed': {
			const ev = new CustomEvent(name);
			if (!isNotPip()) self.documentPictureInPicture?.window?.dispatchEvent(ev);
			checkAutoStart();
		}
	}
}, { passive: true });

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
async function initialize(e) {
	const scriptsPaths = ['./modules/livechat.js', './modules/chat_actions.js', './modules/pip.js'];
	const [ livechatModule, chatActionsModule, pipModule ] = await Promise.all(scriptsPaths.map(path => import(browser.runtime.getURL(path))));
	/** @type {import('./modules/livechat.js')} */
	const { g, runApp, doChatActions } = livechatModule;
	/** @type {import('./modules/chat_actions.js')} */
	const { fetchChatActions } = chatActionsModule;
	/** @type {import('./modules/pip.js')} */
	const { initPipMenu } = pipModule;

	let isLive = false;
	let succeeded = true;
	/** @type {AbortController} */
	let controller;

	// run app
	const player = /** @type {HTMLElement} */ (e.target);
	await runApp(player)
	.then(initPipMenu)
	.catch(reason => {
		console.warn(reason);
		succeeded = false;
	});
	if (succeeded) {
		self.addEventListener('yt-navigate-finish', onYtNavigateFinish, { passive: true });
		const hostDomains = location.host.split('.');
		switch (hostDomains.at(0)) {
			case 'm':
				console.log(e);
				const searchs = new URLSearchParams(location.search);
				const desktopUrl = '//' + hostDomains.with(0, 'www').join('.') + location.pathname + `?v=${searchs.get('v')}&app=desktop`;
				// const desktopRes = await fetch(desktopUrl).then(res => res.text());
				// console.log(desktopRes);
			case 'www':
				onYtNavigateFinish(e);
		}
	} else {
		self.addEventListener('yt-navigate-finish', initialize, { passive: true, once: true });
		return;
	}

	let lastOffset = 0;

	/**
	 * @this {HTMLVideoElement}
	 */
	function onSeeking() {
		const shiftSec = !isLive && g.storage.others.time_shift || 0;
		const currentOffset = (this.currentTime - shiftSec) * 1000 | 0;
		const ev = new CustomEvent('ytlcf-seek', { detail: { offset: currentOffset } });
		controller.signal.dispatchEvent(ev);
		lastOffset = currentOffset;
	}

	/**
	 * @this {HTMLVideoElement}
	 */
	function onTimeUpdate() {
		const shiftSec = !isLive && g.storage.others.time_shift || 0;
		const player = g.layer?.element.parentElement;
		if (player) {
			const isAdShowing = ['ad-showing', 'ad-interrupting'].map(c => player.classList.contains(c)).includes(true);
			if (isAdShowing) return;
		}
		lastOffset ||= Math.max(-shiftSec * 1000, 1) | 0;
		const currentOffset = (this.currentTime - shiftSec) * 1000 | 0;
		const allKeys = actionMap.keys();
		const targetKeys = allKeys.filter(time => Math.max(lastOffset, currentOffset - 1000) < time && time <= currentOffset);
		for (const k of targetKeys) {
			const ev = new CustomEvent('ytlcf-actions', { detail: Array.from(actionMap.get(k) || [], s => JSON.parse(s)) });
			self.dispatchEvent(ev);
		}
		lastOffset = currentOffset;
	}

	/**
	 * @param {CustomEvent} e 
	 */
	function onYtlcfActions(e) {
		doChatActions(e.detail);
	}

	// when page load started
	self.addEventListener('yt-navigate-start', () => {
		self?.removeEventListener('ytlcf-actions', onYtlcfActions);
		controller?.abort();
		actionMap.clear();
		g.layer?.clear();
	}, { passive: true });

	/**
	 * @param { CustomEvent<NavigateFinishEventDetail> | { target: EventTarget, detail: NavigateFinishEventDetail } } e 
	 */
	async function onYtNavigateFinish(e) {
		self.addEventListener('ytlcf-actions', () => {
			self.addEventListener('ytlcf-actions', onYtlcfActions, { passive: true });
		}, { passive: true, once: true });
		if (e.detail?.pageType !== 'watch') return;
		
		/** @type {HTMLVideoElement | null | undefined} */
		const video = (isNotPip() ? self : self.documentPictureInPicture?.window)?.document.querySelector('#movie_player video');
		const videoContainer = video?.parentElement;
		if (!videoContainer) return;
		const parent = videoContainer.parentElement;
		if (g.layer && parent?.contains(g.layer.element)) {
			videoContainer.after(g.layer.element);
		}
		const mainResponse = e.detail?.response;
		const response = (mainResponse && 'contents' in mainResponse) ? mainResponse : mainResponse?.response;
		if (!response) return;
		const videoDetails = mainResponse?.playerResponse?.videoDetails
			|| mainResponse.contents?.twoColumnWatchNextResults?.results?.results?.contents?.at(0)?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer;
		isLive = videoDetails?.isLive || videoDetails?.isUpcoming || false;

		const storage = await browser.storage.local.get('others');
		const modeName = isLive ? 'mode_livestream' : 'mode_replay';
		const mode = storage.others?.[modeName] ?? 1;
		if (mode === 1) {
			let timer = 0;
			timer = setInterval(() => {
				if (actionMap.size > 0) {
					clearInterval(timer);
					video.addEventListener('seeking', onSeeking, { passive: true });
					video.addEventListener('timeupdate', onTimeUpdate, { passive: true });
				}
			}, 250);
			video.removeEventListener('seeking', onSeeking);
			video.removeEventListener('timeupdate', onTimeUpdate);

			// Fetching chat actions async
			controller = new AbortController();
			fetchChatActions(response, actionMap, controller.signal)
			.catch(reason => {
				const videoId = videoDetails?.videoId;
				const message = videoId ? reason?.replace('.', ': ' + videoId) : reason;
				console.warn(message);
			}).finally(() => {
				clearInterval(timer);
			});
			if (!isLive) setTimeout(() => onSeeking.call(video), 250);
		}
	}

	document.body.addEventListener('keydown', e => {
		if (e.repeat) return;
		switch (e.key) {
			case g.storage.hotkeys.layer: {
				const checkbox = /** @type {HTMLElement?} */ (g.app?.querySelector('#yt-lcf-cb'));
				checkbox?.click();
				break;
			}
			case g.storage.hotkeys.panel: {
				const popupmenu = /** @type {HTMLElement?} */ (g.app?.querySelector('#yt-lcf-pm'));
				popupmenu?.click();
				break;
			}
		}
	}, { passive: true });
}

async function checkAutoStart() {
	const storage = await browser.storage.local.get('others');
	const autostart = storage?.others?.autostart;
	if (autostart) {
		const buttonContainer = document.getElementById('show-hide-button');
		if (buttonContainer && !buttonContainer.hidden) {
			const button = buttonContainer.querySelector('button');
			const isClose = button?.closest('#close-button');
			if (!isClose) {
				button?.click();
				return true;
			}
		}
	}
	return false;
}