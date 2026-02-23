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
	const target = document.querySelector('ytd-app') || document.getElementById('player-container-id');
	const detail = {
		pageType: ['/watch', '/live'].includes(location.pathname) ? 'watch' : 'browser',
		response: JSON.parse(ytInitialData),
	};
	if (target) {
		const url = browser.runtime.getURL('./modules/main.js');
		import(url).then(module => {
			module.initialize({ target, detail });
		});
	}
}, { passive: true });

setTimeout(() => {
	const script = document.createElement('script');
	script.src = browser.runtime.getURL('./modules/injection.js');
	document.body.append(script);
}, 1000);

self.addEventListener('ytlcf-ready', e => {
	e.stopImmediatePropagation();
	console.info(manifest.name + ' is ready!');
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