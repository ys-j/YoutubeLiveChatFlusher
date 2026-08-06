/**
 * @param {string} loggingPath
 * @param {string} nonce
 */
export default function (loggingPath, nonce) {
	'use strict';
	import(loggingPath).then((/** @type {typeof import('../modules/logging.mjs')} */ { logger }) => {
		logger.debug('Initialization script was injected.');
		return logger;
	}).then(function init(logger, attempts = 0) {
		const MAX_ATTEMPTS = 10;
		if ('ytInitialData' in self && 'ytcfg' in self) {
			const ev = new CustomEvent(`ytlcf-message:${nonce}`, {
				detail: {
					ytInitialData: self.ytInitialData,
					// @ts-expect-error
					ytcfg: self.ytcfg?.d?.(),
				},
			});
			const dispatch = () => {
				// @ts-expect-error
				if (Object.hasOwn(self.ytInitialData ?? {}, 'playerOverlays')) {
					const timer = setInterval(() => {
						if (document.querySelector('#movie_player video')) {
							clearInterval(timer);
							self.dispatchEvent(ev);
						} else if (attempts++ < MAX_ATTEMPTS) {
							logger.debug('Waiting for <video> element; retrying', attempts, `of ${MAX_ATTEMPTS}`);
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
		} else if (attempts++ < MAX_ATTEMPTS) {
			logger.debug('Waiting for the page to load; retrying', attempts, `of ${MAX_ATTEMPTS}`);
			setTimeout(init, 1000, logger, attempts);
		} else {
			logger.error(`Failed to initialize after ${MAX_ATTEMPTS} attempts.`);
		}
	});
}
