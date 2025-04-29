/// <reference path="../browser.d.ts" />
/// <reference path="../extends.d.ts" />

// @ts-ignore
var browser = browser || chrome;
const $msg = browser.i18n.getMessage;
const manifest = browser.runtime.getManifest();
const tags = {
	chat: 'yt-live-chat-renderer',
	layer: 'yt-lcf-layer',
	panel: 'yt-lcf-panel',
	checkbox: 'yt-lcf-cb',
	popupmenu: 'yt-lcf-pm',
	popuppip: 'yt-lcf-pp',
	pipmarker: 'yt-lcf-pip-marker',
};

const isNotPip = () => !top?.documentPictureInPicture?.window;
document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

const detectPageType = () => {
	const paths = {
		livechat: ['live_chat', 'live_chat_replay'],
		watch: ['live', 'watch'],
	}
	const selfPath = location.pathname.split('/')[1];
	const topPath = top?.location.pathname.split('/')[1] || 'never';
	if (paths.watch.includes(selfPath)) {
		import(browser.runtime.getURL('./modules/watch.js')).then(whenWatchPage);
	} else if (paths.livechat.includes(selfPath) && paths.watch.includes(topPath)) {
		import(browser.runtime.getURL('./modules/livechat.js')).then(whenLivechatPage);
	}
}
detectPageType();
window.addEventListener('yt-navigate-finish', detectPageType, { passive: true });

/**
 * When `live` or `watch` page
 * @param {import('./modules/watch.js')} modules 
 */
function whenWatchPage(modules) {
	const { checkAutoStart, fetchChatReplayActions, initPipMenu } = modules;
	document.addEventListener('yt-action', e => {
		const name = e.detail?.actionName;
		switch (name) {
			case 'ytd-watch-player-data-changed': {
				const ev = new CustomEvent(name);
				top?.['chatframe']?.contentWindow?.dispatchEvent(ev);
				if (!isNotPip()) self.documentPictureInPicture?.window?.dispatchEvent(ev);
				checkAutoStart();
			}
		}
	}, { passive: true });
	document.addEventListener('ytlcf-ready', e => {
		e.stopImmediatePropagation();
		console.log(manifest.name + ' is ready!');
		initPipMenu();
	});
	self.addEventListener('yt-navigate-finish', e => {
		if (e.detail?.pageType === 'watch') {
			const response = e.detail?.response?.response;
			if (response) fetchChatReplayActions(response);
		}
	}, { passive: true });
	checkAutoStart();
}

/**
 * When `live_chat` or `live_chat_replay` page
 * @param {import('./modules/livechat.js')} modules 
 */
async function whenLivechatPage(modules) {
	const { runApp } = modules;
	const root = isNotPip() ? top || window : top?.documentPictureInPicture?.window;
	runApp(root?.document.querySelector('#ytd-player')).then(isStarted => {
		if (isStarted) {
			const ev = new CustomEvent('ytlcf-ready');
			top?.document.dispatchEvent(ev);
		} else {
			console.error('Failed to start ' + manifest.name);
		}
	});
	self.addEventListener('ytd-watch-player-data-changed', () => {
		root?.document.querySelector('#' + tags.layer)?.remove();
		root?.document.querySelector('#' + tags.panel)?.remove();
	});
}