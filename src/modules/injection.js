(function () {
	const ev = new CustomEvent('ytlcf-message', {
		detail: {
			ytInitialData: JSON.stringify(window['ytInitialData']),
			ytcfg: JSON.stringify(window['ytcfg']),
		},
	});
	self.dispatchEvent(ev);
})();