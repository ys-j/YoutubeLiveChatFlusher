/// <reference path="../../browser.d.ts" />

export function initPipMenu() {
	/** @type {HTMLElement?} */
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
 * @param {Element} element 
 */
export async function openPip(element) {
	const parent = element.parentElement;
	if (!parent) throw new Error('No parent element.');
	/** @type {Window?} */ // @ts-ignore
	const pipWindow = await top?.documentPictureInPicture?.requestWindow({
		width: parent.clientWidth,
		height: parent.clientHeight,
	});
	if (!pipWindow) throw new Error('Document Picture-in-Picture API is not implemented.');

	top?.addEventListener('keydown', disableKeyboardShortcutOnParentWindow, true);
	pipWindow?.addEventListener('keydown', enableKeyboardShortcutOnChildWindow, true);
	
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
	const observeOptions = { attributes: true, attributeFilter: ['data-time', 'class'] };
	const observer = new MutationObserver(records => {
		if (video) for (const _ of records) {
			const { innerWidth: ww, innerHeight: wh } = pipWindow;
			const { videoWidth: vw, videoHeight: vh, clientWidth: cw } = video;
			const aspect = vw / vh;
			const w = Math.min(ww, (wh * aspect)|0);
			video.style.height = `${Math.min(wh, (w / aspect)|0)}px`;
			video.style.width = `${w}px`;
			video.style.left = `${Math.max(ww - cw, 0) * .5}px`;
		}
	});
	if (video) observer.observe(video, observeOptions);
	pipWindow.addEventListener('ytd-watch-player-data-changed', () => {
		setTimeout(/** @param {HTMLVideoElement?} v */ v => {
			if (v) v.dataset.time = `${v.currentTime}`;
		}, 500, video || pipWindow.document.querySelector('video'));
		const pipTitle = pipWindow.document.getElementsByTagName('title')[0];
		if (pipTitle) {
			pipTitle.textContent = /** @type {HTMLElement?} */ (document.querySelector('h1.ytd-watch-metadata'))?.innerText || 'YouTube';
		}
	});
	pipWindow.dispatchEvent(new CustomEvent('ytd-watch-player-data-changed'));

	pipWindow.addEventListener('resize', e => {
		const w = /** @type {Window} */ (e.target);
		const v = video || w.document.querySelector('video');
		if (v) {
			// const { innerWidth: ww, innerHeight: wh } = pipWindow;
			// const { videoWidth: vw, videoHeight: vh, clientWidth: cw } = v;
			// w.resizeTo((vw / vh) * wh, wh);
			setTimeout(/** @param {HTMLVideoElement?} v */ v => {
				if (v) v.dataset.time = `${v.currentTime}`;
			}, 500, v);
		}
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
			}
		}
		observer.disconnect();
		if (top?.document.contains(pipMarker)) pipMarker.remove();
		top?.removeEventListener('keydown', disableKeyboardShortcutOnParentWindow, true);
		pipWindow.removeEventListener('keydown', enableKeyboardShortcutOnChildWindow, true);
	}, { passive: true });
	return pipWindow;
}

const shortcutKeys = ['f', 'i', 't'];

/** @param {KeyboardEvent} e */
function disableKeyboardShortcutOnParentWindow(e) {
	if (shortcutKeys.includes(e.key)) {
		e.stopImmediatePropagation();
	}
}

/**  @param {KeyboardEvent} e */
function enableKeyboardShortcutOnChildWindow(e) {
	if (!shortcutKeys.includes(e.key)) {
		top?.dispatchEvent(e);
	}
}