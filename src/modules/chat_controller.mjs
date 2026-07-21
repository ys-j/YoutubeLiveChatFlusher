import { logger } from './logging.mjs';
import { store as s } from './store.mjs';
import { isNotPip, loadTemplateDocument, getColorRGB } from './utils.mjs';

import { LiveChatLayer, VideoSegmentationExecutor } from './chat_layer.mjs'
import { LiveChatPanel, WrapStyleDefinitions } from './chat_panel.mjs';
import { LiveChatContextMenu } from './chat_contextmenu.mjs';
import { LiveChatItemFactory, EmojiModeEnum, renderChatItem, updateMutedWordsList, updateTlExclusionList } from './chat_message.mjs';
import { LiveChatLayoutCache, layoutChatItem } from './chat_layout.mjs';

export const SimultaneousModeEnum = Object.freeze({
	ALL: 0,
	FIRST: 1,
	MERGE: 2,
	LAST_MERGE: 3,
});
/** @typedef {typeof SimultaneousModeEnum[keyof typeof SimultaneousModeEnum]} SimultaneousModeEnum */

export class LiveChatController {
	/** @type {boolean} */
	#skip = false;
	/** @type {MutationObserver} */
	#layerSizeObserver;

	/** @type {"desktop" | "mobile"} */ device;
	/** @type {HTMLElement} */ player;
	/** @type {LiveChatLayer} */ layer;
	/** @type {LiveChatLayoutCache} */ layoutCache;
	/** @type {LiveChatItemFactory} */ itemFactory;
	/** @type {LiveChatPanel} */ panel;
	/** @type {LiveChatContextMenu} */ contextmenu;
	/** @type {AbortController} */ abortController;

	/** @type {boolean} */
	listening = false;
	/** @type {?VideoSegmentationExecutor} */
	segmenter = null;

	/**
	 * @param {HTMLElement} player YouTube player element
	 */
	constructor(player) {
		this.device = player.tagName.toLowerCase() === 'ytd-app' ? 'desktop' : 'mobile';
		this.player = player;

		this.layer = new LiveChatLayer(this);
		const root = this.layer.root;
		this.layoutCache = new LiveChatLayoutCache(root);
		this.itemFactory = new LiveChatItemFactory();

		root.addEventListener('contextmenu', e => {
			/** @type {?HTMLElement | undefined} */
			const origin = /** @type {?HTMLElement} */ (e.target)?.closest('[id]');
			if (origin && s.others.message_pause) {
				e.preventDefault();
				e.stopPropagation();
				if (origin.classList.contains('paused') && this.panel) {
					this.contextmenu.show(/** @type {MouseEvent} */ (e), origin, this.panel);
				} else {
					origin.classList.add('paused');
				}
			}
		}, { passive: false });
		root.addEventListener('click', e => {
			const origin = /** @type {?HTMLElement} */ (e.target);
			const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
			if (interactiveTags.includes(origin?.tagName || 'BODY')) {
				e.stopPropagation();
			} else {
				origin?.parentElement?.click();
			}
		}, { passive: true });
		root.addEventListener('animationend', e => {
			const elem = /** @type {HTMLElement} */ (e.target);
			if (elem.parentNode === root) {
				this.layoutCache.delete(elem.id);
				elem.remove();
			}
		}, { passive: true });

		this.panel = new LiveChatPanel(this);
		this.contextmenu = new LiveChatContextMenu();
		this.abortController = new AbortController();

		this.#layerSizeObserver = new MutationObserver(() => {
			this.layer.autofit(s.others.layer_autofit > 0);
		});
	}

	async start() {
		/** @type {?HTMLVideoElement} */
		const video = this.player.querySelector('#movie_player video');
		const videoContainer = video?.parentElement;
		if (!video || !videoContainer) {
			throw 'No video container element found.';
		}

		document.getElementById(this.panel.element.id)?.remove();

		// get storage data
		await s.load();
		// create form
		await this.panel.createForm();

		document.getElementById(this.layer.element.id)?.remove();
		if (s.others.disabled) this.layer.hide();
		videoContainer.after(this.layer.element);

		const promises = [
			// fetching your channel ID and set styles for you
			this.#setupViewerStyle(),
			this.device === 'mobile' ? this.#setupMobileSettingMenu() : this.#setupSettingMenu(),
			this.itemFactory.load(),
		];

		updateMutedWordsList();
		updateTlExclusionList();

		this.#setupPanel();
		this.layer.element.style.cssText += '--yt-lcf-layer-css: below;' + s.styles.layer_css;
		await Promise.allSettled(promises);
		this.#startSendingFrame(video);

		this.layer.autofit(s.others.layer_autofit > 0);
	}

	async #setupViewerStyle() {
		const res = await fetch('/account_advanced');
		const text = await res.text();
		const matches = text.match(/"(UC[\w-]{22})"/);
		const channel = matches?.[1] || '';
		if (!channel) return;

		const style = this.layer.root.querySelector('#yourcss');
		if (!style) return;

		style.textContent = `\
[data-author-id="${channel}"] {
	color: var(--yt-lcf-you-color);
	:host(.has-you-name) &.text {
		background-color: var(--yt-live-chat-you-message-background-color);
		border-radius: .5em;
		padding: 0 .25em;
	}
	&.text .photo {
		display: var(--yt-lcf-you-display-photo);
	}
	&.text .name {
		display: var(--yt-lcf-you-display-name);
	}
	&.text .message {
		display: var(--yt-lcf-you-display-message);
	}
}`;
	}

	/**
	 * Adds setting menus to the video control.
	 */
	async #setupSettingMenu() {
		const ytpPanelMenu = this.player.querySelector('.ytp-settings-menu .ytp-panel-menu');
		if (!ytpPanelMenu) return;

		const doc = await loadTemplateDocument('../templates/panel_menu.html');
		const [checkbox, popupmenu, pipmenu] = doc.body.children;
		checkbox.ariaChecked = s.others.disabled ? 'false' : 'true';
		checkbox.addEventListener('click', e => {
			const cb = /** @type {?HTMLElement} */ (e.currentTarget);
			if (!cb) return;
			const checked = cb.ariaChecked === 'true';
			cb.ariaChecked = (!checked).toString();
			this.layer.clear();
			this.layer[checked ? 'hide' : 'show']();
			s.others.disabled = checked ? 1 : 0;
		});
		popupmenu.addEventListener('click', () => {
			if (this.panel.element.hidden) this.panel.show();
			else this.panel.hide();
		});
		document.getElementById(checkbox.id)?.remove();
		document.getElementById(popupmenu.id)?.remove();
		document.getElementById(pipmenu.id)?.remove();
		ytpPanelMenu.append(checkbox, popupmenu, pipmenu);
	}

	async #setupMobileSettingMenu() {
		const doc = await loadTemplateDocument('../templates/panel_menu_mobile.html');
		const [checkbox, popupmenu] = doc.body.children;

		const container = checkbox.querySelector('.ytListItemViewModelContainer');
		const switchBtn = checkbox.querySelector('.ytSwitchButtonViewModelButton');
		const switchTrack = switchBtn?.querySelector('.ytSwitchShapeTrack');
		const switchKnob = switchBtn?.querySelector('.ytSwitchShapeKnob');
		if (!container || !switchBtn || !switchTrack || !switchKnob) return;

		const turnOn = () => {
			switchBtn.ariaChecked = 'true';
			switchTrack.classList.add('ytSwitchShapeTrackActive');
			switchKnob.classList.add('ytSwitchShapeKnobActive');
		};
		const turnOff = () => {
			switchBtn.ariaChecked = 'false';
			switchTrack.classList.remove('ytSwitchShapeTrackActive');
			switchKnob.classList.remove('ytSwitchShapeKnobActive');
		};
		const enable = () => {
			container.classList.remove('ytListItemViewModelDisabled');
			switchTrack.classList.remove('ytSwitchShapeTrackDisabled');
			if (s.others.disabled) turnOff();
			else turnOn();
		};
		const disable = () => {
			container.classList.add('ytListItemViewModelDisabled');
			switchTrack.classList.add('ytSwitchShapeTrackDisabled');
			turnOff();
		};

		checkbox.addEventListener('click', e => {
			e.stopPropagation();
			if (!this.listening) return;

			const checked = switchBtn.ariaChecked === 'true';
			if (checked) {
				this.layer.hide();
				turnOff();
				s.others.disabled = 1;
				this.layer.clear();
			} else {
				this.layer.show();
				turnOn();
				s.others.disabled = 0;
			}
		});

		popupmenu.addEventListener('click', () => {
			if (this.panel.element.hidden) this.panel.show();
			else this.panel.hide();
		});

		const observer = new MutationObserver(records => {
			for (const r of records) {
				const el = /** @type {HTMLElement} */ (r.target);
				if (el.hidden) continue;
				document.getElementById(checkbox.id)?.remove();
				document.getElementById(popupmenu.id)?.remove();

				if (this.listening) enable();
				else disable();
				el.querySelector('player-settings-menu')?.append(checkbox, popupmenu);
			}
		});

		for (const bsc of document.querySelectorAll('bottom-sheet-container')) {
			observer.observe(bsc, { attributeFilter: ['hidden'] });
		}
	}

	async #setupPanel() {
		if (this.device === 'desktop') {
			this.layer.element.after(this.panel.element);
		} else {
			const overlay = this.player.querySelector('ytm-watch-player-controls');
			overlay?.append(this.panel.element);
		}

		const form = this.panel.form;
		if (!form) return;
		this.#setupDynamicControls(form);
		this.#applySettingsToControls(form);
		this.#applyInitialStyles(form);
	}

	/**
	 * @param {HTMLFormElement} form
	 */
	#setupDynamicControls(form) {
		const ctrls = form.elements;
		const marker = form.querySelector('#language_exception_marker');
		if (ctrls.translation && marker) {
			const options = navigator.languages.map((lang, i) => new Option(lang, `${i + 1}`));
			/** @type {HTMLSelectElement} */ (ctrls.translation).append(...options);
			const checkboxes = navigator.languages.map((lang, i) => {
				const label = document.createElement('label');
				const input = document.createElement('input');
				input.type = 'checkbox';
				input.name = 'except_lang';
				input.value = i.toString();
				const span = document.createElement('span');
				span.textContent = lang;
				label.append(input, span);
				return label;
			});
			marker.after(...checkboxes);
		}
	}

	/**
	 * @param {HTMLFormElement} form
	 */
	#applySettingsToControls(form) {
		const le = this.layer.element;
		const ctrls = form.elements;
		for (const select of form.querySelectorAll('select')) {
			if (select.name in s.others) {
				const name = /** @type {keyof typeof s.others} */ (select.name);
				const val = s.others[name];
				select.selectedIndex = val;
				if (name === 'emoji') {
					le.setAttribute('data-emoji', Object.keys(EmojiModeEnum)[val].toLowerCase());
				} else if (name === 'wrap') {
					const wrapStyle = WrapStyleDefinitions[val];
					le.style.setProperty('--yt-lcf-message-hyphens', wrapStyle.hyphens);
					le.style.setProperty('--yt-lcf-message-word-break', wrapStyle.wordBreak);
					le.style.setProperty('--yt-lcf-message-white-space', wrapStyle.whiteSpace);
					le.style.setProperty('--yt-lcf-max-width', s.styles.max_width);
				}
			} else if (select.name === 'muted_words_mode') {
				select.selectedIndex = s.mutedWords.mode;
			} else if (select.name === 'translation') {
				select.selectedIndex = s.translation.targetIndex;
			}
		}
		const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[type="checkbox"]'));
		for (const cb of checkboxes) {
			const [_, _type] = cb.name.match(/^(.+)_display$/) || [];
			if (_type in s.parts) this.#applyPartSetting(cb, /** @type {keyof typeof s.parts} */ (_type));
			else this.#applyCheckboxSetting(cb, ctrls);
		}

		for (const [prop, value] of Object.entries(s.styles)) {
			le.style.setProperty(`--yt-lcf-${prop.replace(/_/g, '-')}`, value);
			/** @type {?HTMLInputElement} */
			const input = form.querySelector(`input.styles[name="${prop}"]`);
			if (input) {
				if (input.type === 'number') input.valueAsNumber = Number.parseFloat(value);
				else input.value = value;
			}
		}

		const rect = le.getBoundingClientRect();
		if (/** @type {HTMLInputElement} */ (ctrls.speed).checked) {
			/** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber = s.others.px_per_sec;
		} else if (rect.width > 0) {
			const dur = /** @type {HTMLInputElement} */ (ctrls.animation_duration).valueAsNumber;
			/** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber = Math.round(rect.width / dur);
		}
		/** @type {HTMLInputElement} */ (ctrls.limit_number).valueAsNumber = s.others.limit || 100;
		/** @type {HTMLInputElement} */ (ctrls.container_limit_number).valueAsNumber = s.others.container_limit || 20;

		const lines = s.others.number_of_lines;
		const inputLineNum = /** @type {HTMLInputElement} */ (ctrls.number_of_lines);
		if (rect.height > 0) {
			if (lines > 0) {
				const sizeByLines = (rect.height / lines / Number.parseFloat(s.styles.line_height)) | 0;
				const fsVal = s.others.type_of_lines > 0 ? `max(${s.styles.font_size}, ${sizeByLines}px)` : `${sizeByLines}px`;
				le.style.setProperty('--yt-lcf-font-size', fsVal);
				inputLineNum.valueAsNumber = lines;
				this.layoutCache.resize(lines);
			} else {
				const linesBySize = (rect.height / Number.parseFloat(s.styles.font_size) / Number.parseFloat(s.styles.line_height)) | 0;
				le.style.setProperty('--yt-lcf-font-size', s.styles.font_size);
				inputLineNum.valueAsNumber = linesBySize;
				this.layoutCache.resize(linesBySize);
			}
		}

		/** @type {HTMLInputElement} */ (ctrls.time_shift).valueAsNumber = s.others.time_shift || 0;
		/** @type {HTMLInputElement} */ (ctrls.time_shift).disabled = s.others.mode_replay === 0;
	}

	/**
	 * @param {HTMLInputElement} cb
	 * @param {keyof typeof s.parts} type
	 */
	#applyPartSetting(cb, type) {
		const le = this.layer.element;
		const kebab = type.replace(/_/g, '-');
		const part = s.parts[type];
		switch (cb.value) {
			case 'color': if ('color' in part) {
				cb.checked = part.color + part.strokeColor !== '';
				const fillProp = `--yt-lcf-${kebab}-color`;
				const strokeProp = `--yt-lcf-${kebab}-stroke-color`;
				if (part.color) le.style.setProperty(fillProp, part.color);
				else le.style.removeProperty(fillProp);
				if (part.strokeColor) le.style.setProperty(strokeProp, part.strokeColor);
				else le.style.removeProperty(strokeProp);

				const computed = getComputedStyle(le);
				const fillPicker = /** @type {?HTMLInputElement} */ (cb.parentElement?.nextElementSibling);
				if (fillPicker) fillPicker.value = part.color || computed.getPropertyValue(fillProp) || '#ffffff';
				const strokePicker = /** @type {?HTMLInputElement} */ (fillPicker?.nextElementSibling);
				if (strokePicker) strokePicker.value = part.strokeColor || computed.getPropertyValue(strokeProp) || '#000000';
				break;
			}
			case 'name': {
				const div = /** @type {HTMLDivElement} */ (cb.closest('div'));
				if (part.name) div.classList.add('outlined');
				cb.addEventListener('change', e => {
					const method = /** @type {HTMLInputElement} */ (e.target).checked ? 'add' : 'remove';
					div.classList[method]('outlined');
					le.classList[method](`has-${type}-name`);
				}, { passive: true });
			}
			default: {
				// @ts-expect-error
				cb.checked = part[cb.value];
				le.style.setProperty(`--yt-lcf-${kebab}-display-${cb.value}`, cb.checked ? 'inline' : 'none');
			}
		}
	}

	/**
	 *
	 * @param {HTMLInputElement} cb
	 * @param {HTMLFormControlsCollection} ctrls
	 */
	#applyCheckboxSetting(cb, ctrls) {
		const le = this.layer.element;
		switch (cb.name) {
			case 'speed': {
				cb.checked = s.others.px_per_sec > 0;
				/** @type {HTMLInputElement} */ (ctrls.animation_duration).disabled = cb.checked;
				/** @type {HTMLInputElement} */ (ctrls.px_per_sec).disabled = !cb.checked;
				break;
			}
			case 'lines': {
				cb.checked = s.others.number_of_lines > 0;
				/** @type {HTMLInputElement} */ (ctrls.font_size).disabled = cb.checked;
				/** @type {HTMLInputElement} */ (ctrls.number_of_lines).disabled = !cb.checked;
				/** @type {HTMLInputElement} */ (ctrls.type_of_lines).disabled = !cb.checked;
				break;
			}
			case 'unlimited': {
				/** @type {HTMLInputElement} */ (ctrls.limit_number).disabled = cb.checked = s.others.limit === 0;
				/** @type {LiveChatLayer} */ this.layer.limit = s.others.limit;
				break;
			}
			case 'container_unlimited': {
				/** @type {HTMLInputElement} */ (ctrls.container_limit_number).disabled = cb.checked = s.others.container_limit === 0;
				break;
			}
			case 'overlapping':
			case 'direction': {
				const val = Number.parseInt(cb.value, 10);
				cb.checked = !!(s.others[cb.name] & 1 << val);
				break;
			}
			case 'layer_autofit':
			case 'show_username': {
				cb.checked = s.others[cb.name] > 0;
				break;
			}
			case 'muted_words_regexp': {
				cb.checked = s.mutedWords.regexp;
				break;
			}
			case 'except_lang': {
				const val = Number.parseInt(cb.value, 10);
				cb.checked = !!(s.translation.exceptionFlag & 1 << val);
				const target = s.translation.targetIndex;
				cb.disabled = target === 0 || target === val + 1;
				break;
			}
			case 'prefix_lang':
			case 'suffix_original': {
				cb.checked = cb.name === 'prefix_lang' ? s.translation.prefixLangCode: s.translation.suffixOriginal;
				cb.disabled = /** @type {HTMLSelectElement} */ (ctrls.translation).selectedIndex === 0;
				le.classList[cb.checked ? 'add' : 'remove'](cb.name);
				break;
			}
		}
	}

	/**
	 * @param {HTMLFormElement} form
	 */
	#applyInitialStyles(form) {
		const le = this.layer.element;
		const ctrls = form.elements;

		/** @type { [ string, number, number ][] } */
		const colormap = [
			['--yt-live-chat-normal-message-background-color', 0xffc0c0c0, -1],
			['--yt-live-chat-verified-message-background-color', 0xffc0c0c0, -1],
			['--yt-live-chat-member-message-background-color', 0xffc0c0c0, -1],
			['--yt-live-chat-moderator-message-background-color', 0xffc0c0c0, -1],
			['--yt-live-chat-owner-message-background-color', 0xffc0c0c0, -1],
			['--yt-live-chat-you-message-background-color', 0xffc0c0c0, -1],
			['--yt-live-chat-paid-sticker-background-color', 0xffffb300, -1],
			['--yt-live-chat-author-chip-owner-background-color', 0xffffd600, -1],
		];
		for (const [name, rgb, alpha] of colormap) {
			le.style.setProperty(name, `rgba(${getColorRGB(rgb).join()},${alpha < 0 ? 'var(--yt-lcf-background-opacity)' : alpha})`);
		}

		for (const [k, v] of Object.entries(s.parts)) {
			le.classList[v.name ? 'add' : 'remove'](`has-${k}-name`);
		}

		const root = this.layer.root;
		const customCss = root.querySelector('#customcss');
		const userDefinedCss = root.querySelector('#userdefinedcss');
		for (const [selector, css] of Object.entries(s.cssTexts)) {
			if (selector) {
				if (customCss) customCss.textContent += `:host>${selector}{${css}}`;
				const name = selector.substring(1) + '_css';
				const input = /** @type {?HTMLInputElement} */ (ctrls[name]);
				if (input) input.value = css;
			} else {
				if (userDefinedCss) userDefinedCss.textContent = css;
				const textarea = /** @type {?HTMLTextAreaElement} */ (ctrls.user_defined_css);
				if (textarea) textarea.value = css;
			}
		}
		const dir = s.others.direction;
		if (dir) {
			le.classList[dir & 1 ? 'add': 'remove']('direction-reversed-y');
			le.classList[dir & 2 ? 'add': 'remove']('direction-reversed-x');
		}
		if (s.translation.prefixLangCode) le.classList.add('prefix_lang');

		// layer CSS
		/** @type {HTMLInputElement} */ (ctrls.layer_css).value = s.styles.layer_css;

		/** @type {HTMLInputElement} */ (ctrls.muted_words_replacement).value = s.mutedWords.replacement;
		/** @type {HTMLTextAreaElement} */ (ctrls.muted_words_list).value = s.mutedWords.plainList.join('\n');
	}

	/**
	 * @param {HTMLVideoElement} video
	 */
	#startSendingFrame(video) {
		if (!s.personDetection.device) return;

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('bitmaprenderer');
		if (!ctx) {
			logger.warn('ImageBitmapRenderingContext is not supported.');
			return;
		}
		canvas.id = 'yt-lcf-mask-canvas';
		canvas.style.pointerEvents = 'none';
		canvas.style.position = 'absolute';
		canvas.style.visibility = 'hidden';

		const [w, h] = VideoSegmentationExecutor.TARGET_SIZE;
		[canvas.width, canvas.height] = [w, h];
		const imageData = new ImageData(w, h);
		const u32data = new Uint32Array(imageData.data.buffer);
		const prevRecv = new Uint8ClampedArray(w * h);
		const localBuffer = new Uint8ClampedArray(w * h);
		let hasNew = false;

		this.segmenter = new VideoSegmentationExecutor(async res => {
			const data = res?.at(0)?.mask?.data;
			if (!data) return;
			localBuffer.set(data);
			hasNew = true;
		});
		this.segmenter.observe(video, this.layer);

		(async function renderLoop() {
			if (hasNew) {
				hasNew = false;
				const ALPHA_MASK = 0xFF000000;
				if (localBuffer.some(b => b > 1)) {
					const UPPER_THRESHOLD = 160;
					const LOWER_THRESHOLD = 96;
					for (let i = 0, l = localBuffer.length; i < l; i++) {
						const prevVal = u32data[i] & 0xFF;
						const curr = (prevRecv[i] + localBuffer[i]) >> 1;
						const b = curr < LOWER_THRESHOLD ? 0 : curr > UPPER_THRESHOLD ? 255 : prevVal;
						if (b !== prevVal) u32data[i] = ALPHA_MASK | (0x010101 * b);
						prevRecv[i] = localBuffer[i];
					}
				} else {
					for (let i = 0, l = localBuffer.length; i < l; i++) {
						const prev = prevRecv[i];
						const curr = localBuffer[i];
						const sum = prev + curr;
						if (sum !== 1) {
							const b = sum ? 255 : 0;
							const prevVal = u32data[i] & 0xFF;
							if (b !== prevVal) u32data[i] = ALPHA_MASK | (0x010101 * b);
						}
						prevRecv[i] = curr;
					}
				}
				const bitmap = await createImageBitmap(imageData);
				ctx.transferFromImageBitmap(bitmap);
				bitmap.close();
			}
			requestAnimationFrame(renderLoop);
		})();

		const le = this.layer.element;
		le.style.maskImage = `linear-gradient(#fff, #fff), -moz-element(#${canvas.id})`;
		le.style.maskMode = 'luminance';
		le.style.maskPosition = `0px 0px, ${video.style.left} ${video.style.top}`;
		le.style.maskSize = `100% 100%, ${video.style.width} ${video.style.height}`;
		le.style.maskRepeat = 'no-repeat, no-repeat';
		le.style.maskComposite = 'exclude';
		le.after(canvas);
	}

	/**
	 * Fires chat actions.
	 * @param {CustomEvent<LiveChat.LiveChatItemAction[]>} event
	 */
	async #onAction(event) {
		const le = this.layer.element;
		const root = this.layer.root;
		if ((isNotPip() && document.visibilityState === 'hidden') || le.hidden || le.parentElement?.classList.contains('paused-mode')) return;

		/** @type {Record<string, LiveChat.LiveChatItemAction[]>} */
		const filtered = { add: [], delete: [], delete_author: [], replace: [] };
		for (const a of event.detail) {
			if ('addChatItemAction' in a) filtered.add.push(a);
			else if ('markChatItemAsDeletedAction' in a) filtered.delete.push(a);
			else if ('markChatItemsByAuthorAsDeletedAction' in a) filtered.delete_author.push(a);
			else if ('replaceChatItemAction' in a) filtered.replace.push(a);
		};
		if (this.#skip && filtered.add.length > 0) {
			this.#skip = false;
			return;
		}

		// Add
		const sv = s.others.simultaneous;
		const last = sv === SimultaneousModeEnum.LAST_MERGE ? /** @type {?HTMLElement} */ (root.lastElementChild) : null;
		const bodies = last ? [ `<!-- ${last.className} -->` + (last.getAttribute('data-text') || '') ] : [];
		const ids = last ? [last.id] : [];
		/** @type {(el: HTMLElement) => boolean | void} */
		let merge = _el => true;
		switch (s.others.simultaneous) {
			case SimultaneousModeEnum.FIRST: {
				// @ts-expect-error
				const notext = filtered.add.slice(1).filter(a => !a.addChatItemAction?.item.liveChatTextMessageRenderer);
				filtered.add.splice(1, Infinity, ...notext);
				break;
			}
			case SimultaneousModeEnum.LAST_MERGE:
			case SimultaneousModeEnum.MERGE: {
				merge = el => {
					const text = el.getAttribute('data-text');
					const body = text ? `<!-- ${el.className} -->${text}` : '';
					if (!body) return true;

					const index = bodies.indexOf(body);
					if (index < 0) {
						bodies.push(body);
						ids.push(el.id);
						return true;
					}

					const earlierId = ids[index];
					if (earlierId === el.id) return;
					const earlier = root.getElementById(earlierId);
					if (!earlier) return;

					const earlierName = earlier?.querySelector('.name');
					const recentPhoto = el.querySelector('.photo');
					if (!earlierName || !recentPhoto) return;

					const parent = recentPhoto.parentElement;
					if (parent) {
						const duplicatedAnchor = `a[href="${parent.getAttribute('href')}"]`;
						if (earlier.querySelector(duplicatedAnchor)) return;
						earlierName.insertAdjacentElement('beforebegin', parent);
					}
					earlierName.replaceChildren();
					this.updateCurrentItem(earlier);
					return;
				};
				break;
			}
		}
		for (const a of filtered.add) this.#addChatItem(a, merge);
		for (const a of filtered.delete) this.#deleteChatItem(a);
		for (const a of filtered.delete_author) this.#deleteChatItemByAuthor(a);
		for (const a of filtered.replace) this.#replaceChatItem(a);
	}

	/**
	 * @param {LiveChat.LiveChatItemAction} action add chat item action object
	 * @param {(el: HTMLElement) => boolean | void} callback
	 */
	#addChatItem(action, callback) {
		const item = action.addChatItemAction?.item;
		if (!item) {
			logger.warn('Failed to add message.');
			return;
		}
		return renderChatItem(item, this.itemFactory).then(el => {
			if (!el) return;
			const shouldRender = callback(el);
			if (!shouldRender) return;
			if (this.layer.root.getElementById(el.id)) {
				logger.debug('Skipped rendering chat item (already exists on the layer):', `#${el.id}`);
			} else {
				/** @type { ["dense", "random"] } */
				const modeOptions = ['dense', 'random'];
				layoutChatItem(el, this.layoutCache, modeOptions[s.others.density]);
			}
		}).catch(logger.warn);
	}

	/**
	 * @param {LiveChat.LiveChatItemAction} action
	 */
	#deleteChatItem(action) {
		// @ts-expect-error
		const id = action.markChatItemAsDeletedAction.targetItemId;
		if (this.layoutCache.delete(id).some(v => v)) {
			const target = this.layer.root.getElementById(id);
			target?.remove();
		} else {
			logger.warn(`Failed to delete message: #${id}`);
		}
	}

	/**
	 * @param {LiveChat.LiveChatItemAction} action
	 */
	#deleteChatItemByAuthor(action) {
		// @ts-expect-error
		const id = action.markChatItemsByAuthorAsDeletedAction.externalChannelId;
		const targets = this.layer.root.querySelectorAll(`[data-author-id="${id}"]`);
		for (const target of targets) {
			this.layoutCache.delete(target.id);
			target.remove();
		}
	}

	/**
	 * @param {LiveChat.LiveChatItemAction} action
	 */
	#replaceChatItem(action) {
		// @ts-expect-error
		const id = action.replaceChatItemAction.targetItemId;
		const target = this.layer.root.getElementById(id);
		const item = action.replaceChatItemAction?.replacementItem;
		if (target && item) {
			renderChatItem(item, this.itemFactory).then(el => {
				if (!el) return;
				target.replaceWith(el);
			}).catch(logger.warn);
		} else {
			logger.warn(`Failed to replace message: #${id}`);
		}
	}

	/**
	 * Updates the current style of the given item.
	 * @param {HTMLElement} item message element
	 */
	updateCurrentItem(item) {
		const lw = this.layer.element.clientWidth;
		const isLong = item.clientWidth >= lw * (Number.parseInt(s.styles.max_width, 10) / 100 || 1);
		item.classList[isLong ? 'add' : 'remove']('wrap');
		item.style.setProperty('--yt-lcf-translate-x', `-${lw + item.clientWidth}px`);
	}

	/**
	 * Sets a flag to skip rendering the messages once.
	 */
	skip() {
		this.#skip = true;
	}

	listen() {
		this.unlisten();
		document.addEventListener('ytlcf-action', () => {
			document.addEventListener('ytlcf-action', e => {
				this.#onAction(e);
			}, { passive: true, signal: this.abortController.signal });
		}, { once: true, passive: true });
		this.listening = true;

		const video = this.player.querySelector('#movie_player video');
		if (video) {
			this.#layerSizeObserver.disconnect();
			this.#layerSizeObserver.observe(video, { attributeFilter: ['style'] });
		}
	}

	unlisten() {
		this.abortController.abort();
		this.abortController = new AbortController();
		this.listening = false;
	}

	close() {
		this.unlisten();
		this.layer.clear();
	}
}
