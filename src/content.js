/// <reference path="../browser.d.ts" />
/// <reference path="../extends.d.ts" />
/// <reference path="../ytlivechatrenderer.d.ts" />

// @ts-ignore
var browser = browser || chrome;
const manifest = browser.runtime.getManifest();

const isNotPip = () => !self.documentPictureInPicture?.window;
document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

/** @type {Map<number, LiveChat.LiveChatItemAction[]>} */
const actionMap = new Map();

// root window
const root = isNotPip() ? self : self.documentPictureInPicture?.window || self;
	
self.addEventListener('ytlcf-ready', e => {
	e.stopImmediatePropagation();
	console.log(manifest.name + ' is ready!');
});

self.addEventListener('yt-navigate-finish', initialize, { passive: true, once: true });
	
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
 * @prop { { response: any, playerResponse: any } } response
 */

/**
 * @param {CustomEvent<NavigateFinishEventDetail>} e 
 */
function initialize(e) {
	const scriptsPaths = ['./modules/livechat.js', './modules/chat_actions.js', './modules/pip.js'];
	const importings = scriptsPaths.map(path => import(browser.runtime.getURL(path)));
	Promise.all(importings).then(async modules => {
		/** @type {import('./modules/livechat.js')} */
		const { g, runApp, skipRenderingOnce } = modules[0];
		/** @type {import('./modules/chat_actions.js')} */
		const { fetchChatActions } = modules[1];
		/** @type {import('./modules/pip.js')} */
		const { initPipMenu } = modules[2];
	
		// run app
		let succeeded = true;
		const player = /** @type {HTMLElement} */ (e.target);
		await runApp(player)
		.then(initPipMenu)
		.then(() => {
			onYtNavigateFinish(e);
			const iframe = /** @type {HTMLIFrameElement?} */ (document.getElementById('chatframe'));
			const pathname = iframe?.contentWindow?.location?.pathname;
			if (pathname === '/live_chat') {
				onLoadIFrame.bind(iframe)();
			}
		}).catch(() => {
			succeeded = false;
		});
		if (succeeded) {
			skipRenderingOnce();
		} else {
			self.addEventListener('yt-navigate-finish', initialize, { passive: true, once: true });
			return;
		}
	
		let lastOffset = 0;

		/**
		 * @this {HTMLVideoElement}
		 * @param {Event} e 
		 */
		function onSeeking(e) {
			lastOffset = (this.currentTime - g.storage.others.time_shift) * 1000 | 0;
		}

		/**
		 * @this {HTMLVideoElement}
		 * @param {Event} e 
		 */
		function onTimeUpdate(e) {
			const player = g.layer?.element.parentElement;
			if (player) {
				const isAdShowing = ['ad-showing', 'ad-interrupting'].map(c => player.classList.contains(c)).includes(true);
				if (isAdShowing) return;
			}
			lastOffset ||= Math.max(-g.storage.others.time_shift * 1000, 1) | 0;
			const currentOffset = (this.currentTime - g.storage.others.time_shift) * 1000 | 0;
			const targetKeys = actionMap.keys().filter(time => lastOffset < time && time <= currentOffset);
			for (const k of targetKeys) {
				const ev = new CustomEvent('ytlcf-actions', { detail: actionMap.get(k) });
				self.dispatchEvent(ev);
			}
			lastOffset = currentOffset;
		}
	
		/**
		 * @param {CustomEvent<{ actionName: string, args?: any[] }>} e 
		 */
		function onYtAction(e) {
			switch (e.detail?.actionName) {
				case 'yt-live-chat-actions': {
					const ev = new CustomEvent('ytlcf-actions', { detail: e.detail?.args?.[0] });
					self.dispatchEvent(ev);
					break;
				}
				case 'yt-live-chat-reload-success':
				case 'yt-live-chat-seek-success':
					skipRenderingOnce();
			}
		}

		// when page load started
		self.addEventListener('yt-navigate-start', () => {
			actionMap.clear();
		}, { passive: true });
	
		// when page load ended
		self.addEventListener('yt-navigate-finish', onYtNavigateFinish, { passive: true });

		/**
		 * @param {CustomEvent<NavigateFinishEventDetail>} e 
		 */
		function onYtNavigateFinish(e) {
			if (e.detail?.pageType !== 'watch') return;
			
			const video = g.app?.querySelector('#ytd-player video');
			const videoContainer = video?.parentElement;
			if (videoContainer && g.layer && !videoContainer.parentElement?.contains(g.layer.element)) {
				videoContainer.after(g.layer.element);
			}
	
			const mainResponse = e.detail?.response;
			const response = (mainResponse && 'contents' in mainResponse) ? mainResponse : mainResponse?.response;
			if (!response) return;
			const videoDetails = mainResponse?.playerResponse?.videoDetails;
			const isLive = videoDetails?.isLive || videoDetails?.isUpcoming;
			
			const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('chatframe'));
			let timer = 0;
			if (!isLive /* && g.storage.others.time_shift !== 0 */) {
				timer = setInterval(() => {
					if (actionMap.size > 0) {
						clearInterval(timer);
						// when the video has chat replay
						video?.addEventListener('seeking', onSeeking, { passive: true });
						video?.addEventListener('timeupdate', onTimeUpdate, { passive: true });
					}
				}, 100);
	
				// Fetching chat actions async
				fetchChatActions(response, actionMap).catch(reason => {
					const videoId = videoDetails?.videoId;
					const message = videoId ? reason?.replace('.', ': ' + videoId) : reason;
					console.warn(message);
				}).finally(() => {
					clearInterval(timer);
				});
				iframe?.removeEventListener('load', onLoadIFrame);
			} else {
				iframe?.addEventListener('load', onLoadIFrame, { passive: true });
			}

			if (video) {
				video.removeEventListener('seeking', onSeeking);
				video.removeEventListener('timeupdate', onTimeUpdate);
			}
		}

		/**
		 * @this {HTMLIFrameElement}
		 * @param {Event} e 
		 */
		function onLoadIFrame(e) {
			const doc = this.contentDocument;
			doc?.addEventListener('yt-action', onYtAction, { passive: true });
		}
	
		document.body.addEventListener('keydown', e => {
			if (!e.repeat) switch (e.key) {
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
	});
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