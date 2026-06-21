const loggingUrl = browser.runtime.getURL('./modules/logging.mjs');
import(loggingUrl).then((/** @type {typeof import("./modules/logging.mjs")} */ { logger }) => {
	// @ts-expect-error
	self.browser ??= chrome;

	const manifest = browser.runtime.getManifest();
	document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

	self.addEventListener('ytlcf-message', e => {
		const { ytInitialData, ytcfg } = e.detail ?? {};
		if (!ytInitialData || !ytcfg) {
			logger.error('Failed to get a message from the injected script.');
			return;
		}
		logger.debug('Getting initialization message from the injected script.');
		sessionStorage.setItem('ytlcf-initial-data', ytInitialData);
		sessionStorage.setItem('ytlcf-cfg', ytcfg);

		const path = location.pathname.split('/').find(Boolean);
		const detail = {
			pageType: path === 'watch' || path === 'live' ? 'watch' : 'browse',
			response: JSON.parse(ytInitialData),
		};
		const timer = setInterval(async () => {
			const target = document.querySelector('ytd-app') || document.getElementById('player-container-id');
			if (!target) {
				logger.debug('Waiting for <ytd-app> element.');
				return;
			}
			try {
				/** @type {typeof import("./modules/main.mjs")} */
				const { initialize } = await import(browser.runtime.getURL('./modules/main.mjs'));
				initialize({ target, detail });
			} catch (e) {
				logger.error('Failed to startup.\nCaused by:', e);
			} finally {
				clearInterval(timer);
			}
		}, 1000);
	}, { passive: true });

	self.addEventListener('ytlcf-ready', e => {
		e.stopImmediatePropagation();
		logger.info(`${manifest.name} is ready!`);
	}, { passive: true });

	document.addEventListener('yt-action', e => {
		const name = e.detail?.actionName;
		switch (name) {
			case 'ytd-watch-player-data-changed': {
				const ev = new CustomEvent(name);
				self.documentPictureInPicture?.window?.dispatchEvent(ev);
				checkAutoStart();
			}
		}
	}, { passive: true });

	async function checkAutoStart() {
		const storeUrl = browser.runtime.getURL('./modules/store.mjs');
		const s = await import(storeUrl).then((/** @type {typeof import("./modules/store.mjs")} */ { store }) => store.load());
		const enabled = [ false, s?.others?.mode_replay !== 1, true ].at(s?.others?.autostart ?? 0);
		if (!enabled) return false;

		const container = document.getElementById('show-hide-button');
		if (!container || container.hidden) return false;

		const button = container.querySelector('button');
		if (button?.closest('#close-button')) return false;

		button?.click();
		return true;
	}

	const script = document.createElement('script');
	script.src = browser.runtime.getURL('./injections/init.mjs');
	script.type = 'module';
	document.body.appendChild(script);
}).catch(console.error);
