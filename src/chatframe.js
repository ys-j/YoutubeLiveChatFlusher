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

	Promise.all([
		importingLogging.then(({ logger }) => logger),
		importingStore.then(({ store }) => store.load()),
	]).then(async ([logger, store]) => {
		const mode = store.others[modeName] ?? 1;
		logger.info('Loaded chat frame script:', `${modeName} =`, mode);
		if (mode) return;

		let attempts = 0;
		(async function tryFindLayer() {
			const layer = top?.document.getElementById('yt-lcf-layer');
			if (layer) {
				const nonce = await browser.runtime.sendMessage({ fire: 'getNonce' });
				if (typeof nonce !== 'string') {
					const { name, message } = nonce.error;
					logger.error(new DOMException(message, name));
					return;
				}
				const startEvent = new CustomEvent(`ytlcf-start:${nonce}`);
				top?.document.dispatchEvent(startEvent);
				logger.info('Initialized layer found, dispatched start event.');

				document.addEventListener('yt-action', e => {
					if (e.detail?.actionName !== 'yt-live-chat-actions') return;
					const actions = e.detail?.args?.at(0);
					if (!actions) return;
					const ev = new CustomEvent(`ytlcf-action:${nonce}`, { detail: actions });
					top?.document.dispatchEvent(ev);
				});
			} else if (attempts++ < MAX_ATTEMPTS) {
				logger.debug('No initialized layer found, waiting...', attempts, `of ${MAX_ATTEMPTS}`);
				setTimeout(tryFindLayer, 1000);
			} else {
				logger.error(`Failed to found initialized layer after ${MAX_ATTEMPTS} attempts.`);
			}
		})();
	});
})();
