// @ts-expect-error
self.browser ??= chrome;

const isLive = location.pathname === '/live_chat';
const modeName = isLive ? 'mode_livestream' : 'mode_replay';

Promise.all([
	import(browser.runtime.getURL('./modules/store.mjs')).then((/** @type {typeof import('./modules/store.mjs')} */ { store }) => store.load()),
	import(browser.runtime.getURL('./modules/logging.mjs')).then((/** @type {typeof import('./modules/logging.mjs')} */ { logger }) => logger),
]).then(([store, logger]) => {
	const mode = store.others[modeName] ?? 1;
	logger.info('Loaded chat frame script:', `${modeName} =`, mode);
	if (mode) return;
	const ev = new CustomEvent('ytlcf-start');
	const timer = setInterval(() => {
		const layer = top?.document.getElementById('yt-lcf-layer');
		if (layer) {
			top?.document.dispatchEvent(ev);
			logger.info('Initialized layer found, dispatched start event.');
			clearInterval(timer);
		} else {
			logger.debug('No initialized layer found, waiting...');
		}
	}, 1000);
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
