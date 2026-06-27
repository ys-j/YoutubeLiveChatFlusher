import { logger } from '../modules/logging.mjs';

/**
 * Initializes the PiP-mode menu.
 */
(function initPipMenu() {
	const pipmenuTop = document.getElementById('yt-lcf-pp');
	if (window.documentPictureInPicture) {
		const pipmenu = pipmenuTop || self.documentPictureInPicture?.window?.document.getElementById('yt-lcf-pp');
		pipmenu?.addEventListener('click',  async () => {
			const pipWindow = self.documentPictureInPicture?.window;
			if (pipWindow) {
				pipWindow.close();
			} else {
				const player = document.getElementById('yt-lcf-layer')?.closest('#player-container');
				const dataset = document.getElementById('yt-lcf-pip-script')?.dataset;
				if (player && dataset) await openPip(player, dataset);
			}
		}, { passive: true });
	} else {
		if (pipmenuTop) pipmenuTop.hidden = true;
	}
})();

/**
 * Creates and opens document picture-in-picture window of the video player container.
 * @param {Element} element element of video player container
 * @param {DOMStringMap} dataset dataset of injected `<script>` (self)
 * @returns {Promise<Window>} document picture-in-picture window
 */
async function openPip(element, dataset) {
	const parent = element.parentElement;
	if (!parent) throw new Error('No parent element.');
	const pipWindow = await top?.documentPictureInPicture?.requestWindow({
		width: parent.clientWidth,
		height: parent.clientHeight,
	});
	if (!pipWindow) throw new Error('Document Picture-in-Picture API is not implemented.');

	try {
		void pipWindow.origin;
	} catch (cause) {
		pipWindow.close();
		throw new Error('Access to document picture-in-picture window was denied.', { cause });
	}

	/** @type {Record<string, { key: string, alt: boolean }>} */
	const userDefinedHotkeys = JSON.parse(dataset.paramHotkeys ?? '{}');
	const disableHotkeys = disableKeyboardShortcutOnParentWindow.bind(userDefinedHotkeys);
	const enableHotkeys = enableKeyboardShortcutOnChildWindow.bind(userDefinedHotkeys);
	top?.addEventListener('keydown', disableHotkeys, true);
	pipWindow?.addEventListener('keydown', enableHotkeys, true);
	top?.addEventListener('yt-navigate-finish', onYtNavigateFinishDispatchPip, { passive: true });

	for (const attr of document.documentElement.attributes) {
		pipWindow.document.documentElement.attributes.setNamedItem(attr.cloneNode());
	}
	const pipMetaCharset = document.createElement('meta');
	pipMetaCharset.setAttribute('charset', 'utf-8');
	const pipTitle = document.createElement('title');
	pipTitle.textContent = document.querySelector('h1.ytd-watch-metadata')?.textContent || 'YouTube';
	const pipLink = document.createElement('link');
	pipLink.rel = 'stylesheet';
	pipLink.type = 'text/css';
	pipLink.href = dataset.paramCssUrl || '';
	const pipStyle = document.createElement('style');
	pipStyle.textContent = `\
	:root,body,body>*{height:100%;overflow:hidden}\
	.ytp-miniplayer-button,.ytp-size-button,.ytp-fullscreen-button{display:none!important}\
	#yt-lcf-pp{display:none!important}\
	`;

	/** @type {(HTMLLinkElement | HTMLStyleElement)[]} */
	const copiedStyles = [];
	for (const sheet of element.ownerDocument.styleSheets) {
		if (sheet.href) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.type = sheet.type;
			link.media = Array.from(sheet.media).join();
			link.href = sheet.href;
			copiedStyles.push(link);
		} else {
			try {
				const rules = sheet.cssRules;
				const style = document.createElement('style');
				style.textContent = Array.from(rules, rule => rule.cssText).join('');
				copiedStyles.push(style);
			} catch (err) {
				logger.warn(err, sheet.ownerNode);
			}
		}
	}
	pipWindow.document.head.append(pipMetaCharset, pipTitle, ...copiedStyles, pipLink, pipStyle);

	const pipMarker = document.createElement('span');
	pipMarker.id = 'yt-lcf-pip-marker';
	pipMarker.textContent = dataset.paramPipMarkerText || '';
	element.before(pipMarker);
	pipWindow.document.body.appendChild(element);
	pipWindow.document.body.dataset.browser = document.body.dataset.browser;

	const player = pipWindow.document.querySelector('ytd-player');
	const video = player?.querySelector('video');
	/** @type {?HTMLElement | undefined} */
	const overlay = player?.querySelector('.ytp-iv-video-content');

	video?.addEventListener('ytlcf-resize', onResizeVideo);
	video?.addEventListener('loadeddata', dispatchResizeVideo, { passive: true });
	if (video) video.style.pointerEvents = 'none';
	if (overlay) overlay.style.pointerEvents = 'none';

	pipWindow.addEventListener('ytlcf-pip-update', () => {
		const pipTitle = pipWindow.document.getElementsByTagName('title')[0];
		if (pipTitle) {
			const title = document.querySelector('h1.ytd-watch-metadata')?.textContent;
			pipTitle.textContent = title || 'YouTube';
		}
	});
	pipWindow.dispatchEvent(new CustomEvent('ytlcf-pip-update'));

	pipWindow.addEventListener('resize', () => {
		const video = pipWindow.document.querySelector('video');
		video?.dispatchEvent(new CustomEvent('ytlcf-resize', { detail: pipWindow }));
	}, { passive: true });

	pipWindow.addEventListener('pagehide', () => {
		const parent = pipMarker.parentElement || top?.document.getElementById('player-container-inner');
		parent?.append(element);
		if (parent && video) {
			video.style.width = `${parent.clientWidth | 0}px`;
			video.style.height = 'auto';
			video.style.top = video.style.left = '0px';
			/** @type {?HTMLElement} */
			const b = parent.querySelector('.ytp-chrome-bottom');
			if (b) {
				const left = Number.parseInt(b.style.left, 10);
				b.style.width = `${video.clientWidth - left * 2}px`;
			}
			video.removeEventListener('ytlcf-resize', onResizeVideo);
			video.removeEventListener('loadeddata', dispatchResizeVideo);
			video.style.pointerEvents = '';
			if (overlay) overlay.style.pointerEvents = '';
		}
		if (top?.document.contains(pipMarker)) pipMarker.remove();
		top?.removeEventListener('keydown', disableHotkeys, true);
		pipWindow.removeEventListener('keydown', enableHotkeys, true);
		top?.removeEventListener('yt-navigate-finish', onYtNavigateFinishDispatchPip);
	}, { passive: true });

	if (video) {
		const le = document.getElementById('yt-lcf-layer');
		if (le?.style.maskPosition) le.style.maskPosition = `0px 0px, ${video.style.left} ${video.style.top}`;
		if (le?.style.maskSize) le.style.maskSize = `100% 100%, ${video.style.width} ${video.style.height}`;
	}

	logger.info('PiP /w chat window is created successfully.');
	return pipWindow;

	function onYtNavigateFinishDispatchPip() {
		pipWindow?.dispatchEvent(new CustomEvent('ytlcf-pip-update'));
	}

	/** @this {HTMLVideoElement} */
	function dispatchResizeVideo() {
		this.dispatchEvent(new CustomEvent('ytlcf-resize', { detail: pipWindow }));
	}
}

/**
 * Updates size of progress bar in picture-in-picture window.
 * @param {Window} win picture-in-picture window
 */
function updateProgressBarSize(win) {
	/** @type {?HTMLElement} */
	const bottomElem = win.document.querySelector('.ytp-chrome-bottom');
	if (bottomElem) {
		const left = Number.parseInt(bottomElem.style.left, 10);
		const bottomWidth = win.innerWidth - left * 2;
		bottomElem.style.width = `${bottomWidth}px`;

		/** @type {?HTMLElement} */
		const progressBar = bottomElem.querySelector('.ytp-progress-bar');
		if (progressBar) {
			/** @type {?HTMLElement} */
			const hoverContainer = bottomElem.querySelector('.ytp-chapter-hover-container');
			const containerWidth = Number.parseInt(hoverContainer?.style.width || '0', 10);
			if (containerWidth > 0) {
				progressBar.style.transformOrigin = '0 0 0';
				progressBar.style.transform = `scaleX(${bottomWidth / containerWidth})`;
			}
		}
		/** @type {?HTMLElement} */
		const heatMap = bottomElem.querySelector('.ytp-heat-map-chapter');
		if (heatMap) {
			heatMap.style.width = '100%';
		}
	}
}

/**
 * @this {HTMLVideoElement}
 * @param {CustomEvent<Window>} e
 */
function onResizeVideo(e) {
	const { innerWidth: ww, innerHeight: wh } = e.detail;
	const { videoWidth: vw, videoHeight: vh } = this;
	if (!vw || !vh) return;
	const aspect = vw / vh;
	const w = Math.min(ww, (wh * aspect) | 0);
	this.style.height = `${Math.min(wh, (w / aspect) | 0)}px`;
	this.style.width = `${w}px`;
	this.style.left = `${Math.max(ww - w, 0) * .5}px`;
	updateProgressBarSize(e.detail);
}

/**
 * @this {Record<string, { key: string, alt: boolean }>}
 * @param {KeyboardEvent} e
 */
function disableKeyboardShortcutOnParentWindow(e) {
	if (['f', 'i', 't', 'escape'].includes(e.key.toLowerCase())) {
		e.stopPropagation();
	} else if (Object.values(this).some(h => h.key === e.key && h.alt === e.altKey)) {
		// transfer keyboard event to pip window
		top?.documentPictureInPicture?.window?.dispatchEvent(new KeyboardEvent('keydown', e));
	}
}

/**
 * @this {Record<string, { key: string, alt: boolean }>}
 * @param {KeyboardEvent} e
 */
function enableKeyboardShortcutOnChildWindow(e) {
	if (['f', 'i', 't', 'escape', 'k'].includes(e.key.toLowerCase())) return;
	if (!e.ctrlKey && !e.metaKey) {
		const document = top?.documentPictureInPicture?.window?.document;
		switch (e.key) {
			case this.layer.key:
				if (!e.repeat && e.altKey === this.layer.alt) {
					const checkbox = /** @type {?HTMLElement} */ (document?.querySelector('#yt-lcf-cb'));
					return checkbox?.click();
				}
				break;
			case this.panel.key:
				if (!e.repeat && e.altKey === this.panel.alt) {
					const popupmenu = /** @type {?HTMLElement} */ (document?.querySelector('#yt-lcf-pm'));
					return popupmenu?.click();
				}
				break;
			case this.pip.key:
				if (!e.repeat && e.altKey === this.pip.alt) {
					const pipmenu = /** @type {?HTMLElement} */ (document?.querySelector('#yt-lcf-pp'));
					return pipmenu?.click();
				}
				break;
		}
	}
	// transfer keyboard event to parent window
	top?.document.dispatchEvent(new KeyboardEvent('keydown', e));
}
