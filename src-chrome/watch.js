export async function checkAutoStart() {
	const storage = await browser.storage.local.get('others');
	const autostart = storage?.others?.autostart;
	if (autostart) {
		const buttonContainer = document.getElementById('show-hide-button');
		if (buttonContainer && !buttonContainer.hidden) {
			const button = buttonContainer.querySelector('button');
			const isClose = button?.closest('#close-button');
			if (!isClose) {
				button?.click();
				return true;
			}
		}
	}
	return false;
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
	pipMetaCharset.name = 'charset';
	pipMetaCharset.content = 'utf-8';
	const pipTitle = document.createElement('title');
	pipTitle.textContent = /** @type {HTMLElement?} */ (document.querySelector('h1.ytd-watch-metadata'))?.innerText || 'YouTube';
	const pipLink = document.createElement('link');
	pipLink.rel = 'stylesheet';
	pipLink.type = 'text/css';
	pipLink.href = browser.runtime.getURL('content.css');
	const pipStyle = document.createElement('style');
	pipStyle.textContent = `:root,body,body>*{height:100%;overflow:hidden}.ytp-miniplayer-button,.ytp-size-button,.ytp-fullscreen-button{display:none!important}#${tags.popuppip}{display:none!important}`;
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

	const marker = document.createElement('span');
	marker.id = tags.pipmarker;
	marker.textContent = $msg('pip_marker');
	element.before(marker);
	pipWindow.document.body.appendChild(element);
	let video = pipWindow.document.querySelector('video');
	const observeOptions = { attributes: true, attributeFilter: ['data-time', 'class'] };
	const observer = new MutationObserver(records => {
		if (video) for (const _ of records) {
			const { innerWidth: ww, innerHeight: wh } = pipWindow;
			const vw = video.videoWidth, vh = video.videoHeight, cw = video.clientWidth;;
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
		if (pipTitle) pipTitle.textContent = /** @type {HTMLElement?} */ (document.querySelector('h1.ytd-watch-metadata'))?.innerText || 'YouTube';
	});
	pipWindow.dispatchEvent(new CustomEvent('ytd-watch-player-data-changed'));
	pipWindow.addEventListener('resize', () => {
		setTimeout(/** @param {HTMLVideoElement?} v */ v => {
			if (v) v.dataset.time = `${v.currentTime}`;
		}, 500, video || pipWindow.document.querySelector('video'));
	}, { passive: true });
	pipWindow.addEventListener('pagehide', () => {
		if (top?.document.contains(marker)) {
			marker.after(element);
			const parent = marker.parentElement;
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
			marker.remove();
			top?.removeEventListener('keydown', disableKeyboardShortcutOnParentWindow, true);
			pipWindow.removeEventListener('keydown', enableKeyboardShortcutOnChildWindow, true);
		}
	}, { passive: true });
	return pipWindow;
}

/** @param {KeyboardEvent} e */
function disableKeyboardShortcutOnParentWindow(e) {
	switch (e.key) {
		case 'i':
		case 't':
		case 'f':
			e.stopImmediatePropagation();
	}
}
/**  @param {KeyboardEvent} e */
function enableKeyboardShortcutOnChildWindow(e) {
	switch (e.key) {
		case 'i':
		case 't':
		case 'f':
			break;
		default:
			top?.dispatchEvent(e);
	}
}