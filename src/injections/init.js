'use strict';
Promise.all([
	new Promise((resolve, reject) => {
		const script = document.currentScript;
		const nonce = script?.dataset.nonce;
		if (nonce) {
			script.remove();
			resolve(nonce);
		} else {
			reject('Nonce not found in script URL.');
		}
	}),
	import('../modules/logging.mjs').then(({ logger }) => {
		logger.debug('Initialization script was injected.');
		return logger;
	}),
]).then(function init([nonce, logger]) {
	const MAX_ATTEMPTS = 10;
	if ('ytInitialData' in self && 'ytcfg' in self) {
		const ev = new CustomEvent(`ytlcf-message:${nonce}`, {
			detail: {
				ytInitialData: JSON.stringify(self.ytInitialData),
				// @ts-expect-error
				ytcfg: JSON.stringify(self.ytcfg?.d()),
			},
		});
		let attempts = 0;
		const dispatch = () => {
			// @ts-expect-error
			if (Object.hasOwn(self.ytInitialData ?? {}, 'playerOverlays')) {
				const timer = setInterval(() => {
					if (document.querySelector('#movie_player video')) {
						clearInterval(timer);
						self.dispatchEvent(ev);
					} else if (attempts++ < MAX_ATTEMPTS) {
						logger.debug('Waiting for <video> element; retrying', attempts, 'of', MAX_ATTEMPTS);
					} else {
						clearInterval(timer);
					}
				}, 1000);
			} else {
				self.dispatchEvent(ev);
			}
		};
		if (document.visibilityState === 'visible') {
			dispatch();
		} else {
			logger.debug('Initialization begins after the visibility state becomes "visible".');
			self.addEventListener('visibilitychange', dispatch, { once: true, passive: true });
		}
	} else {
		logger.debug('Waiting for the page to load; retrying initialization in a second.');
		setTimeout(init, 1000, [nonce, logger]);
	}
});
