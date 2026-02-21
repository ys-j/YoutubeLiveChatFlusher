self.browser ??= chrome;

const isLive = location.pathname === '/live_chat';
const modeName = isLive ? 'mode_livestream' : 'mode_replay';

browser.storage.local.get('others').then(storage => {
	const mode = storage?.others?.[modeName] ?? 1;
	if (mode === 0) {
		document.addEventListener('yt-action', e => {
			if (e.detail?.actionName === 'yt-live-chat-actions') {
				const ev = new CustomEvent('ytlcf-start', { detail: e.detail?.args?.at(0) || [] });
				top?.dispatchEvent(ev);
			}
		}, { passive: true });
	}
});