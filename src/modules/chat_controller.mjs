/// <reference path="../../types/ytlivechatrenderer.d.ts" />

import { DEFAULT_CONFIG, store as s } from './store.mjs';
import { isNotPip, loadTemplateDocument, formatHexColor, getColorRGB } from './utils.mjs';

import { LiveChatLayer } from './chat_layer.mjs'
import { LiveChatPanel } from './chat_panel.mjs';
import { LiveChatContextMenu } from './chat_contextmenu.mjs';

import { LiveChatLayoutCache, LiveChatItemLayout, EmojiModeEnum, updateMutedWordsList } from './chat_message.mjs';

/** @enum {number} */
export const SimultaneousModeEnum = Object.freeze({
	ALL: 0,
	FIRST: 1,
	MERGE: 2,
	LAST_MERGE: 3,
});

/**
 * @typedef WrapStyleDefItem
 * @prop {string} hyphens
 * @prop {string} wordBreak
 * @prop {string} whiteSpace
 */
/** @type {ReadonlyArray<WrapStyleDefItem>} */
export const WrapStyleDefinitions = Object.freeze([
	{ hyphens: 'manual', wordBreak: 'keep-all', whiteSpace: 'pre' },
	{ hyphens: 'auto', wordBreak: 'normal', whiteSpace: 'pre-line' },
	{ hyphens: 'auto', wordBreak: 'keep-all', whiteSpace: 'pre-line' },
]);

export class LiveChatController {
	#skip = false;

	/**
	 * @param {HTMLElement} player YouTube player element
	 */
	constructor(player) {
		this.player = player;

		this.layer = new LiveChatLayer(this);
		const root = this.layer.root;
		this.layoutCache = new LiveChatLayoutCache(root);

		root.addEventListener('contextmenu', e => {
			const origin = /** @type {HTMLElement} */ (e.target).closest('[id]');
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
			const origin = /** @type {HTMLElement} */ (e.target);
			const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
			if (interactiveTags.includes(origin?.tagName || 'BODY')) {
				e.stopPropagation();
			} else {
				/** @type {HTMLElement?} */ (e.target)?.parentElement?.click();
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
	}

	async start() {
		const videoContainer = this.player.querySelector('#movie_player video')?.parentElement;
		if (!videoContainer) {
			return Promise.reject('No video container element.');
		}

		document.getElementById('ytlcf-panel')?.remove();

		// get storage data
		await s.load();

		const form = await this.panel.createForm();
		// bind i18n labels
		const i18nElems = form.querySelectorAll('[data-i18n]');
		i18nElems.forEach(elem => {
			const key = elem.getAttribute('data-i18n');
			if (key) elem.textContent = browser.i18n.getMessage(key);
		});
		/** @type {NodeListOf<HTMLElement>} */
		const i18nTitleElems = form.querySelectorAll('[data-i18n-title]');
		i18nTitleElems.forEach(elem => {
			const key = elem.getAttribute('data-i18n-title');
			if (key) elem.title = browser.i18n.getMessage(key);
		});
		/** @type {NodeListOf<HTMLInputElement | HTMLTextAreaElement>} */
		const i18nPlaceholderElems = form.querySelectorAll('[data-i18n-placeholder]');
		i18nPlaceholderElems.forEach(elem => {
			const key = elem.getAttribute('data-i18n-placeholder');
			if (key) elem.placeholder = browser.i18n.getMessage(key);
		});

		document.getElementById('ytlcf-layer')?.remove();
		if (s.others.disabled) this.layer.hide();
		videoContainer.after(this.layer.element);

		/** @type {Promise<void>[]} */
		const promises = [
			// fetching your channel ID and set styles for you
			this.#setupViewerStyle(),
			this.#setupSettingMenu(),
		];

		updateMutedWordsList();
		this.#setupPanel();
		this.layer.element.style.cssText += '--yt-lcf-layer-css: below;' + s.styles.layer_css;
		await Promise.allSettled(promises);
	}

	async #setupViewerStyle() {
		const res = await fetch('/account_advanced');
		const text = await res.text();
		const matches = text.match(/"(UC[\w-]{22})"/);
		const channel = matches?.[1] || '';
		if (!channel) return;

		/** @type {?HTMLStyleElement | undefined} */
		const style = this.layer.root.querySelector('#yourcss');
		if (!style) return;

		const you = `[data-author-id="${channel}"]`;
		style.textContent = [
			`${you} { color: var(--yt-lcf-you-color) }`,
			`:host(.has-you-name) ${you}.text { background-color: var(--yt-live-chat-you-message-background-color); border-radius: .5em; padding: 0 .25em }`,
			`${you}.text .photo { display: var(--yt-lcf-you-display-photo) }`,
			`${you}.text .name { display: var(--yt-lcf-you-display-name) }`,
			`${you}.text .message { display: var(--yt-lcf-you-display-message) }`,
		].join('\n');
	}

	/**
	 * Adds setting menus to the video control.
	 */
	async #setupSettingMenu() {
		/** @type {HTMLElement | null | undefined} */
		const ytpPanelMenu = this.player.querySelector('.ytp-settings-menu .ytp-panel-menu');
		if (!ytpPanelMenu) return;

		const doc = await loadTemplateDocument('../templates/panel_menu.html');
		const [checkbox, popupmenu, pipmenu] = doc.body.children;
		checkbox.setAttribute('aria-checked', s.others.disabled ? 'false' : 'true');
		checkbox.addEventListener('click', e => {
			const cb = /** @type {HTMLElement?} */ (e.currentTarget);
			if (!cb) return;
			const checked = cb.getAttribute('aria-checked') === 'true';
			cb.setAttribute('aria-checked', (!checked).toString());
			this.layer.clear();
			this.layer[checked ? 'hide' : 'show']();
			s.others.disabled = checked ? 1 : 0;
		}, { passive: true });
		popupmenu.addEventListener('click', () => {
			if (!this.panel) return;
			this.panel[this.panel.element.hidden ? 'show' : 'hide']();
		}, { passive: true });
		doc.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			if (key) el.textContent = browser.i18n.getMessage(key);
		});
		ytpPanelMenu.querySelector('#' + checkbox.id)?.remove();
		ytpPanelMenu.querySelector('#' + popupmenu.id)?.remove();
		ytpPanelMenu.querySelector('#' + pipmenu.id)?.remove();
		ytpPanelMenu.append(checkbox, popupmenu, pipmenu);
	}

	async #setupPanel() {
		const le = this.layer.element;
		le.after(this.panel.element);
		
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
		const rect = le.getBoundingClientRect();
		const ctrls = form.elements;
		const selects = form.querySelectorAll('select');
		for (const select of selects) {
			if (select.name in s.others) {
				/** @type {number} */ // @ts-ignore
				const val = s.others[select.name];
				select.selectedIndex = Math.abs(val);
				switch (select.name) {
					case 'emoji': {
						le.setAttribute('data-emoji', Object.keys(EmojiModeEnum)[val].toLowerCase());
						break;
					}
					case 'wrap': {
						const wrapStyle = WrapStyleDefinitions[val];
						le.style.setProperty('--yt-lcf-message-hyphens', wrapStyle.hyphens);
						le.style.setProperty('--yt-lcf-message-word-break', wrapStyle.wordBreak);
						le.style.setProperty('--yt-lcf-message-white-space', wrapStyle.whiteSpace);
						le.style.setProperty('--yt-lcf-max-width', s.styles.max_width);
						break;
					}
				}
			} else if (select.name === 'muted_words_mode') {
				select.selectedIndex = s.mutedWords.mode;
			}
		}
		const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[type="checkbox"]'));
		for (const cb of checkboxes) {
			const match = cb.name.match(/^(.+)_display$/);
			if (match) {
				const [_, type] = match;
				if (type in s.parts) {
					// @ts-ignore
					const part = s.parts[type];
					cb.checked = part[cb.value];
					switch (cb.value) {
						case 'color': {
							const saved = part.color;
							if (saved) le.style.setProperty(`--yt-lcf-${type.replace(/_/g, '-')}-color`, saved);
							else le.style.removeProperty(`--yt-lcf-${type.replace(/_/g, '-')}-color`);
							const picker = /** @type {HTMLInputElement?} */ (cb.parentElement?.nextElementSibling);
							if (picker) picker.value = saved || formatHexColor(getComputedStyle(le).getPropertyValue('--yt-lcf-' + picker.name.replace(/_/g, '-')));
							break;
						}
						case 'name': {
							const div = /** @type {HTMLDivElement} */ (cb.closest('div'));
							if (cb.checked) div.classList.add('outlined');
							cb.addEventListener('change', () => {
								const method = cb.checked ? 'add' : 'remove';
								div.classList[method]('outlined');
								le.classList[method](`has-${type}-name`);
							}, { passive: true });
						}
						default: {
							le.style.setProperty(`--yt-lcf-${type.replace(/_/g, '-')}-display-${cb.value}`, cb.checked ? 'inline' : 'none');
						}
					}
				}
			} else {
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
						const val = Number.parseInt(cb.value);
						cb.checked = s.others[cb.name] & 1 << val ? true : false;
						break;
					}
					case 'show_username': {
						cb.checked = s.others.show_username > 0;
						break;
					}
					case 'muted_words_regexp': {
						cb.checked = s.mutedWords.regexp;
						break;
					}
					case 'except_lang': {
						const val = Number.parseInt(cb.value);
						cb.checked = s.others.except_lang & 1 << val ? true : false;
						const abs = Math.abs(s.others.translation);
						cb.disabled = abs === 0 || abs === val + 1;
						break;
					}
					case 'prefix_lang': {
						cb.checked = s.others.translation < 0;
						cb.disabled = /** @type {HTMLSelectElement} */ (ctrls.translation).selectedIndex === 0;
						le.classList[cb.checked ? 'add' : 'remove'](cb.name);
						break;
					}
					case 'suffix_original': {
						cb.checked = s.others.suffix_original > 0;
						le.classList[cb.checked ? 'add' : 'remove'](cb.name);
						break;
					}
				}
			}
		}

		for (const [prop, value] of Object.entries(s.styles)) {
			le.style.setProperty('--yt-lcf-' + prop.replace(/_/g, '-'), value);
			/** @type {HTMLInputElement?} */
			const input = form.querySelector(`input.styles[name="${prop}"]`);
			if (input) {
				if (input.type === 'number') input.valueAsNumber = Number.parseFloat(value);
				else input.value = value;
			}
		}
		// number
		/** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber = /** @type {HTMLInputElement} */ (ctrls.speed).checked
			? s.others.px_per_sec
			: Math.round(rect.width / /** @type {HTMLInputElement} */ (ctrls.animation_duration).valueAsNumber);
		/** @type {HTMLInputElement} */ (ctrls.limit_number).valueAsNumber = s.others.limit || 100;
		/** @type {HTMLInputElement} */ (ctrls.container_limit_number).valueAsNumber = s.others.container_limit || 20;
		
		const lines = s.others.number_of_lines;
		const inputFontSize = /** @type {HTMLInputElement} */ (ctrls.font_size);
		const inputLineNum = /** @type {HTMLInputElement} */ (ctrls.number_of_lines);
		if (lines > 0) {
			const sizeByLines = Math.floor(rect.height / lines / Number.parseFloat(s.styles.line_height));
			if (s.others.type_of_lines > 0) {
				le.style.setProperty('--yt-lcf-font-size', `max(${s.styles.font_size}, ${sizeByLines}px)`);
				inputFontSize.valueAsNumber = sizeByLines;
			} else {
				le.style.setProperty('--yt-lcf-font-size', `${sizeByLines}px`);
			}
			inputLineNum.valueAsNumber = lines;
		} else {
			const linesBySize = Math.floor(rect.height / Number.parseFloat(s.styles.font_size) / Number.parseFloat(s.styles.line_height));
			le.style.setProperty('--yt-lcf-font-size', s.styles.font_size);
			inputLineNum.valueAsNumber = linesBySize;
		}

		/** @type {HTMLInputElement} */ (ctrls.time_shift).valueAsNumber = s.others.time_shift || 0;
		/** @type {HTMLInputElement} */ (ctrls.time_shift).disabled = s.others.mode_replay === 0;
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
				const input = /** @type {HTMLInputElement?} */ (ctrls[name]);
				if (input) input.value = css;
			} else {
				if (userDefinedCss) userDefinedCss.textContent = css;
				const textarea = /** @type {HTMLTextAreaElement?} */ (ctrls.user_defined_css);
				if (textarea) textarea.value = css;
			}
		}
		const dir = s.others.direction;
		if (dir) {
			le.classList[dir & 1 ? 'add': 'remove']('direction-reversed-y');
			le.classList[dir & 2 ? 'add': 'remove']('direction-reversed-x');
		}

		// layer CSS
		/** @type {HTMLInputElement} */ (ctrls.layer_css).value = s.styles.layer_css;

		/** @type {HTMLInputElement} */ (ctrls.muted_words_replacement).value = s.mutedWords.replacement;
		/** @type {HTMLTextAreaElement} */ (ctrls.muted_words_list).value = s.mutedWords.plainList.join('\n');
	}

	/**
	 * Fires chat actions.
	 * @param {CustomEvent<LiveChat.LiveChatItemAction[]>} event 
	 */
	async #onAction(event) {
		const le = this.layer.element;
		const root = this.layer.root;
		if ((isNotPip() && document.visibilityState === 'hidden') || le.hidden || le.parentElement?.classList.contains('paused-mode')) return;

		const actions = event.detail;
		const filtered = {
			add: actions.filter(a => a && 'addChatItemAction' in a),
			delete: actions.filter(a => a && 'markChatItemAsDeletedAction' in a),
			delete_author: actions.filter(a => a && 'markChatItemsByAuthorAsDeletedAction' in a),
			replace: actions.filter(a => a && 'replaceChatItemAction' in a),
		};
		if (this.#skip && filtered.add.length > 0) {
			this.#skip = false;
			return;
		}
		
		// Add
		const sv = s.others.simultaneous;
		const last = sv === SimultaneousModeEnum.LAST_MERGE ? /** @type {HTMLElement?} */ (root.lastElementChild) : null;
		const bodies = last ? [ `<!-- ${last.className} -->` + (last.getAttribute('data-text') || '') ] : [];
		const ids = last ? [ last.id ] : [];
		if (sv === SimultaneousModeEnum.FIRST) {
			// @ts-ignore
			const notext = filtered.add.slice(1).filter(a => !a.addChatItemAction?.item.liveChatTextMessageRenderer);
			filtered.add.splice(1, Infinity, ...notext);
		}

		for (const action of filtered.add) {
			const item = action.addChatItemAction?.item;
			if (!item) {
				console.warn('Failed to add message.');
				continue;
			}
			const layout = new LiveChatItemLayout(item);
			const elem = await layout.render();
			if (!elem) {
				console.warn('Failed to render a chat item element.')
				continue;
			}
			const text = elem.getAttribute('data-text');
			if (sv === SimultaneousModeEnum.MERGE || sv === SimultaneousModeEnum.LAST_MERGE) {
				const body = text ? `<!-- ${elem.className} -->${text}` : '';
				if (body) {
					const index = bodies.indexOf(body);
					if (index < 0) {
						bodies.push(body);
						ids.push(elem.id);
					} else {
						const earlier = root.getElementById(ids[index]);
						/** @type {HTMLElement | null | undefined} */
						const _name = earlier?.querySelector('.name');
						/** @type {HTMLSpanElement?} */
						const _photo = elem.querySelector('.photo');
						if (earlier && _name && _photo) {
							const parent = _photo.parentElement;
							if (parent) _name.insertAdjacentElement('beforebegin', parent);
							if (!_name.textContent)  _name.textContent = '';
							this.updateCurrentItem(earlier);
						}
						continue;
					}
				}
			}
			if (root.getElementById(elem.id)) {
				const type = elem.className.match(/text (.+)/)?.at(1) || 'normal';
				const color = getComputedStyle(le).getPropertyValue(`--yt-lcf-${type}-color`);
				console.log(`Message duplication #${elem.id}: %c${text || elem.lastElementChild?.textContent}`, color ? 'color:' + color : '');
			} else {
				/** @type { ["dense", "random"] } */
				const mode = ['dense', 'random'];
				layout.appendTo(this.layoutCache, mode[s.others.density]);
			}
		}
		
		// Delete
		for (const action of filtered.delete) {
			// @ts-ignore
			const id = action.markChatItemAsDeletedAction.targetItemId;
			if (this.layoutCache.delete(id)) {
				const target = root.getElementById(id);
				target?.remove();
			} else {
				console.warn('Failed to delete message: #' + id);
			}
		}
		
		// Delete by author
		for (const action of filtered.delete_author) {
			// @ts-ignore
			const id = action.markChatItemsByAuthorAsDeletedAction.externalChannelId;
			const targets = root.querySelectorAll(`[data-author-id="${id}"]`);
			for (const target of targets) {
				this.layoutCache.delete(target.id);
				target.remove();
			}
		}
		
		// Replace
		for (const action of filtered.replace) {
			// @ts-ignore
			const id = action.replaceChatItemAction.targetItemId;
			const target = root.getElementById(id);
			const item = action.replaceChatItemAction?.replacementItem;
			if (target && item) {
				const layout = new LiveChatItemLayout(item);
				const elem = await layout.render();
				if (elem) {
					target.replaceWith(elem);
				}
			} else {
				console.warn('Failed to replace message: #' + id);
			}
		}
	}

	/**
	 * Updates the current style of the given item.
	 * @param {HTMLElement} item message element
	 */
	updateCurrentItem(item) {
		const lw = this.layer.element.clientWidth;
		const isLong = item.clientWidth >= lw * (Number.parseInt(s.styles.max_width) / 100 || 1);
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
	}

	unlisten() {
		this.abortController.abort();
		this.abortController = new AbortController();
	}

	close() {
		this.unlisten();
		this.layer.clear();
	}
}