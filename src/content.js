(function () {
	'use strict';
	// @ts-expect-error
	self.browser ??= chrome;

	const MAX_ATTEMPTS = 10;

	const manifest = browser.runtime.getManifest();

	/** @type {Promise<typeof import("./modules/logging.mjs")>} */
	const importingLogging = import(browser.runtime.getURL('./modules/logging.mjs'));
	/** @type {Promise<typeof import("./modules/store.mjs")>} */
	const importingStore = import(browser.runtime.getURL('./modules/store.mjs'));
	/** @type {Promise<typeof import("./modules/utils.mjs")>} */
	const importingUtils = import(browser.runtime.getURL('./modules/utils.mjs'));
	/** @type {Promise<typeof import("./modules/main.mjs")>} */
	const importingMain = import(browser.runtime.getURL('./modules/main.mjs'));

	const preparingEventListener = Promise.all([
		importingLogging.then(({ logger }) => logger),
		importingUtils.then(({ nonce }) => nonce),
	]).then(async ([logger, nonce]) => {
		// fires when the injected script sends a message
		self.addEventListener(`ytlcf-message:${nonce}`, e => {
			const { ytInitialData, ytcfg } = e.detail ?? {};
			if (!ytInitialData || !ytcfg) {
				logger.error('Failed to get a message from the injected script.');
				return;
			}
			logger.debug('Getting initialization message from the injected script.');
			sessionStorage.setItem('ytlcf-initial-data', ytInitialData);
			sessionStorage.setItem('ytlcf-cfg', ytcfg);

			const path = location.pathname.split('/').find(Boolean) || '';
			const detail = {
				pageType: ['watch', 'live'].includes(path) ? 'watch' : 'browse',
				response: JSON.parse(ytInitialData),
			};

			let attempts = 0;
			const timer = setInterval(() => {
				const target = document.querySelector('ytd-app') || document.getElementById('player-container-id');
				if (!target) {
					logger.debug('Waiting for <ytd-app> element.');
					if (attempts++ > MAX_ATTEMPTS) clearInterval(timer);
					return;
				}
				importingMain.then(module => {
					return module.initialize({ target, detail });
				}).catch(err => {
					logger.error('Failed to startup.\nCaused by:', err);
				});
				clearInterval(timer);
			}, 1000);
		});

		self.addEventListener(`ytlcf-ready:${nonce}`, e => {
			e.stopImmediatePropagation();
			logger.info(`${manifest.name} is ready!`);
		});

		return nonce;
	});

	Promise.all([
		preparingEventListener,
		new Promise(resolve => {
			(function check() {
				if (document.body) resolve(document.body);
				else requestAnimationFrame(check);
			})();
		}),
	]).then(([nonce, _body]) => {
		document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

		const script = document.createElement('script');
		script.src = browser.runtime.getURL('./injections/init.js');
		script.dataset.nonce = nonce || '';
		document.body.appendChild(script);

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
	}).catch(err => {
		console.error(
			'[%cYTLCF%c...<%c]',
			'font-family:sans-serif;font-weight:700;padding-right:.33em',
			'border-radius:.33em;background-color:red;color:white;font-family:sans-serif;font-weight:700;padding:0 .33em',
			'',
			'Failed to inject the initialization script.\nCaused by:', err
		);
	});

	const checkAutoStart = async () => {
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
})();
