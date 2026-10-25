/**
 * @param {string} loggingPath absolute path to the logging module
 * @param {string} nonce nonce for the script
 * @param {object} params parameters for the script
 * @param {string} params.cssUrl URL of the CSS file to inject
 * @param {string} params.pipMarkerText text to display in the pip marker
 * @param {typeof import("../modules/store.mjs").DEFAULT_CONFIG.hotkeys} params.hotkeys JSON string of hotkeys to bind
 */
export default function (loggingPath, nonce, params) {
	(function initPipMenu() {
		const pipmenuTop = document.getElementById('yt-lcf-pp');
		if (self.documentPictureInPicture) {
			const pipmenu = pipmenuTop || self.documentPictureInPicture?.window?.document.getElementById('yt-lcf-pp');
			pipmenu?.addEventListener('click', async () => {
				const pipWindow = self.documentPictureInPicture?.window;
				if (pipWindow) {
					pipWindow.close();
				} else {
					const player = document.getElementById('yt-lcf-layer')?.closest('#player-container');
					/** @type {HTMLElement | null | undefined} */
					const settingsButton = player?.querySelector('.ytp-settings-button[aria-expanded="true"]');
					settingsButton?.click();
					if (player) await openPip(player);
				}
			}, { passive: true });
		} else {
			if (pipmenuTop) pipmenuTop.hidden = true;
		}

		/**
		 * Creates and opens document picture-in-picture window of the video player container.
		 * @param {Element} element element of video player container
		 * @returns {Promise<Window>} document picture-in-picture window
		 */
		async function openPip(element) {
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

			/** @type {typeof import('../modules/logging.mjs')} */
			const { logger } = await import(loggingPath);

			const disableHotkeys = disableKeyboardShortcutOnParentWindow.bind(params.hotkeys);
			const enableHotkeys = enableKeyboardShortcutOnChildWindow.bind(params.hotkeys);
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
			pipLink.href = params.cssUrl;
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

			/** @type {(HTMLElement & { setSize?: (width: number, height: number) => void, wakeUpControls?: () => void }) | null} */
			const player = element.querySelector('#movie_player');
			const pipMarker = document.createElement('span');
			pipMarker.id = 'yt-lcf-pip-marker';
			pipMarker.textContent = params.pipMarkerText || '';
			element.before(pipMarker);
			pipWindow.document.body.appendChild(element);
			pipWindow.document.body.dataset.browser = document.body.dataset.browser;

			const video = player?.querySelector('video');
			/** @type {?HTMLElement | undefined} */
			const overlay = player?.querySelector('.ytp-iv-video-content');
			const resizePlayer = () => {
				// Keep YouTube's video, controls and chapter geometry in sync without scaling the seek bar.
				player?.setSize?.(pipWindow.innerWidth, pipWindow.innerHeight);
			};

			video?.addEventListener('loadedmetadata', resizePlayer, { passive: true });
			video?.addEventListener('loadeddata', resizePlayer, { passive: true });
			if (video) video.style.pointerEvents = 'none';
			if (overlay) overlay.style.pointerEvents = 'none';

			pipWindow.addEventListener(`ytlcf-pip-update:${nonce}`, () => {
				const pipTitle = pipWindow.document.getElementsByTagName('title')[0];
				if (pipTitle) {
					const title = document.querySelector('h1.ytd-watch-metadata')?.textContent;
					pipTitle.textContent = title || 'YouTube';
				}
			});
			pipWindow.dispatchEvent(new CustomEvent(`ytlcf-pip-update:${nonce}`));

			pipWindow.addEventListener('resize', resizePlayer, { passive: true });
			pipWindow.addEventListener('mousemove', forwardMouseEvent, { passive: true });
			pipWindow.addEventListener('mouseup', forwardMouseEvent, { passive: true });

			pipWindow.addEventListener('pagehide', () => {
				const parent = pipMarker.parentElement || top?.document.getElementById('player-container-inner');
				parent?.append(element);
				if (parent) player?.setSize?.(parent.clientWidth, parent.clientHeight);
				video?.removeEventListener('loadedmetadata', resizePlayer);
				video?.removeEventListener('loadeddata', resizePlayer);
				if (video) video.style.pointerEvents = '';
				if (overlay) overlay.style.pointerEvents = '';
				if (top?.document.contains(pipMarker)) pipMarker.remove();
				top?.removeEventListener('keydown', disableHotkeys, true);
				pipWindow.removeEventListener('keydown', enableHotkeys, true);
				pipWindow.removeEventListener('resize', resizePlayer);
				pipWindow.removeEventListener('mousemove', forwardMouseEvent);
				pipWindow.removeEventListener('mouseup', forwardMouseEvent);
				top?.removeEventListener('yt-navigate-finish', onYtNavigateFinishDispatchPip);
			}, { passive: true });

			resizePlayer();

			logger.info('PiP /w chat window is created successfully.');
			return pipWindow;

			function onYtNavigateFinishDispatchPip() {
				pipWindow?.dispatchEvent(new CustomEvent(`ytlcf-pip-update:${nonce}`));
			}

			/** @param {MouseEvent} e */
			function forwardMouseEvent(e) {
				if (e.type === 'mousemove') player?.wakeUpControls?.();
				// YouTube's drag listeners remain on the opener document when its player moves.
				top?.document.dispatchEvent(new MouseEvent(e.type, e));
			}
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
	})();
}
