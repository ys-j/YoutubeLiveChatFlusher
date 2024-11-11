/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';
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
// @ts-ignore
const isNotPip = () => !top?.documentPictureInPicture?.window;

detectPageType();
window.addEventListener('yt-navigate-finish', detectPageType, { passive: true });

function detectPageType() {
	const paths = {
		livechat: ['live_chat', 'live_chat_replay'],
		watch: ['live', 'watch'],
	}
	const selfPath = location.pathname.split('/')[1];
	const topPath = top?.location.pathname.split('/')[1] || 'never';
	if (paths.watch.includes(selfPath)) {
		import(browser.runtime.getURL('./watch.js')).then(whenWatchPage);
	} else if (paths.livechat.includes(selfPath) && paths.watch.includes(topPath)) {
		import(browser.runtime.getURL('./livechat.js')).then(whenLivechatPage);
	}
}

/**
 * When `live` or `watch` page
 * @param {import('./watch.js')} modules 
 */
function whenWatchPage(modules) {
	const { checkAutoStart, openPip } = modules;
	document.addEventListener('yt-action', e => {
		const name = e.detail?.actionName;
		switch (name) {
			case 'ytd-watch-player-data-changed': {
				const ev = new CustomEvent(name);
				top?.['chatframe']?.contentWindow?.dispatchEvent(ev);
				//@ts-ignore
				if (!isNotPip()) documentPictureInPicture?.window?.dispatchEvent(ev);
				checkAutoStart();
			}
		}
	}, { passive: true });
	document.addEventListener('ytlcf-ready', e => {
		e.stopImmediatePropagation();
		console.log(manifest.name + ' is ready!');
		const popupmenu = document.querySelector('#' + tags.popupmenu);
		const pipmenu = document.querySelector('#' + tags.popuppip);
		if (popupmenu) {
			if (pipmenu) {
				popupmenu.after(pipmenu);
			} else {
				const pipmenu = document.createElement('div');
				pipmenu.className = 'ytp-menuitem';
				pipmenu.tabIndex = 0;
				pipmenu.id = tags.popuppip;
				pipmenu.role = 'menuitem';
				pipmenu.ariaHasPopup = 'true';
				pipmenu.innerHTML = `<div class="ytp-menuitem-icon"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-30 -30 60 60"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"><path d="M-16-12l8,8h-8h8v-8" stroke-width="2"/><path d="M-8,16h-12a4,4,0,0,1,-4,-4v-28a4,4,0,0,1,4,-4h40a4,4,0,0,1,4,4v12" stroke-width="3"/></g><rect width="25" height="15" y="2" rx="2" ry="2" fill="#fff"/></svg></div><div class="ytp-menuitem-label">${$msg('ytp_menuitem_label_pip')}</div><div class="ytp-menuitem-content"></div>`;
				pipmenu.addEventListener('click',  async _ => {
					/** @type {Window?} */ // @ts-ignore
					const pipWindow = documentPictureInPicture?.window;
					if (pipWindow) {
						pipWindow.close();
					} else {
						const layer = document.querySelector('#' + tags.layer);
						if (layer) {
							const player = layer.closest('#player-container');
							if (player) await openPip(player);
						}
					}
				}, { passive: true });
				popupmenu.after(pipmenu);
			}
		}
	});
	checkAutoStart();
}

/**
 * When `live_chat` or `live_chat_replay` page
 * @param {import('./livechat.js')} modules 
 */
async function whenLivechatPage(modules) {
	const { runApp, LiveChatLayer, LiveChatPanel } = modules;
	// @ts-ignore
	const root = isNotPip() ? top || window : top?.documentPictureInPicture?.window;
	runApp(root?.document.querySelector('#ytd-player')).then(isStarted => {
		if (isStarted) {
			const ev = new CustomEvent('ytlcf-ready');
			root?.document.dispatchEvent(ev);
		}
	});
	addEventListener('ytd-watch-player-data-changed', _ => {
		/** @type {HTMLDivElement?} */
		const layer = root?.document.querySelector('#' + tags.layer);
		if (layer) layer.remove();
		/** @type {HTMLDivElement?} */
		const panel = root?.document.querySelector('#' + tags.panel);
		if (panel) panel.remove();
	});
}
