/// <reference path="../types/browser.d.ts" />
/// <reference path="../types/extends.d.ts" />

self.browser ??= chrome;

const isLive = location.pathname === '/live_chat';
const modeName = isLive ? 'mode_livestream' : 'mode_replay';

const url = browser.runtime.getURL('./modules/store.mjs');
import(url).then((/** @type {typeof import('./modules/store.mjs')} */ module) => {
	const s = module.store;
	const mode = s.others?.[modeName] ?? 1;
	if (mode !== 0) return;
	const ev = new CustomEvent('ytlcf-start');
	top?.document.dispatchEvent(ev);
	document.addEventListener('yt-action', onAction, { passive: true });
});

/**
 * @param {CustomEvent} e 
 */
function onAction(e) {
	if (e.detail?.actionName === 'yt-live-chat-actions') {
		const actions = e.detail?.args?.at(0);
		if (!actions) return;
		const ev = new CustomEvent('ytlcf-action', { detail: actions });
		top?.document.dispatchEvent(ev);
	}
}