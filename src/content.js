// @ts-expect-error
self.browser ??= chrome;

const manifest = browser.runtime.getManifest();

const preparingEventListener = import(browser.runtime.getURL('./modules/logging.mjs'))
.then((/** @type {typeof import("./modules/logging.mjs")} */ { logger }) => {
	/** @type {Promise<typeof import("./modules/main.mjs")>} */
	const importingMain = import(browser.runtime.getURL('./modules/main.mjs'));

	// fires when the injected script sends a message
	self.addEventListener('ytlcf-message', e => {
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
		const timer = setInterval(async () => {
			const target = document.querySelector('ytd-app') || document.getElementById('player-container-id');
			if (!target) {
				logger.debug('Waiting for <ytd-app> element.');
				return;
			}
			try {
				const { initialize } = await importingMain;
				initialize({ target, detail });
			} catch (err) {
				logger.error('Failed to startup.\nCaused by:', err);
			} finally {
				clearInterval(timer);
			}
		}, 1000);
	});

	// fires when initialization is complete
	self.addEventListener('ytlcf-ready', e => {
		e.stopImmediatePropagation();
		logger.info(`${manifest.name} is ready!`);
	});
});

Promise.all([
	preparingEventListener,
	new Promise(resolve => {
		(function check() {
			if (document.body) resolve(document.body);
			else requestAnimationFrame(check);
		})();
	}),
]).then(() => {
	document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

	const script = document.createElement('script');
	script.src = browser.runtime.getURL('./injections/init.mjs');
	script.type = 'module';
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
