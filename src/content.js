(function () {
	'use strict';
	// @ts-expect-error
	self.browser ??= chrome;

	const manifest = browser.runtime.getManifest();

	/** @type {Promise<typeof import("./modules/logging.mjs")>} */
	const importingLogging = import(browser.runtime.getURL('./modules/logging.mjs'));
	/** @type {Promise<typeof import("./modules/store.mjs")>} */
	const importingStore = import(browser.runtime.getURL('./modules/store.mjs'));
	/** @type {Promise<typeof import("./modules/main.mjs")>} */
	const importingMain = import(browser.runtime.getURL('./modules/main.mjs'));

	async function checkAutoStart() {
		const s = await importingStore.then(({ store }) => store.load());
		const enabled = [ false, s?.others?.mode_replay !== 1, true ].at(s?.others?.autostart ?? 0);
		if (!enabled) return false;

		const container = document.getElementById('show-hide-button');
		if (!container || container.hidden) return false;

		const button = container.querySelector('button');
		if (button?.closest('#close-button')) return false;

		button?.click();
		return true;
	};

	importingLogging.then(async ({ logger }) => {
		const MAX_ATTEMPTS = 10;
		const nonce = crypto.randomUUID();

		// fires when the injected script sends a message
		self.addEventListener(`ytlcf-message:${nonce}`, e => {
			if (!('ytInitialData' in e.detail && 'ytcfg' in e.detail)) {
				logger.error('Failed to get a message from the injected script.');
				return;
			}
			logger.debug('Successfully received initialization message from the injected script:', e.detail);

			const { INNERTUBE_API_KEY, INNERTUBE_CONTEXT, DATASYNC_ID } = e.detail.ytcfg;
			sessionStorage.setItem('INNERTUBE_API_KEY', INNERTUBE_API_KEY);
			sessionStorage.setItem('INNERTUBE_CONTEXT', JSON.stringify(INNERTUBE_CONTEXT));
			sessionStorage.setItem('DATASYNC_ID', DATASYNC_ID);

			const path = location.pathname.split('/').find(Boolean) || '';
			const detail = {
				pageType: ['watch', 'live'].includes(path) ? 'watch' : 'browse',
				response: e.detail.ytInitialData,
			};

			let attempts = 0;
			const timer = setInterval(() => {
				const target = document.querySelector('ytd-app') || document.getElementById('player-container-id');
				if (!target) {
					logger.debug('Waiting for <ytd-app> element.');
					if (attempts++ < MAX_ATTEMPTS) return;
					else return clearInterval(timer);
				}
				importingMain.then(module => {
					return module.initialize({ target, detail });
				}).catch(err => {
					logger.error('Failed to startup.\nCaused by:', err);
				});
				clearInterval(timer);
			}, 1000);
		});

		return browser.runtime.sendMessage({
			injection: 'init',
			details: { nonce },
		});
	}).then(() => {
		(function check() {
			if (document.body) {
				document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';
				document.addEventListener('yt-action', e => {
					const name = e.detail?.actionName;
					switch (name) {
						case 'ytd-watch-player-data-changed': {
							const ev = new CustomEvent(name);
							self.documentPictureInPicture?.window?.dispatchEvent(ev);
							checkAutoStart();
						}
					}
				});
			} else {
				requestAnimationFrame(check);
			}
		})();
	}).catch(err => {
		console.error(
			'[%cYTLCF%c...<%c]',
			'font-family:sans-serif;font-weight:700;padding-right:.33em',
			'border-radius:.33em;background-color:red;color:white;font-family:sans-serif;font-weight:700;padding:0 .33em',
			'',
			'Failed to inject the initialization script.\nCaused by:', err
		);
	});
})();
