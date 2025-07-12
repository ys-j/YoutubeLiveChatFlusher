/// <reference path="../../browser.d.ts" />
/// <reference path="../../extends.d.ts" />

/**
 * Initializes the PiP-mode menu.
 */
export function initPipMenu() {
	const pipmenuTop = document.getElementById('yt-lcf-pp');
	if ('documentPictureInPicture' in window) {
		const pipmenu = pipmenuTop || self.documentPictureInPicture?.window?.document.getElementById('yt-lcf-pp');
		pipmenu?.addEventListener('click',  async () => {
			const pipWindow = self.documentPictureInPicture?.window;
			if (pipWindow) {
				pipWindow.close();
			} else {
				const layer = document.getElementById('yt-lcf-layer');
				if (layer) {
					const player = layer.closest('#player-container');
					if (player) await openPip(player);
				}
			}
		}, { passive: true });
	} else {
		if (pipmenuTop) pipmenuTop.hidden = true;
	}
}

/**
 * Creates and opens document picture-in-picture window of the video player container.
 * @param {Element} element element of video player container
 * @returns {Promise<Window>} document picture-in-picture window
 */
export async function openPip(element) {
	const parent = element.parentElement;
	if (!parent) throw new Error('No parent element.');
	const pipWindow = await top?.documentPictureInPicture?.requestWindow({
		width: parent.clientWidth,
		height: parent.clientHeight,
	});
	if (!pipWindow) throw new Error('Document Picture-in-Picture API is not implemented.');

	top?.addEventListener('keydown', disableKeyboardShortcutOnParentWindow, true);
	pipWindow?.addEventListener('keydown', enableKeyboardShortcutOnChildWindow, true);

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
	pipLink.href = browser.runtime.getURL('../styles/content.css');
	const pipStyle = document.createElement('style');
	pipStyle.textContent = `:root,body,body>*{height:100%;overflow:hidden}.ytp-miniplayer-button,.ytp-size-button,.ytp-fullscreen-button{display:none!important}#yt-lcf-pp{display:none!important}`;
	
	pipWindow.document.head.append(pipMetaCharset, pipTitle, ...Array.from(element.ownerDocument.styleSheets, sheet => {
		if (sheet.href) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.type = sheet.type;
			link.media = Array.from(sheet.media).join();
			link.href = sheet.href;
			return link;
		} else {
			const style = document.createElement('style');
			style.textContent = Array.from(sheet.cssRules, rule => rule.cssText).join('');
			return style;
		}
	}), pipLink, pipStyle);

	const pipMarker = document.createElement('span');
	pipMarker.id = 'yt-lcf-pip-marker';
	pipMarker.textContent = browser.i18n.getMessage('pip_marker');
	element.before(pipMarker);
	pipWindow.document.body.appendChild(element);
	pipWindow.document.body.dataset.browser = document.body.dataset.browser;

	const video = pipWindow.document.querySelector('video');
	video?.addEventListener('ytlcf-resize', onResizeVideo, { passive: true });
	video?.addEventListener('loadeddata', e => {
		video.dispatchEvent(new CustomEvent('ytlcf-resize', { detail: pipWindow }));
	}, { passive: true });

	pipWindow.addEventListener('ytlcf-pip-update', () => {
		const pipTitle = pipWindow.document.getElementsByTagName('title')[0];
		if (pipTitle) {
			const title = document.querySelector('h1.ytd-watch-metadata')?.textContent;
			pipTitle.textContent = title || 'YouTube';
		}
	}, { passive: true });
	pipWindow.dispatchEvent(new CustomEvent('ytlcf-pip-update'));

	pipWindow.addEventListener('resize', () => {
		const video = pipWindow.document.querySelector('video');
		video?.dispatchEvent(new CustomEvent('ytlcf-resize', { detail: pipWindow }));
	}, { passive: true });

	pipWindow.addEventListener('pagehide', () => {
		const parent = pipMarker.parentElement || top?.document.getElementById('player-container-inner');
		parent?.append(element);
		if (parent) {
			const v = parent.querySelector('video');
			if (v) {
				v.style.width = `${parent.clientWidth|0}px`;
				v.style.height = 'auto';
				v.style.top = v.style.left = '0px';
				/** @type {HTMLElement?} */
				const b = parent.querySelector('.ytp-chrome-bottom');
				if (b) {
					const left = Number.parseInt(b.style.left);
					b.style.width = `${v.clientWidth - left * 2}px`;
				}
				v.removeEventListener('ytlcf-resize', onResizeVideo);
			}
		}
		if (top?.document.contains(pipMarker)) pipMarker.remove();
		top?.removeEventListener('keydown', disableKeyboardShortcutOnParentWindow, true);
		pipWindow.removeEventListener('keydown', enableKeyboardShortcutOnChildWindow, true);
		top?.removeEventListener('yt-navigate-finish', onYtNavigateFinishDispatchPip);
	}, { passive: true });
	return pipWindow;

	/**
	 * @param {CustomEvent} e 
	 */
	function onYtNavigateFinishDispatchPip(e) {
		pipWindow?.dispatchEvent(new CustomEvent('ytlcf-pip-update'));
	}
}

/**
 * Updates size of progress bar in picture-in-picture window.
 * @param {Window} win picture-in-picture window
 */
function updateProgressBarSize(win) {
	/** @type {HTMLElement?} */
	const bottomElem = win.document.querySelector('.ytp-chrome-bottom');
	if (bottomElem) {
		const left = Number.parseInt(bottomElem.style.left);
		const bottomWidth = win.innerWidth - left * 2;
		bottomElem.style.width = `${bottomWidth}px`;

		/** @type {HTMLElement?} */
		const progressBar = bottomElem.querySelector('.ytp-progress-bar');
		if (progressBar) {
			/** @type {HTMLElement?} */
			const hoverContainer = bottomElem.querySelector('.ytp-chapter-hover-container');
			const containerWidth = Number.parseInt(hoverContainer?.style.width || '0');
			if (containerWidth > 0) {
				progressBar.style.transformOrigin = '0 0 0';
				progressBar.style.transform = `scaleX(${bottomWidth / containerWidth})`;
			}
		}
		/** @type {HTMLElement?} */
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
	const w = Math.min(ww, (wh * aspect)|0);
	this.style.height = `${Math.min(wh, (w / aspect)|0)}px`;
	this.style.width = `${w}px`;
	this.style.left = `${Math.max(ww - w, 0) * .5}px`;
	updateProgressBarSize(e.detail);
}

const shortcutKeys = ['f', 'i', 't'];

/** 
 * @param {KeyboardEvent} e 
 */
function disableKeyboardShortcutOnParentWindow(e) {
	if (shortcutKeys.includes(e.key)) {
		e.stopImmediatePropagation();
	}
}

/**
 * @param {KeyboardEvent} e 
 */
function enableKeyboardShortcutOnChildWindow(e) {
	if (!shortcutKeys.includes(e.key)) {
		top?.dispatchEvent(new KeyboardEvent('keydown', e));
	}
}