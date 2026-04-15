/// <reference path="../types/browser.d.ts" />
/// <reference path="../types/extends.d.ts" />

self.browser ??= chrome;

const isNotPip = () => !self.documentPictureInPicture?.window;

const manifest = browser.runtime.getManifest();
document.body.dataset.browser = 'browser_specific_settings' in manifest ? 'firefox' : 'chrome';

// inject script
self.addEventListener('ytlcf-message', e => {
	if (!e.detail) return;
	const { ytInitialData, ytcfg } = e.detail;
	if (ytInitialData) sessionStorage.setItem('ytlcf-initial-data', ytInitialData);
	if (ytcfg) sessionStorage.setItem('ytlcf-cfg', ytcfg);
	const path = location.pathname.split('/').find(Boolean);
	const detail = {
		pageType: path === 'watch' || path === 'live' ? 'watch' : 'browse',
		response: JSON.parse(ytInitialData),
	};
	const target = document.querySelector('ytd-app') || document.getElementById('player-container-id');
	if (target) {
		const url = browser.runtime.getURL('./modules/main.mjs');
		import(url).then(module => {
			module.initialize({ target, detail });
		});
	}
}, { passive: true });

self.addEventListener('ytlcf-ready', e => {
	e.stopImmediatePropagation();
	console.info(`${manifest.name} is ready!`);
}, { passive: true });

document.addEventListener('yt-action', e => {
	const name = e.detail?.actionName;
	switch (name) {
		case 'ytd-watch-player-data-changed': {
			const ev = new CustomEvent(name);
			if (!isNotPip()) self.documentPictureInPicture?.window?.dispatchEvent(ev);
			checkAutoStart();
		}
	}
}, { passive: true });

async function checkAutoStart() {
	const store = await browser.storage.local.get('others');
	const enabled = store?.others?.autostart;
	if (!enabled) return false;

	const container = document.getElementById('show-hide-button');
	if (!container || container.hidden) return false;

	const button = container.querySelector('button');
	if (button?.closest('#close-button')) return false;

	button?.click();
	return true;
}
