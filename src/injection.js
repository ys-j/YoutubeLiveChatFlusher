// @ts-nocheck
/** biome-ignore-all lint/complexity/useLiteralKeys: For recognize youtube data object */
(() => {
	const ev = new CustomEvent('ytlcf-message', {
		detail: {
			ytInitialData: JSON.stringify(window['ytInitialData']),
			ytcfg: JSON.stringify(window['ytcfg']?.d()),
		},
	});
	self.dispatchEvent(ev);
})();
