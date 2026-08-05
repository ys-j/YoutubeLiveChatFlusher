(function () {
	'use strict';
	// @ts-expect-error
	self.browser ??= chrome;

	const MAX_ATTEMPTS = 30;

	const isLive = location.pathname === '/live_chat';
	const modeName = isLive ? 'mode_livestream' : 'mode_replay';

	/** @type {Promise<typeof import('./modules/store.mjs')>} */
	const importingStore = import(browser.runtime.getURL('./modules/store.mjs'));
	/** @type {Promise<typeof import('./modules/logging.mjs')>} */
	const importingLogging = import(browser.runtime.getURL('./modules/logging.mjs'));
	/** @type {Promise<typeof import('./modules/utils.mjs')>} */
	const importingUtils = import(browser.runtime.getURL('./modules/utils.mjs'));

	Promise.all([
		importingLogging.then(({ logger }) => logger),
		importingStore.then(({ store }) => store.load()),
		importingUtils.then(({ nonce }) => nonce),
	]).then(async ([logger, store, nonce]) => {
		const mode = store.others[modeName] ?? 1;
		logger.info('Loaded chat frame script:', `${modeName} =`, mode);
		if (mode) return;

		const startEvent = new CustomEvent(`ytlcf-start:${nonce}`);
		let attempts = 0;
		const timer = setInterval(async () => {
			const layer = top?.document.getElementById('yt-lcf-layer');
			if (layer) {
				top?.document.dispatchEvent(startEvent);
				logger.info('Initialized layer found, dispatched start event.');
				clearInterval(timer);
			} else if (attempts++ < MAX_ATTEMPTS) {
				logger.debug('No initialized layer found, waiting...', attempts, 'of', MAX_ATTEMPTS);
			} else {
				clearInterval(timer);
			}
		}, 1000);

		document.addEventListener('yt-action', onAction, { passive: true });

		/**
		 * @param {CustomEvent} e
		 */
		function onAction(e) {
			if (e.detail?.actionName === 'yt-live-chat-actions') {
				const actions = e.detail?.args?.at(0);
				if (!actions) return;
				const ev = new CustomEvent(`ytlcf-action:${nonce}`, { detail: actions });
				top?.document.dispatchEvent(ev);
			}
		}
	});
})();
