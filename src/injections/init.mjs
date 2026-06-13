import { logger } from '../modules/logging.mjs';

logger.debug('Initialization script was injected.');

(function init() {
	if ('ytInitialData' in self && 'ytcfg' in self) {
		const ev = new CustomEvent('ytlcf-message', {
			detail: {
				ytInitialData: JSON.stringify(self.ytInitialData),
				// @ts-expect-error
				ytcfg: JSON.stringify(self.ytcfg?.d()),
			},
		});

		const dispatch = () => {
			// @ts-expect-error
			if (Object.hasOwn(self.ytInitialData ?? {}, 'playerOverlays')) {
				const timer = setInterval(() => {
					if (document.querySelector('#movie_player video')) {
						clearInterval(timer);
						self.dispatchEvent(ev);
					} else {
						logger.debug('Waiting for <video> element; retrying initialization in a second.');
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
		setTimeout(init, 1000);
	}
})();
