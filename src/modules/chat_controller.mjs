/// <reference path="../../types/ytlivechatrenderer.d.ts" />

import { DEFAULT_CONFIG, store as s } from './store.mjs';
import { isNotPip, loadTemplateDocument, filterMessage, formatHexColor, getColorRGB, getText, isCatchable, isOverflow } from './utils.mjs';

import { LiveChatLayer } from './chat_layer.mjs'
import { LiveChatPanel } from './chat_panel.mjs';
import { LiveChatContextMenu } from './chat_contextmenu.mjs';

import { ChatMessageContainer } from './message_container.mjs';

/** @enum {string} */
const AuthorType = Object.freeze({
	NORMAL: 'normal',
	MEMBER: 'member',
	MODERATOR: 'moderator',
	OWNER: 'owner',
	VERIFIED: 'verified',
});

/** @enum {number} */
export const SimultaneousModeEnum = Object.freeze({
	ALL: 0,
	FIRST: 1,
	MERGE: 2,
	LAST_MERGE: 3,
});

/** @enum {number} */
export const EmojiModeEnum = Object.freeze({
	NONE: 0,
	ALL: 1,
	LABEL: 2,
	SHORTCUT: 3,
});

/** @enum {number} */
export const MutedWordModeEnum = Object.freeze({
	NONE: 0,
	ALL: 1,
	WORD: 2,
	CHAR: 3,
});

/** @type {RegExp[]} */
let mutedWordsList = [];

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

export class LiveChatController extends EventTarget {
	/** @type {HTMLElement} */
	player;
	/** @type {LiveChatLayer} */
	layer;
	/** @type {LiveChatPanel} */
	panel;
	/** @type {LiveChatContextMenu} */
	contextmenu;

	#skip = false;

	/**
	 * @param {HTMLElement} player YouTube player element
	 */
	constructor(player) {
		super();
		this.player = player;

		this.layer = new LiveChatLayer(this);
		const root = this.layer.root;
		root.addEventListener('contextmenu', e => {
			const origin = /** @type {HTMLElement?} */ (e.composedPath().find(p => 'id' in p));
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
			const origin = /** @type {HTMLElement | undefined} */ (e.composedPath().at(0));
			const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
			if (interactiveTags.includes(origin?.tagName || 'BODY')) {
				e.stopPropagation();
			} else {
				/** @type {HTMLElement?} */ (e.target)?.parentElement?.click();
			}
		}, { passive: true });

		this.panel = new LiveChatPanel(this);
		this.contextmenu = new LiveChatContextMenu();
	}

	async start() {
		const videoContainer = this.player.querySelector('#movie_player video')?.parentElement;
		if (!videoContainer) {
			return Promise.reject('No video container element.');
		}

		document.getElementById('ytlcf-panel')?.remove();

		// get storage data
		s.load();

		const form = await this.panel.createForm();
		// bind i18n labels
		/** @type {NodeListOf<HTMLElement>} */
		const i18nElems = form.querySelectorAll('[data-i18n]');
		i18nElems.forEach(elem => {
			const key = elem.dataset.i18n;
			if (key) elem.textContent = browser.i18n.getMessage(key);
		});
		/** @type {NodeListOf<HTMLElement>} */
		const i18nTitleElems = form.querySelectorAll('[data-i18n-title]');
		i18nTitleElems.forEach(elem => {
			const key = elem.dataset.i18nTitle;
			if (key) elem.title = browser.i18n.getMessage(key);
		});
		/** @type {NodeListOf<HTMLInputElement | HTMLTextAreaElement>} */
		const i18nPlaceholderElems = form.querySelectorAll('[data-i18n-placeholder]');
		i18nPlaceholderElems.forEach(elem => {
			const key = elem.dataset.i18nPlaceholder;
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
		doc.querySelectorAll('[data-i18n]').forEach(e => {
			const key = /** @type {HTMLElement} */ (e).dataset.i18n;
			if (key) e.textContent = browser.i18n.getMessage(key);
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
		const ctrls = form.elements;
		const selects = form.querySelectorAll('select');
		for (const select of selects) {
			if (select.name in s.others) {
				/** @type {number} */ // @ts-ignore
				const val = s.others[select.name];
				select.selectedIndex = Math.abs(val);
				switch (select.name) {
					case 'emoji': {
						le.dataset.emoji = Object.keys(EmojiModeEnum)[val].toLowerCase();
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
			: Math.round(le.getBoundingClientRect().width / /** @type {HTMLInputElement} */ (ctrls.animation_duration).valueAsNumber);
		/** @type {HTMLInputElement} */ (ctrls.limit_number).valueAsNumber = s.others.limit || 100;
		/** @type {HTMLInputElement} */ (ctrls.container_limit_number).valueAsNumber = s.others.container_limit || 20;
		/** @type {HTMLInputElement} */ (ctrls.time_shift).valueAsNumber = s.others.time_shift || 0;
		/** @type {HTMLInputElement} */ (ctrls.time_shift).disabled = s.others.mode_replay === 0;
		
		const lines = s.others.number_of_lines;
		if (lines) {
			const sizeByLines = Math.floor(le.getBoundingClientRect().height * .8 / lines);
			
			const inputFs = /** @type {HTMLInputElement} */ (ctrls.font_size);
			const inputLn = /** @type {HTMLInputElement} */ (ctrls.number_of_lines);
			if (s.others.type_of_lines > 0) {
				le.style.setProperty('--yt-lcf-font-size', `max(${s.styles.font_size}, ${sizeByLines}px)`);
				inputFs.setAttribute('value', `${sizeByLines}`);
				inputLn.setAttribute('value', `${lines}`);
			} else {
				le.style.setProperty('--yt-lcf-font-size', `${sizeByLines}px`);
				inputLn.setAttribute('value', `${DEFAULT_CONFIG.others.number_of_lines}`);
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
	 * @type {EventListener}
	 * @param {CustomEvent<LiveChat.LiveChatItemAction[]>} event 
	 */
	#onAction(event) {
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
		const fs = Number.parseInt(s.styles.font_size) || 36;
		const lhf = Number.parseFloat(s.styles.line_height) || 1.4;
		const lh = fs * lhf;
		const sv = s.others.simultaneous;
		const last = sv === SimultaneousModeEnum.LAST_MERGE ? /** @type {HTMLElement?} */ (root.lastElementChild) : null;
		const bodies = last ? [ `<!-- ${last.className} -->` + (last.dataset.text || '') ] : [];
		const ids = last ? [last.id] : [];
		if (sv === SimultaneousModeEnum.FIRST) {
			// @ts-ignore
			const notext = filtered.add.slice(1).filter(a => !a.addChatItemAction?.item.liveChatTextMessageRenderer);
			filtered.add.splice(1, Infinity, ...notext);
		}
		const adding = filtered.add.map(action => new Promise(async (resolve, reject) => {
			// @ts-ignore
			const elem = await parseChatItem(action.addChatItemAction.item);
			if (!elem) return resolve(elem);
			if (sv === SimultaneousModeEnum.MERGE || sv === SimultaneousModeEnum.LAST_MERGE) {
				const body = elem.dataset.text ? `<!-- ${elem.className} -->` + elem.dataset.text : '';
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
						const thumbnail = elem.querySelector('.photo');
						if (earlier && _name && thumbnail) {
							const parent = thumbnail.parentElement;
							if (parent) _name.insertAdjacentElement('beforebegin', parent);
							if (!_name.textContent)  _name.textContent = '';
							this.updateCurrentItem(earlier);
						}
						return resolve(elem.id);
					}
				}
			}
			const duplication = root.getElementById(elem.id);
			if (duplication) {
				const type = elem.className.match(/text (.+)/)?.[1] || 'normal';
				const color = getComputedStyle(le).getPropertyValue(`--yt-lcf-${type}-color`);
				console.log(`Message duplication #${elem.id}: %c${elem.dataset.text || elem.lastElementChild?.textContent}`, color ? 'color:' + color : '');
				return resolve(elem.id);
			}
			elem.addEventListener('animationend', () => {
				elem.remove();
			}, { passive: true });
			const children = Array.from(/** @type {HTMLCollectionOf<HTMLElement>} */ (root.children)).filter(child => child.tagName === 'DIV');
			root.appendChild(elem);
			const ch = le.clientHeight, cw = le.clientWidth;
			if (elem.clientWidth >= cw * (parseInt(s.styles.max_width) / 100 || 1)) elem.classList.add('wrap');
			elem.style.setProperty('--yt-lcf-translate-x', `-${cw + elem.clientWidth}px`);
			const body = /** @type {HTMLElement?} */ (elem.lastElementChild);
			if (body) {
				const content = body.textContent;
				if (content) browser.i18n.detectLanguage(content).then(result => {
					if (result.isReliable) body.lang = result.languages?.[0].language;
				});
			}
			const dir = s.others.direction & 1 ? 'bottom' : 'top';
			if (elem.clientHeight >= ch) {
				elem.style[dir] = '0px';
				elem.dataset.line = '0';
				return resolve(elem.id);
			}
			const overline = Math.floor(ch / lh);
			const reversed = (s.others.direction & 2) > 0;
			let y = 0;
			do {
				if (children.length > 0) {
					elem.style[dir] = `${y * lhf}em`;
					elem.dataset.line = `${y}`;
					const catchable = children.some(before => isCatchable(before, elem, reversed));
					const overflow = isOverflow(le, elem);
					if (!catchable && !overflow) return resolve(elem.id);
				} else {
					elem.style[dir] = '0px';
					elem.dataset.line = '0';
					return resolve(elem.id);
				}
			} while (++y <= overline);

			elem.classList.add('overlap');
			y = 0;
			const st = s.others.overlapping;
			const o = st & 0b01 ? .8 : 1;
			const dy = st & 0b10 ? .5 : 0;

			y = Math.floor(Math.random() * (overline - 1));
			const sibling = children.filter(c => c.dataset.line === `${y}`);
			elem.style.top = `${(y + dy) * lhf}em`;
			elem.style.opacity = `${Math.max(.5, Math.pow(o, sibling.length || 1))}`;
			elem.style.zIndex = `-${sibling.length || 1}`;
			elem.dataset.line = `${y}`;
			return resolve(elem.id);
		}));
		
		// Delete
		const deleting = filtered.delete.map(action => new Promise((resolve, reject) => {
			// @ts-ignore
			const id = action.markChatItemAsDeletedAction.targetItemId;
			const target = root.getElementById(id);
			if (target) {
				target.remove();
				resolve(id);
			} else {
				reject('Failed to delete message: #' + id);
			}
		}));
		
		// Delete by author
		const deletingAuthor = filtered.delete_author.map(action => new Promise((resolve, reject) => {
			// @ts-ignore
			const id = action.markChatItemsByAuthorAsDeletedAction.externalChannelId;
			const targets = root.querySelectorAll(`[data-author-id="${id}"]`);
			if (targets.length > 0) {
				targets.forEach(elem => elem.remove());
				resolve(id);
			} else {
				reject('Failed to delate message: (Author ID) ' + id);
			}
		}));
		
		// Replace
		const replacing = filtered.replace.map(action => new Promise(async (resolve, reject) => {
			// @ts-ignore
			const id = action.replaceChatItemAction.targetItemId;
			const target = root.getElementById(id);
			if (target) {
				// @ts-ignore
				const replacement = action.replaceChatItemAction.replacementItem;
				const elem = await parseChatItem(replacement);
				if (elem) {
					target.replaceWith(elem);
					resolve(id);
				} else {
					reject('Failed to replace message: #' + id);
				}
			} else {
				reject('Failed to replace message: #' + id);
			}
		}));
	}

	/**
	 * Updates the current style of the given item.
	 * @param {HTMLElement} item message element
	 */
	updateCurrentItem(item) {
		const lw = this.layer.element.clientWidth;
		const isLong = item.clientWidth >= lw * (parseInt(s.styles.max_width) / 100 || 1);
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
		console.log('Listen started!');
		this.addEventListener('ytlcf-action', () => {
			this.addEventListener('ytlcf-action', this.#onAction);
		}, { once: true });
	}

	unlisten() {
		this.removeEventListener('ytlcf-action', this.#onAction);
	}

	close() {
		this.unlisten();
		this.layer.clear();
	}
}

/**
 * Updates muted word list.
 */
export function updateMutedWordsList() {
	/** @type { (str: string) => string } */
	const escapeRegExp = str => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
	const { regexp, plainList } = s.mutedWords;
	if (regexp) {
		mutedWordsList = plainList.map(s => new RegExp(s, 'g'));
	} else if (plainList.length > 0) {
		mutedWordsList = [ new RegExp(plainList.map(escapeRegExp).join('|'), 'g') ];
	} else {
		mutedWordsList = [];
	}
}

/**
 * Creates a chat item element from the message renderer.
 * @param {LiveChat.AnyRenderer} item message renderer
 * @returns {Promise<HTMLDivElement | null>} promise of chat item element or null
 */
async function parseChatItem(item) {
	const key = Object.keys(item)[0];
	/** @type {LiveChat.RendererContent} */ // @ts-ignore
	const renderer = item[key];
	const elem = document.createElement('div');
	elem.id = renderer.id || '';
	elem.dataset.authorId = renderer.authorExternalChannelId;
	const name = getText(renderer.authorName);
	elem.dataset.authorName = name;
	const authorElems = document.createDocumentFragment();
	if (name) {
		const a = document.createElement('a');
		a.href = '/channel/' + renderer.authorExternalChannelId;
		a.target = '_blank';
		a.title = name;
		const img = new Image();
		img.part = img.className = 'photo';
		img.src = renderer.authorPhoto.thumbnails[0].url;
		img.loading = 'lazy';
		a.appendChild(img);
		const span = document.createElement('span');
		span.part = span.className = 'name';
		span.textContent = name;
		authorElems.append(a, span);
	}
	const index = s.others.translation;
	const nl = navigator.languages;
	const tl = ['', ...nl][Math.abs(index)];
	const msg = new ChatMessageContainer(renderer.message);
	if (tl) {
		const lazy = s.others.translation_timing ?? 0;
		await msg.translate(lazy ? 'lazy' : 'eager', tl, !!s.others.suffix_original);
	}
	switch (key) {
		case 'liveChatTextMessageRenderer': {
			const authorType = getAuthorType(renderer);
			const allHidden = !Object.values(s.parts[authorType]).includes(true);
			if (allHidden) return null;
			elem.className = 'text ' + authorType;
			const header = document.createElement('span');
			header.className = 'header';
			header.appendChild(authorElems);
			const body = document.createElement('span');
			body.part = 'message';
			body.className = 'body';
			body.append(...msg);
			elem.append(header, body);
			elem.dataset.text = getText(renderer.message);
			return elem;
		}
		case 'liveChatMembershipItemRenderer': {
			const { headerPrimaryText: primary, headerSubtext: sub } 
				= /** @type {LiveChat.MembershipItemRenderer["liveChatMembershipItemRenderer"]} */ (renderer);
			const messageType = primary ? 'milestone' : 'membership';
			elem.className = messageType;
			const allHidden = !Object.values(s.parts[messageType]).includes(true);
			if (allHidden) return null;
			const header = document.createElement('div');
			header.className = 'header';
			header.style.backgroundColor = `rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))`;
			const months = document.createElement('span');
			months.part = months.className = 'months';
			months.append(...getChatMessage(primary || sub, { start: primary ? 1 : 0, filterMode: 0 }));
			header.append(authorElems, months);
			const body = document.createElement('div');
			body.part = 'message';
			body.className = 'body';
			body.style.backgroundColor = `rgba(${getColorRGB(0xff0a8043).join()},var(--yt-lcf-background-opacity))`;
			body.append(...msg);
			elem.append(header, body);
			return elem;
		}
		case 'liveChatPaidMessageRenderer': {
			const allHidden = !Object.values(s.parts.paid_message).includes(true);
			if (allHidden) return null;
			const { headerBackgroundColor, purchaseAmountText, bodyBackgroundColor }
				= /** @type {LiveChat.PaidMessageRenderer["liveChatPaidMessageRenderer"]} */ (renderer);
			elem.className = 'superchat';
			const header = document.createElement('div');
			header.className = 'header';
			header.style.backgroundColor = `rgba(${getColorRGB(headerBackgroundColor).join()},var(--yt-lcf-background-opacity))`;
			const amount = document.createElement('span');
			amount.part = amount.className = 'amount';
			amount.append(getText(purchaseAmountText));
			header.append(authorElems, amount);
			const body = document.createElement('div');
			body.part = 'message';
			body.className = 'body';
			body.style.backgroundColor = `rgba(${getColorRGB(bodyBackgroundColor).join()},var(--yt-lcf-background-opacity))`;
			body.append(...msg);
			elem.append(header, body);
			return elem;
		}
		case 'liveChatPaidStickerRenderer': {
			const allHidden = !Object.values(s.parts.paid_sticker).includes(true);
			if (allHidden) return null;
			const { backgroundColor, purchaseAmountText, moneyChipBackgroundColor, sticker }
				= /** @type {LiveChat.PaidStickerRenderer["liveChatPaidStickerRenderer"]} */ (renderer);
			elem.className = 'supersticker';
			const header = document.createElement('div');
			header.className = 'header';
			header.style.backgroundColor = `rgba(${getColorRGB(backgroundColor).join()},var(--yt-lcf-background-opacity))`;
			const amount = document.createElement('span');
			amount.part = amount.className = 'amount';
			amount.append(getText(purchaseAmountText));
			header.append(authorElems, amount);
			const body = document.createElement('figure');
			body.part = 'sticker';
			body.className = 'body';
			body.style.backgroundColor = `rgba(${getColorRGB(moneyChipBackgroundColor).join()},var(--yt-lcf-background-opacity)`;
			const image = new Image();
			image.className = 'sticker';
			image.src = (sticker.thumbnails.find(t => 2 * 36 <= (t.width || 36)) || sticker.thumbnails[0]).url;
			image.loading = 'lazy';
			body.appendChild(image);
			elem.append(header, body);
			return elem;
		}
		case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer': {
			const allHidden = !Object.values(s.parts.membership).includes(true);
			if (allHidden) return null;
			elem.className = 'membership gift';
			const { header }
				// @ts-ignore
				= /** @type {LiveChat.SponsorshipsGiftPurchaseAnnouncementRenderer["liveChatSponsorshipsGiftPurchaseAnnouncementRenderer"]} */ (renderer);
			const headerRenderer = header.liveChatSponsorshipsHeaderRenderer;
			const count = headerRenderer.primaryText?.runs?.filter(r => !Number.isNaN(parseInt(r.text)))[0]?.text;
			if (!count) break;
			const div = document.createElement('div');
			div.className = 'header';
			div.style.backgroundColor = `rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))`;
			const gifts = document.createElement('span');
			gifts.part = gifts.className = 'gifts';
			gifts.textContent = `\u{1f381}\ufe0e ${count}`;
			div.append(authorElems, gifts);
			elem.appendChild(div);
			return elem;
		}
		case 'liveChatViewerEngagementMessageRenderer': {
			const { icon }
				// @ts-ignore
				= /** @type {LiveChat.ViewerEngagementMessageRenderer["liveChatViewerEngagementMessageRenderer"]} */ (renderer);
			switch (icon.iconType) {
				case 'POLL': {
					elem.className = 'engagement-poll';
					const div = document.createElement('div');
					div.part = 'message';
					div.className = 'body';
					elem.append(...msg);
					break;
				}
				case 'YOUTUBE_ROUND': break;
				default: console.log(renderer);
			}
			break;
		}
		case 'liveChatPlaceholderItemRenderer':
		case 'liveChatSponsorshipsGiftRedemptionAnnouncementRenderer':
			break;
		// liveChatModeChangeMessageRenderer
		default: console.log(item);
	}
	return elem;
}

/**
 * Gets the author type of the message.
 * @param {LiveChat.RendererContent} renderer message renderer
 * @returns author type
 */
function getAuthorType(renderer) {
	const authorTypes = Object.values(AuthorType);
	const classes = renderer.authorBadges?.map(b => {
		const bb = b.liveChatAuthorBadgeRenderer;
		return bb.customThumbnail ? AuthorType.MEMBER : bb.icon?.iconType.toLocaleLowerCase() || '';
	}) || [];
	for (const s of authorTypes) if (classes.includes(s)) return s;
	return AuthorType.NORMAL;
}

/**
 * Gets nodes of chat message from the message item.
 * @param {LiveChat.Runs | LiveChat.SimpleText} [message] message item
 * @param {object} [options={}] message options
 * @param {number} [options.start] start position of message
 * @param {number} [options.end] end position of message
 * @param {EmojiModeEnum} [options.emoji] emoji mode
 * @param {MutedWordModeEnum} [options.filterMode] filter mode
 * @returns {Array<HTMLSpanElement | Text>} nodes of chat message
 */
export function getChatMessage(message, options = {}) {
	if (!message) return [];
	
	const { start, end, filterMode } = options;
	const filterOptions = {
		mode: filterMode || s.mutedWords.mode,
		rules: mutedWordsList,
		replacement: s.mutedWords.replacement,
	};
	if ('simpleText' in message) {
		const str = filterMessage(message.simpleText, filterOptions).value;
		return [ new Text(start || end ? str.slice(start, end) : str) ];
	}
	const rslt = [];
	const runs = start || end ? message.runs.slice(start, end) : message.runs;
	for (const r of runs) {
		if ('text' in r) {
			const filtered = filterMessage(r.text, filterOptions);
			if (filtered.done && filterMode === MutedWordModeEnum.ALL) return [];
			let node;
			if (r.navigationEndpoint || r.bold || r.italics) {
				if (r.navigationEndpoint) {
					node = document.createElement('a');
					const ep = r.navigationEndpoint.urlEndpoint || r.navigationEndpoint.watchEndpoint;
					if (ep) {
						/** @type {SVGGElement?} */
						const iconref = document.querySelector('iron-iconset-svg #open-in-new');
						node.href = 'url' in ep ? ep.url : (ep.videoId ? '/watch?v=' + ep.videoId : '');
						node.classList.add('open_in_new');
						node.target = '_blank';
						node.title = filtered.value;
						if (ep.nofollow) node.rel = 'nofollow';
						const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
						svg.setAttribute('viewBox', '0 0 24 24');
						svg.setAttribute('fill', 'currentColor');
						svg.setAttribute('stroke', '#000');
						svg.setAttribute('paint-order', 'stroke');
						if (iconref) svg.appendChild(iconref.cloneNode(true));
						node.appendChild(svg);
					}
				} else {
					node = document.createElement('span');
				}
				if (r.bold) node.classList.add('b');
				if (r.italics) node.classList.add('i');
			} else {
				node = new Text(filtered.value);
			}
			rslt.push(node);
		} else {
			const emoji = options.emoji ?? s.others.emoji;
			if (emoji < 0) {
				rslt.push(new Text(r.emoji.shortcuts?.[0] || r.emoji.emojiId || ''));
			} else if (emoji) {
				let skip = false;
				if (filterMode) {
					const shortcuts = [...(r.emoji.shortcuts || [r.emoji.emojiId])];
					const plainList = s.mutedWords.plainList;
					for (const rule of plainList) {
						const b = shortcuts.includes(rule);
						if (b) {
							skip = true;
							const replacement = s.mutedWords.replacement;
							switch (filterMode) {
								case MutedWordModeEnum.ALL: return [];
								case MutedWordModeEnum.WORD: rslt.push(new Text(replacement)); break;
								case MutedWordModeEnum.CHAR: rslt.push(new Text([...replacement][0] || '')); break;
							}
							break;
						}
					}
				}
				if (!skip) {
					const thumbnail = r.emoji.image.thumbnails.slice(-1)[0];
					const label = r.emoji.image.accessibility.accessibilityData.label;
					let img;
					if (thumbnail) {
						img = new Image();
						img.src = thumbnail.url;
						img.alt = label;
					} else {
						img = new Text(r.emoji.emojiId);
					}
					const span = document.createElement('span');
					span.classList.add('emoji');
					span.dataset.label = label;
					span.dataset.shortcut = r.emoji.shortcuts?.[0] || '';
					span.appendChild(img);
					rslt.push(span);
				}
			}
		}
	}
	return rslt;
}
