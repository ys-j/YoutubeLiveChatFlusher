import { store as s } from './store.mjs';
import { isNotPip, loadTemplateDocument } from './utils.mjs';

import { EmojiModeEnum, MutedWordModeEnum, updateMutedWordsList } from './chat_message.mjs';

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

export class LiveChatPanel {
	/**
	 * @type {import("./chat_controller.mjs").LiveChatController}
	 */
	#controller;

	/**
	 * Container element of the panel
	 * @type {HTMLDivElement}
	 */
	element;

	/**
	 * Content element of the panel
	 * @type {HTMLFormElement | undefined}
	 */
	form;

	/**
	 * Creates new config panel.
	 * @param {import("./chat_controller.mjs").LiveChatController} controller controller
	 * @param {HTMLDivElement} [div] container element
	 */
	constructor(controller, div = undefined) {
		this.#controller = controller;
		this.element = div || document.createElement('div');
		this.element.id = 'yt-lcf-panel';
		this.element.className = 'ytp-sfn';
		this.element.setAttribute('data-layer', '4');
		this.hide();

		const c = { x: 10, y: 10 };
		/** @type {(val: number, min: number, max: number) => number} */
		const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
		/** @type {(e: MouseEvent) => void} */
		const onmousemove = e => {
			const le = this.#controller.layer.element;
			if (!le || !isNotPip()) return;
			const x = clamp(this.element.offsetLeft + e.clientX - c.x, 10, le.clientWidth - this.element.clientWidth - 10);
			const y = clamp(this.element.offsetTop + e.clientY - c.y, 10, le.clientHeight - this.element.clientHeight - 10);
			this.move(x, y);
			c.x = e.clientX;
			c.y = e.clientY;
		};
		const onmouseup = () => {
			self.removeEventListener('mousemove', onmousemove);
			self.removeEventListener('mouseup', onmouseup);
			window.removeEventListener('mouseup', onmouseup);
		};
		this.element.addEventListener('mousedown', e => {
			const tagName = /** @type {HTMLElement} */ (e.target)?.tagName;
			if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return;
			c.x = e.clientX;
			c.y = e.clientY;
			self.addEventListener('mousemove', onmousemove, { passive: true });
			self.addEventListener('mouseup', onmouseup, { passive: true });
			window.addEventListener('mouseup', onmouseup, { passive: true });
		}, { passive: true });
		this.element.addEventListener('keyup', e => {
			e.stopPropagation();
		});
	}

	/**
	 * Creates content of the panel.
	 * @returns {Promise<HTMLFormElement>} promise of content of the panel
	 */
	async createForm() {
		const doc = await loadTemplateDocument('../templates/panel_form.html', ['title', 'placeholder']);
		this.form = doc.forms[0];

		const buttons = this.form.querySelectorAll('button[role="tab"]');
		const tabs = this.form.querySelectorAll('[role="tabpanel"]');

		for (const btn of buttons) {
			btn.addEventListener('click', () => {
				for (const btn of buttons) {
					btn.setAttribute('aria-selected', 'false');
				}
				btn.setAttribute('aria-selected', 'true');
				for (const tab of tabs) {
					/** @type {HTMLElement} */ (tab).hidden = true;
				}
				const id = btn.getAttribute('aria-controls');
				/** @type {?HTMLElement | undefined} */
				const f = this.form?.querySelector(`#${id}`);
				if (f) f.hidden = false;
			}, { passive: true });
		}

		const isDarkMode = document.documentElement.hasAttribute('dark');
		/** @param {string[]} c */
		const createButtonClassList = (...c) => {
			const base = 'ytSpecButtonShapeNext';
			const list = c.map(v => base + v.replace(/(?:^|-+)(\w)/g, (_, p1) => p1.toUpperCase()));
			list.unshift(base);
			return list.join(' ');
		};

		/** @type {HTMLButtonElement?} */
		const fontHelperButton = this.form.querySelector('#font_helper');
		/** @type {HTMLDialogElement?} */
		const fontHelperDialog = doc.querySelector('#ytlcf-dialog-font_helper');
		if (fontHelperButton && fontHelperDialog) this.#readyFontHelper(fontHelperButton, fontHelperDialog, createButtonClassList, isDarkMode);

		/** @type {HTMLButtonElement?} */
		const layerResizeHelperButton = this.form.querySelector('#layer_resize_helper');
		if (layerResizeHelperButton) this.#readyLayerResizeHelper(layerResizeHelperButton, createButtonClassList, isDarkMode);

		/** @type {HTMLButtonElement?} */
		const userCssHelperButton = this.form.querySelector('#user_css_helper');
		/** @type {HTMLDialogElement?} */
		const userCssHelperDialog = doc.querySelector('#ytlcf-dialog-user_css_helper');
		if (userCssHelperButton && userCssHelperDialog) this.#readyUserCssHelper(userCssHelperButton, userCssHelperDialog, createButtonClassList, isDarkMode);

		const othersBtn = this.form.querySelector('#ytlcf-config-others');
		if (othersBtn) {
			othersBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
			othersBtn.addEventListener('click', () => {
				browser.runtime.sendMessage({ fire: 'openOptions' });
			}, { passive: true });
		}

		this.form.addEventListener('change', e => {
			if (!this.form?.reportValidity()) return;
			const elem = /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */ (e.target);
			this.updateStorage(elem);
		}, { passive: true });

		const closeBtn = document.createElement('button');
		closeBtn.className = 'ytp-sfn-close ytp-button';
		closeBtn.title = browser.i18n.getMessage('close');
		closeBtn.textContent = '[X]';
		closeBtn.addEventListener('click', () => {
			this.hide();
		}, { passive: true });
		this.element.insertAdjacentElement('beforeend', closeBtn);
		this.element.insertAdjacentElement('beforeend', this.form);
		this.element.addEventListener('keydown', e => {
			e.stopPropagation();
		}, { passive: true });

		return this.form;
	}

	/**
	 * @param {HTMLButtonElement} button
	 * @param {HTMLDialogElement} dialog
	 * @param {(...cls: string[]) => string} clsBuilder
	 * @param {boolean} isDarkMode
	 */
	#readyFontHelper(button, dialog, clsBuilder, isDarkMode) {
		/** @type {HTMLTemplateElement?} */
		const template = dialog.querySelector('#ytlcf-dialog-font_helper-family');
		if ('queryLocalFonts' in window && template) {
			button.after(dialog);
			const form = dialog.querySelector('form');
			const ol = dialog.querySelector('ol');
			const select = dialog.querySelector('select');
			// @ts-expect-error
			window.queryLocalFonts().then(fonts => {
				if (select) {
					const families = new Set(fonts.map(f => f.family));
					select.append(...Array.from(families, f => new Option(f)));
				}
			});
			const [addBtn, confirmBtn, cancelBtn] = dialog.querySelectorAll('form > div > button');
			addBtn.className = clsBuilder('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
			addBtn.addEventListener('click', () => {
				const family = select?.value;
				if (!family) return;
				const fragment = template.content.cloneNode(true);
				fragment.querySelector('li')?.setAttribute('data-value', family);
				const span = fragment.querySelector('span');
				if (span) span.textContent = family;
				for (const b of fragment.querySelectorAll('button')) {
					b.className = clsBuilder('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
					const fn = b.getAttribute('data-function');
					if (fn) {
						const label = browser.i18n.getMessage(fn);
						if (label) b.title = b.textContent = label;
					}
				}
				ol?.append(fragment);
			}, { passive: true });
			ol?.addEventListener('click', e => {
				const t = /** @type {HTMLElement?} */ (e.target);
				if (t && t.tagName === 'BUTTON') {
					const li = t.closest('li');
					if (li)
					switch (t.getAttribute('data-function')) {
						case 'up': li.previousElementSibling?.before(li); break;
						case 'down': li.nextElementSibling?.after(li); break;
						case 'delete': li.remove();
					}
				}
			}, { passive: true });

			confirmBtn.className = clsBuilder('filled', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
			cancelBtn.className = clsBuilder('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
			cancelBtn.addEventListener('click', () => {
				dialog.close();
			}, { passive: true });

			if (form && ol) form.addEventListener('submit', () => {
				const families = Array.from(ol.children).map(li => {
					const val = li.getAttribute('data-value');
					return val ? val.includes(' ') ? `"${val}"` : val : undefined;
				});
				const font_family = /** @type {HTMLInputElement | undefined} */ (this.form?.elements.font_family);
				if (font_family) {
					font_family.value = families.filter(f => !!f).join(', ');
					this.updateStorage(font_family);
				}
			}, { passive: true });

			button.addEventListener('click', () => {
				while (ol?.childElementCount) ol.replaceChildren();
				const families = s.styles.font_family.split(/\s*,\s*/).filter(s => s.length > 0).map(s => s.replace(/^"(.*)"$/, "$1"));
				const listitems = families.map(family => {
					const fragment = template.content.cloneNode(true);
					fragment.querySelector('li')?.setAttribute('data-value', family);
					const span = fragment.querySelector('span');
					if (span) span.textContent = family;
					for (const b of fragment.querySelectorAll('button')) {
						b.className = clsBuilder('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
						const fn = b.getAttribute('data-function');
						if (fn) {
							const label = browser.i18n.getMessage(fn);
							if (label) b.title = b.textContent = label;
						}
					}
					return fragment;
				});
				ol?.append(...listitems);
				dialog.showModal();
			}, { passive: true });
		} else {
			button.hidden = true;
		}
	}

	/**
	 * @param {HTMLButtonElement} button
	 * @param {(...cls: string[]) => string} clsBuilder
	 * @param {boolean} isDarkMode
	 */
	#readyLayerResizeHelper(button, clsBuilder, isDarkMode) {
		button.className = clsBuilder('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
		button.addEventListener('click', () => {
			const le = this.#controller.layer.element;
			const vc = this.#controller.player.querySelector('#ytd-player');
			if (!vc) return;
			le.classList.add('resize-mode');
			le.focus();

			const c = { x: le.clientLeft || 0, y: le.clientTop || 0 };
			/** @type {(val: number, min: number, max: number) => number} */
			const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
			/** @type {(e: MouseEvent) => void} */
			const onmousemove = e => {
				if (!isNotPip() || !vc) return;
				const x = clamp(le.offsetLeft + e.clientX - c.x, 0, vc.clientWidth - le.clientWidth);
				const y = clamp(le.offsetTop + e.clientY - c.y, 0, vc.clientHeight - le.clientHeight);
				this.#controller.layer.move(x, y);
				c.x = e.clientX;
				c.y = e.clientY;
			};
			/** @type {(e: MouseEvent) => void} */
			const onmouseup = () => {
				self.removeEventListener('mousemove', onmousemove);
				self.removeEventListener('mouseup', onmouseup);
				window.removeEventListener('mouseup', onmouseup);
			};
			/** @type {(e: MouseEvent) => void} */
			const onmousedown = e => {
				if (e.clientX > le.clientWidth - 64 && e.clientY > le.clientHeight - 64) return;
				c.x = e.clientX;
				c.y = e.clientY;
				self.addEventListener('mousemove', onmousemove, { passive: true });
				self.addEventListener('mouseup', onmouseup, { passive: true });
				window.addEventListener('mouseup', onmouseup, { passive: true });
			};

			/** @type { (e: MouseEvent) => void } */
			const stopPropagation = e => e.stopPropagation();
			/** @type {(e: KeyboardEvent) => void} */
			const onkeydown = e => {
				if (!['Enter', 'Escape'].includes(e.key)) return;
				le.classList.remove('resize-mode');
				document.removeEventListener('click', stopPropagation, { capture: true });
				self.removeEventListener('keydown', onkeydown);
				const input = /** @type {HTMLInputElement | undefined} */ (this.#controller.panel.form?.elements.layer_css);
				const value = input?.value;
				const styleMap = new Map(value ? value.split(/;\s*/).map(entry => {
					const [prop, val] = entry.split(/:\s*/, 2);
					return [prop.toLowerCase(), val];
				}) : undefined);
				if (e.key === 'Enter') {
					const defaults = { left: 0, top: 0, width: 100, height: 100 };
					const percents = {
						left: ((le.offsetLeft - vc.clientLeft) / vc.clientWidth) * 100,
						top: ((le.offsetTop - vc.clientTop) / vc.clientHeight) * 100,
						width: (le.clientWidth / vc.clientWidth) * 100,
						height: (le.clientHeight / vc.clientHeight) * 100,
					}
					for (const [prop, val] of Object.entries(percents)) {
						if (val === defaults[prop]) {
							styleMap.delete(prop);
						} else if (val) {
							styleMap.set(prop, val.toFixed(1) + '%');
						}
					}
					styleMap.delete('');
					if (input) {
						const newValue = Array.from(styleMap.entries(), entry => entry.join(': ')).join('; ');
						input.value = newValue ? newValue + ';' : '';
						this.#controller.panel.updateStorage(input);
					}
					le.removeEventListener('mousedown', onmousedown);
				} else {
					le.style.left = styleMap.get('left') || '';
					le.style.top = styleMap.get('top') || '';
					le.style.width = styleMap.get('width') || '';
					le.style.height = styleMap.get('height') || '';
				}
				le.blur();
			}

			self.addEventListener('keydown', onkeydown, { passive: true });
			le.addEventListener('mousedown', onmousedown, { passive: true });
			document.addEventListener('click', stopPropagation, { capture: true });
		}, { passive: true });
	}

	/**
	 * @param {HTMLButtonElement} button
	 * @param {HTMLDialogElement} dialog
	 * @param {(...cls: string[]) => string} clsBuilder
	 * @param {boolean} isDarkMode
	 */
	#readyUserCssHelper(button, dialog, clsBuilder, isDarkMode) {
		button.className = clsBuilder('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
		if (dialog) {
			button.after(dialog);

			/** @type {HTMLFormElement?} */
			const form = dialog.querySelector('#ytlcf-form-user_css_helper');
			/** @type {HTMLTextAreaElement?} */
			const preview = dialog.querySelector('#ytlcf-textarea-user_css_helper');
			const pattern = /^UC[\w-]{22}$/;

			if (form && preview) {
				form.addEventListener('change', () => {
					let text = '';
					const ctrls = form.elements;
					const label = /** @type {HTMLInputElement} */ (ctrls.label).value;
					if (label) text += `/* ${label} */\n`;
					const textarea = /** @type {HTMLTextAreaElement} */ (ctrls.channel_id);
					const lines = textarea.value.split('\n');
					const ids = lines.filter(id => pattern.test(id));
					if (ids.length > 0) {
						text += ids.map(id => `div[data-author-id="${id}"]`).join(',\n') + ' {\n';
						for (const input of /** @type {RadioNodeList} */ (ctrls.this_display_)) {
							const c = /** @type {HTMLInputElement} */ (input).value;
							const v = /** @type {HTMLInputElement} */ (input).checked ? 'inline' : 'none';
							text += `  .${c} { display: ${v}; }\n`;
						}
						if (/** @type {HTMLInputElement} */ (ctrls.this_color_display_).checked) {
							text += `  color: ${/** @type {HTMLInputElement} */ (ctrls.this_color_).value};\n`;
						}
						if (/** @type {HTMLInputElement} */ (ctrls.font_factor).valueAsNumber !== 1) {
							text += `  font-size: ${/** @type {HTMLInputElement} */ (ctrls.font_factor).value}em;\n`;
						}
						text += '}';
					}
					const invalidLN = lines.map((id, i) => !id || pattern.test(id) ? -1 : i + 1).filter(v => v > 0);
					const validityMsg = invalidLN.length > 0 ? browser.i18n.getMessage('validation_channelId', invalidLN.join()) : '';
					textarea.setCustomValidity(validityMsg);
					preview.value = text;
				}, { passive: true });
				form.addEventListener('submit', _ => {
					const textarea = /** @type {HTMLTextAreaElement | undefined} */ (this.form?.elements.user_defined_css);
					if (textarea) {
						textarea.value += '\n' + preview.value;
						this.updateStorage(textarea);
					}
					form.reset();
					preview.value = '';
				}, { passive: true });
			}
			const [confirmBtn, cancelBtn] = dialog.querySelectorAll('button');
			confirmBtn.className = clsBuilder('filled', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
			cancelBtn.className = clsBuilder('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
			cancelBtn.addEventListener('click', () => {
				dialog.close();
			}, { passive: true });

			button.addEventListener('click', () => {
				dialog.showModal();
			}, { passive: true });
		}
	}

	/**
	 * Hides the panel.
	 */
	hide() {
		this.element.querySelector('button')?.blur(); // avoid ARIA error
		this.element.hidden = true;
		this.element.ariaHidden = 'true';
		this.element.style.display = 'none';
	}

	/**
	 * Shows the panel.
	 */
	show() {
		this.element.hidden = false;
		this.element.ariaHidden = 'false';
		this.element.style.display = 'block';
	}

	/**
	 * Updates settings of the element.
	 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} elem form control element; `<input>` or `<select>` or `<textarea>`
	 */
	updateStorage(elem) {
		const name = elem.name;
		const layer = this.#controller.layer;
		const le = layer.element;
		const ctrls = this.form?.elements;
		if (!ctrls) return;
		if (elem.tagName === 'SELECT') {
			if (name in s.others) {
				const val = Number.parseInt(elem.value, 10);
				if (name === 'translation') {
					const prefix = /** @type {HTMLInputElement} */ (ctrls.prefix_lang);
					prefix.disabled = val === 0;
					s.others[name] = val * (prefix.checked ? -1 : 1);
					const cb = /** @type {NodeListOf<HTMLInputElement>} */ (ctrls.except_lang);
					if (val) {
						const i = Math.abs(val) - 1;
						cb[i].checked = true;
						for (let j = 0; j < cb.length; j++) {
							cb[j].disabled = i === j;
						}
						s.others.except_lang |= 1 << i;
					} else {
						for (const e of cb) {
							e.disabled = true;
						}
					}
				} else {
					// @ts-expect-error
					s.others[name] = val;
				}
				switch (name) {
					case 'emoji': {
						le.setAttribute('data-emoji', Object.keys(EmojiModeEnum)[val].toLowerCase());
						layer.updateCurrentItemStyle();
						break;
					}
					case 'wrap': {
						const wrapStyle = WrapStyleDefinitions[val];
						le.style.setProperty('--yt-lcf-message-hyphens', wrapStyle.hyphens);
						le.style.setProperty('--yt-lcf-message-word-break', wrapStyle.wordBreak);
						le.style.setProperty('--yt-lcf-message-white-space', wrapStyle.whiteSpace);
						le.style.setProperty('--yt-lcf-max-width', s.styles.max_width);
						layer.updateCurrentItemStyle();
						break;
					}
				}
			} else if (name === 'muted_words_mode') {
				const mode = Number.parseInt(elem.value, 10);
				s.mutedWords.mode = mode;
				const replacement = /** @type {HTMLInputElement} */ (ctrls.muted_words_replacement);
				replacement.title = mode === MutedWordModeEnum.CHAR ? browser.i18n.getMessage('tooltip_mutedWordsReplacement') : '';
			}
		} else if (elem.classList.contains('styles') && name) {
			// @ts-expect-error
			s.styles[name] = elem.value + (elem.getAttribute('data-unit') || '');
			if (le) {
				switch (name) {
					case 'animation_duration': {
						const value = /** @type {HTMLInputElement} */ (elem).valueAsNumber;
						if (value > 0) {
							const speed = le.getBoundingClientRect().width / value;
							if (speed) /** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber = Math.round(speed);
						}
						break;
					}
					case 'max_width': layer.updateCurrentItemStyle();
				}
				// @ts-expect-error
				le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-'), s.styles[name]);
			}
		} else if (name.startsWith('stroke_')) {
			// @ts-expect-error
			s.styles[name] = elem.value + (elem.getAttribute('data-unit') || '');
			// @ts-expect-error
			le.style.setProperty(name.replace('stroke_', '--yt-lcf-stroke-'), s.styles[name]);
		} else if (name.endsWith('_display')) {
			const match = name.match(/^(.+)_display$/);
			if (match && elem.tagName === 'INPUT') {
				const [_, type] = match;
				if (type in s.parts && le) {
					if (elem.value !== 'color') {
						// @ts-expect-error
						s.parts[type][elem.value] = /** @type {HTMLInputElement} */ (elem).checked;
						le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-') + '-' + elem.value, /** @type {HTMLInputElement} */ (elem).checked ? 'inherit' : 'none');
					} else {
						if (/** @type {HTMLInputElement} */ (elem).checked) {
							// @ts-expect-error
							s.parts[type].color = /** @type {HTMLInputElement?} */ (ctrls[type + '_color'])?.value;
							// @ts-expect-error
							le.style.setProperty('--yt-lcf-' + type.replace(/_/g, '-') + '-color', s.parts[type].color || 'inherit');
						} else {
							// @ts-expect-error
							s.parts[type].color = null;
							le.style.removeProperty('--yt-lcf-' + type.replace(/_/g, '-') + '-color');
						}
					}
					// @ts-expect-error
					s.parts[type] = s.data.parts[type];
					layer.updateCurrentItemStyle(type);
				}
			}
		} else if (name.endsWith('_color')) {
			const match = name.match(/^(.+)_color$/);
			if (match) {
				const [_, type] = match;
				if (/** @type {HTMLInputElement?} */ (elem.previousElementSibling?.firstElementChild)?.checked) {
					// @ts-expect-error
					s.parts[type].color = /** @type {HTMLInputElement?} */ (ctrls[type + '_color'])?.value;
					// @ts-expect-error
					le.style.setProperty('--yt-lcf-' + type.replace('_', '-') + '-color', s.parts[type].color || 'inherit');
				} else {
					// @ts-expect-error
					s.parts[type].color = null;
					le.style.removeProperty('--yt-lcf-' + type.replace('_', '-') + '-color');
				}
			}
		} else if (name === 'layer_css') {
			const newCss = /** @type {HTMLInputElement?} */ (ctrls[name])?.value || '';
			s.styles.layer_css = newCss;
			le.style.cssText = le.style.cssText.replace(/--yt-lcf-layer-css: below;.*$/, '--yt-lcf-layer-css: below; ' + newCss);
		} else if (name.endsWith('_css')) {
			const match = name.match(/^(.*)_css$/);
			if (match) {
				const [_, type] = match;
				const selector = type && type !== 'user_defined' ? '.' + type : '';
				// @ts-expect-error
				s.cssTexts[selector] = /** @type {HTMLInputElement?} */ (ctrls[type + '_css'])?.value || '';
				if (selector) {
					const style = layer.root.getElementById('customcss');
					if (style) {
						const rule = new RegExp(`:host>${selector.replace('.', '\\.')}{.*?}`);
						// @ts-expect-error
						style.textContent = (style.textContent || '').replace(rule, `:host>${selector}{${s.cssTexts[selector]}}`);
					}
				} else {
					const style = layer.root.getElementById('userdefinedcss');
					if (style) style.textContent = s.cssTexts[''];
				}
			}
		} else if (name === 'prefix_lang') {
			const checked = this.form?.[name].checked;
			const val = s.others.translation;
			s.others.translation = Math.abs(val) * (checked ? -1 : 1);
			le.classList[checked ? 'add' : 'remove'](name);
			layer.updateCurrentItemStyle();
		} else if (name === 'suffix_original') {
			const checked = this.form?.[name].checked;
			s.others[name] = Number(checked);
			le.classList[checked ? 'add' : 'remove'](name);
		} else if (['overlapping', 'direction', 'except_lang', 'suffix_original'].includes(name)) {
			/** @type {NodeListOf<HTMLInputElement>} */
			const list = this.form?.[name];
			const val = Array.from(list).map(l => Number(l.checked)).reduce((a, c, i) => a + (c << i), 0);
			// @ts-expect-error
			s.others[name] = val;
			if (name === 'direction') {
				le.classList[0b01 & val ? 'add': 'remove']('direction-reversed-y');
				le.classList[0b10 & val ? 'add': 'remove']('direction-reversed-x');
			}
		} else if (name.startsWith('muted_words_')) {
			switch (name) {
				case 'muted_words_replacement': {
					s.mutedWords.replacement = elem.value;
					break;
				}
				default: {
					s.mutedWords.regexp = /** @type {HTMLInputElement} */ (ctrls.muted_words_regexp).checked;
					s.mutedWords.plainList = /** @type {HTMLTextAreaElement} */ (ctrls.muted_words_list).value.split(/\n+/).filter(s => s.length > 0);
					updateMutedWordsList();
				}
			}
		}
		switch (name) {
			case 'speed':
			case 'px_per_sec': {
				const checked = /** @type {HTMLInputElement} */ (ctrls.speed).checked;
				/** @type {HTMLInputElement} */ (ctrls.animation_duration).disabled = checked;
				/** @type {HTMLInputElement} */ (ctrls.px_per_sec).disabled = !checked;
				s.others.px_per_sec = checked ? /** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber : 0;
				layer.resetAnimationDuration();
				break;
			}
			case 'lines':
			case 'number_of_lines':
			case 'type_of_lines': {
				const checked = /** @type {HTMLInputElement} */ (ctrls.lines).checked;
				/** @type {HTMLInputElement} */ (ctrls.font_size).disabled = checked;
				/** @type {HTMLInputElement} */ (ctrls.number_of_lines).disabled = !checked;
				/** @type {HTMLInputElement} */ (ctrls.type_of_lines).disabled = !checked;
				s.others.number_of_lines = checked ? /** @type {HTMLInputElement} */ (ctrls.number_of_lines).valueAsNumber : 0;
				layer.resetFontSize();
				break;
			}
			case 'unlimited':
			case 'limit_number': {
				const checked = /** @type {HTMLInputElement} */ (ctrls.unlimited).checked;
				/** @type {HTMLInputElement} */ (ctrls.limit_number).disabled = checked;
				s.others.limit = checked ? 0 : /** @type {HTMLInputElement} */ (ctrls.limit_number).valueAsNumber;
				layer.limit = s.others.limit;
				break;
			}
			case 'container_unlimited':
			case 'container_limit_number': {
				const checked = /** @type {HTMLInputElement} */ (ctrls.container_unlimited).checked;
				/** @type {HTMLInputElement} */ (ctrls.container_limit_number).disabled = checked;
				s.others.container_limit = checked ? 0 : /** @type {HTMLInputElement} */ (ctrls.container_limit_number).valueAsNumber;
				break;
			}
			case 'show_username': {
				const checked = /** @type {HTMLInputElement} */ (ctrls.show_username).checked;
				s.others.show_username = checked ? 1 : 0;
				break;
			}
			case 'time_shift': {
				s.others.time_shift = /** @type {HTMLInputElement} */ (ctrls.time_shift).valueAsNumber;
				break;
			}
		}
	}

	/**
	 * Moves the panel to the given corrdinates.
	 * @param {number} x x-coordinate
	 * @param {number} y y-coordinate
	 */
	move(x, y) {
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}
}
