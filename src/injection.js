// @ts-nocheck
/** biome-ignore-all lint/complexity/useLiteralKeys: For recognize youtube data object */
(() => {
	const ev = new CustomEvent('ytlcf-message', {
		detail: {
			ytInitialData: JSON.stringify(window['ytInitialData']),
			ytcfg: JSON.stringify(window['ytcfg']?.d()),
		},
	});
	const dispatch = () => self.dispatchEvent(ev);
	if (document.visibilityState === 'visible') dispatch();
	else document.addEventListener('visibilitychange', dispatch, { once: true, passive: true });
})();
