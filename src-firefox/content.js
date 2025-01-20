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
};

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
	const { checkAutoStart } = modules;
	document.addEventListener('yt-action', e => {
		const name = e.detail?.actionName;
		switch (name) {
			case 'ytd-watch-player-data-changed': {
				const ev = new CustomEvent(name);
				top?.['chatframe']?.contentWindow?.dispatchEvent(ev);
				[tags.layer, tags.panel, tags.checkbox, tags.popupmenu, tags.popuppip, tags.pipmarker].forEach(id => {
					document.getElementById(id)?.remove();
				});
				checkAutoStart();
			}
		}
	}, { passive: true });
	document.addEventListener('ytlcf-ready', e => {
		e.stopImmediatePropagation();
		console.log(manifest.name + ' is ready!');
	});
	checkAutoStart();
}

/**
 * When `live_chat` or `live_chat_replay` page
 * @param {import('./livechat.js')} modules 
 */
async function whenLivechatPage(modules) {
	const { runApp } = modules;
	const root = top;
	runApp(root?.document.querySelector('#ytd-player')).then(isStarted => {
		if (isStarted) {
			const ev = new CustomEvent('ytlcf-ready');
			root?.document.dispatchEvent(ev);
		}
	});
	addEventListener('ytd-watch-player-data-changed', _ => {
		/** @type {HTMLDivElement | null | undefined} */
		const layer = root?.document.querySelector('#' + tags.layer);
		if (layer) layer.remove();
		/** @type {HTMLDivElement | null | undefined} */
		const panel = root?.document.querySelector('#' + tags.panel);
		if (panel) panel.remove();
	});
}