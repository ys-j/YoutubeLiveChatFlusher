/* Copyright 2021 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';
const g = {
	app: /** @type {HTMLElement?} */ (null),
	array: {
		hyphens: ['manual', 'auto', 'auto'],
		wordBreak: ['keep-all', 'normal', 'keep-all'],
		whiteSpace: ['pre', 'pre-line', 'pre-line'],
	},
	channel: '',
	index: {
		/** @type { { fixed: 0, max: 1, min: 2 } } */
		lines: { fixed: 0, max: 1, min: 2 },
		/** @type { {  none: 0, normal: 1, auto: 2} } */
		wrap: { none: 0, normal: 1, auto: 2 },
		/** @type { { all: 0, first: 1, merge: 2, last_merge: 3 } } */
		simultaneous: { all: 0, first: 1, merge: 2, last_merge: 3 },
		/** @type { { none: 0, all: 1, label: 2, shortcut: 3 } } */
		emoji: { none: 0, all: 1, label: 2, shortcut: 3 },
		/** @type { { none: 0, all: 1, word: 2, char: 3 } } */
		mutedWords: { none: 0, all: 1, word: 2, char: 3 },
	},
	/** @type {LiveChatLayer?} */
	layer: null,
	/** @type {LiveChatPanel?} */
	panel: null,
	skip: false,
	storage: {
		// default value
		styles: {
			animation_duration: '8s',
			font_size: '32px',
			line_height: '1.25',
			font_family: 'inherit',
			font_weight: '500',
			stroke_color: '#000000',
			stroke_offset: '1px',
			stroke_blur: '0px',
			layer_opacity: '1',
			background_opacity: '0.5',
			max_width: '100%',
			sticker_size: '3em',
		},
		others: {
			px_per_sec: 0,
			number_of_lines: 0,
			type_of_lines: 0,
			wrap: 1,
			limit: 0,
			simultaneous: 2,
			emoji: 1,
			translation: 0,
			except_lang: 0,
		},
		parts: {
			normal: { photo: false, name: false, message: true, color: '' },
			verified: { photo: true, name: true, message: true, color: '' },
			member: { photo: false, name: false, message: true, color: '' },
			moderator: { photo: true, name: true, message: true, color: '' },
			owner: { photo: true, name: true, message: true, color: '' },
			you: { photo: false, name: false, message: true, color: '' },
			paid_message: { photo: true, name: true, amount: true, message: true, color: '' },
			paid_sticker: { photo: true, name: true, amount: true, sticker: true },
			membership: { photo: true, name: false, message: true, color: '' },
			milestone: { photo: true, name: true, months: true, message: true, color: '' },
		},
		cssTexts: {
			'.normal': '',
			'.verified': '',
			'.member': '',
			'.moderator': '',
			'.owner': '',
			'.you': '',
			'.paid_message': '',
			'.paid_sticker': '',
			'.membership': '',
			'.milestone': '',
			'div': '',
		},
		hotkeys: {
			layer: '',
			panel: '',
		},
		mutedWords: {
			mode: 0,
			replacement: '',
			regexp: false,
			/** @type {string[]} */
			plainList: [],
		},
	},
	list: {
		/** @type {RegExp[]} */
		mutedWords: [],
	},
	tag: {
		chat: 'yt-live-chat-renderer',
		layer: 'yt-lcf-layer',
		panel: 'yt-lcf-panel',
		checkbox: 'yt-lcf-cb',
		popupmenu: 'yt-lcf-pm',
	}
};

const getMessage = browser.i18n.getMessage;

class LiveChatLayer {
	/** @param div {?HTMLDivElement | undefined} */
	constructor(div = undefined) {
		this.limit = 0;
		this.element = div || document.createElement('div');
		this.element.id = g.tag.layer;
		this.element.dataset.layer = '1';
		this.element.setAttribute('role', 'marquee');
		this.element.setAttribute('aria-live', 'off');
		const resizeObserver = new ResizeObserver(entries => {
			this.init();
			this.resetAnimationDuration();
			this.resetFontSize();
		});
		resizeObserver.observe(this.element);
		this.init();
	}
	init() {
		const root = this.element.shadowRoot || this.element.attachShadow({ mode: 'open' });
		root.innerHTML = '';
		const fragment = document.createDocumentFragment();
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = browser.runtime.getURL('layer.css');
		fragment.appendChild(link);
		const cs = document.createElement('style');
		cs.id = 'customcss';
		fragment.appendChild(cs);
		const ys = document.createElement('style');
		ys.id = 'yourcss';
		link.style.display = cs.style.display = ys.style.display = 'none';
		fragment.appendChild(ys);
		root.appendChild(fragment);
		const mutationObserver = new MutationObserver(() => {
			const over = root.childElementCount - (this.limit || Infinity);
			let i = 3;
			while (i++ < over) ys.nextElementSibling?.remove();
		});
		mutationObserver.observe(root, { childList: true });
		return this;
	}
	hide() {
		this.element.hidden = true;
		this.element.ariaHidden = 'true';
		this.element.style.display = 'none';
		this.init();
	}
	show() {
		this.element.hidden = false;
		this.element.ariaHidden = 'false';
		this.element.style.display = 'block';
	}
	resetAnimationDuration(pxPerSec = g.storage.others.px_per_sec) {
		if (pxPerSec) {
			const durationBySpeed = this.element.getBoundingClientRect().width / pxPerSec;
			g.storage.styles.animation_duration = durationBySpeed.toFixed(1) + 's';
			if (g.panel) g.panel.form.animation_duration.value = durationBySpeed.toFixed(1);
		} else {
			if (g.panel) g.storage.styles.animation_duration = g.panel.form.animation_duration.value + 's';
		}
		this.element.style.setProperty('--yt-lcf-animation-duration', g.storage.styles.animation_duration);
	}
	resetFontSize(numberOfLines = g.storage.others.number_of_lines) {
		if (numberOfLines) {
			const sizeByLines = Math.floor(this.element.getBoundingClientRect().height / parseFloat(g.storage.styles.line_height) / numberOfLines);
			this.element.style.setProperty('--yt-lcf-font-size', [
				`${sizeByLines}px`,
				`max(${g.storage.styles.font_size}, ${sizeByLines}px)`,
				`min(${g.storage.styles.font_size}, ${sizeByLines}px)`,
			][g.storage.others.type_of_lines]);
		} else {
			this.element.style.setProperty('--yt-lcf-font-size', g.storage.styles.font_size);
		}
	}
}

class LiveChatPanel {
	/** @param div {?HTMLDivElement | undefined} */
	constructor(div = undefined) {
		this.element = div || document.createElement('div');
		this.element.id = g.tag.panel;
		this.element.className = 'ytp-sfn';
		this.element.dataset.layer = '4';
		this.hide();

		const le = g.layer?.element;
		const c = { x: 10, y: 10 };
		/** @type {(e: MouseEvent) => void} */
		const onmousemove = e => {
			if (!le) return;
			/** @type {(val: number, min: number, max: number) => number} */
			const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
			const x = clamp(this.element.offsetLeft + e.clientX - c.x, 10, le.clientWidth - this.element.clientWidth - 10);
			const y = clamp(this.element.offsetTop + e.clientY - c.y, 10, le.clientHeight - this.element.clientHeight - 10);
			this.move(x, y);
			c.x = e.clientX, c.y = e.clientY;
		};
		const onmouseup = () => {
			top?.removeEventListener('mousemove', onmousemove);
			top?.removeEventListener('mouseup', onmouseup);
			window.removeEventListener('mouseup', onmouseup);
		};
		this.element.addEventListener('mousedown', e => {
			if (['INPUT', 'TEXTAREA', 'SELECT'].includes(/** @type {HTMLElement} */ (e.target)?.tagName)) return;
			c.x = e.clientX, c.y = e.clientY;
			top?.addEventListener('mousemove', onmousemove, { passive: true });
			top?.addEventListener('mouseup', onmouseup, { passive: true });
			window.addEventListener('mouseup', onmouseup, { passive: true });
		}, { passive: true });

		this.form = document.createElement('form');
		const changeTab = e => {
			buttons.forEach(b => {
				b.setAttribute('aria-selected', 'false');
			});
			e.target?.setAttribute('aria-selected', 'true');
			fields.forEach(f => {
				f.hidden = true;
			});
			const id = e.target.getAttribute('aria-controls');
			const f = this.form.querySelector(`#${id}`);
			if (f) /** @type {HTMLElement} */ (f).hidden = false;
		};
		const tablist = document.createElement('div');
		tablist.setAttribute('role', 'tablist');
		const buttons = ['displayTab', 'byTypeTab', 'mutedWordsTab'].map((s, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'ytp-button';
			b.id = `yt-lcf-panel-tabbutton-${i}`;
			b.setAttribute('role', 'tab');
			b.setAttribute('aria-controls', `yt-lcf-panel-tabpanel-${i}`);
			b.setAttribute('aria-selected', (!Boolean(i)).toString());
			b.textContent = getMessage(s);
			b.addEventListener('click', changeTab);
			return b;
		});
		tablist.append(...buttons);

		const fields = Array.from({ length: 3 }, (_, i) => {
			const f = document.createElement('fieldset');
			f.className = 'ytp-sfn-content';
			f.id = `yt-lcf-panel-tabpanel-${i}`;
			f.setAttribute('role', 'tabpanel');
			f.setAttribute('aria-labelledby', `yt-lcf-panel-tabbutton-${i}`);
			f.hidden = Boolean(i);
			return f;
		});
		const svg = `<svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg>`;
		fields[0].innerHTML = [
			`<div><div>${getMessage('animationDuration')}</div><div><label><input type="number" class="styles" name="animation_duration" min="1" step="0.1" size="5" value="${(parseFloat(g.storage.styles.animation_duration) || 8).toFixed(1)}" data-unit="s">s</label> /<input type="checkbox" name="speed"><label><input type="number" name="px_per_sec" min="1" size="8" value="${g.storage.others.px_per_sec || 160}" data-unit="px/s"><span>px/s</span></label></div></div>`,
			`<div><div>${getMessage('fontSize')}</div><div><label><input type="number" class="styles" name="font_size" min="12" size="5" value="${parseInt(g.storage.styles.font_size) || 36}" data-unit="px">px</label> /<input type="checkbox" name="lines"><label><input type="number" name="number_of_lines" min="6" size="5" value="${g.storage.others.number_of_lines || 20}"><span>${getMessage('lines')}</span></label><select name="type_of_lines">${Object.values(g.index.lines).map(v => `<option value="${v}">` + getMessage(`typeOfLines_${v}`)).join('')}</select><span>▼</span></div></div>`,
			`<div><div>${getMessage('lineHeight')}</div><div><input type="number" class="styles" name="line_height" min="1" step="0.05" value="${g.storage.styles.line_height || 1.25}"></div></div>`,
			`<div><div>${getMessage('fontFamily')} / ${getMessage('fontWeight')}</div><div><input type="text" class="styles" name="font_family" value="${escapeHtml(g.storage.styles.font_family) || 'inherit'}"> / <input type="number" class="styles" name="font_weight" min="100" max="900" step="100" size="8" value="${g.storage.styles.font_weight || '500'}"></div></div>`,
			`<div><div>${getMessage('strokeStyle')}</div><div><label><input type="color" name="stroke_color" value="${g.storage.styles.stroke_color || '#000000'}"></label> / <label>${getMessage('strokeOffset')}<input type="number" name="stroke_offset" min="0" size="5" value="${parseInt(g.storage.styles.stroke_offset) || 1}" data-unit="px">px</label> / <label>${getMessage('strokeBlur')}<input type="number" name="strolke_blur" min="0" size="5" value="${parseInt(g.storage.styles.stroke_blur) || 0}" data-unit="px">px</label></div></div>`,
			`<div><div>${getMessage('layerOpacity')}</div><div>${getMessage('opacity_0')}<input type="range" class="styles" name="layer_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.layer_opacity) || 1}">${getMessage('opacity_1')}</div></div>`,
			`<div><div>${getMessage('backgroundOpacity')}</div><div>${getMessage('opacity_0')}<input type="range" class="styles" name="background_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.background_opacity) || 0.5}">${getMessage('opacity_1')}</div></div>`,
			`<div><div>${getMessage('maxWidth')}/${getMessage('wordWrap')}</div><div><label><input type="number" class="styles" name="max_width" min="50" size="8" value="${parseInt(g.storage.styles.max_width) || 100}" data-unit="%"><span>%</span></label> /<select name="wrap">${Object.values(g.index.wrap).map(v => `<option value="${v}">` + getMessage(`wordWrap_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${getMessage('displayLimit')}</div><div><input type="number" class="others" name="limit_number" min="1" size="8" value="${g.storage.others.limit || 100}"><label><input type="checkbox" name="unlimited">${getMessage('unlimited')}</label></div></div>`,
			`<div><div>${getMessage('simultaneousMessage')}</div><div><select name="simultaneous">${Object.values(g.index.simultaneous).map(v => `<option value="${v}">` + getMessage(`simultaneousMessage_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${getMessage('emojiExpression')}</div><div><select name="emoji">${Object.values(g.index.emoji).map(v => `<option value="${v}">` + getMessage(`emojiExpression_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${getMessage('commonCSS')}</div><div><input type="text" name="_css" placeholder="${getMessage('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['div'])}" style="width:20.5em"></div></div>`,
			`<div><div>${getMessage('translation')}</div><div><select name="translation" title="${getMessage('addableByFirefoxLanguageSettings')}"><option value="0">${getMessage('disabled')}${navigator.languages.map((lang, i) => `<option value="${i + 1}">` + lang).join('')}</select>▼ /<label><input type="checkbox" name="prefix_lang"><span>${getMessage('prefixOriginalLanguage')}</span></label><br><span>${getMessage('exception')}</span>${navigator.languages.map((lang, i) => `<label><input type="checkbox" name="except_lang" value="${i}"><span>${lang}</span></label>`).join('')}</div><div></div></div>`,
			`<div><div>${getMessage('hotkey')}</div><div><label><span>${getMessage('hotkey_layer')}</span><input type="text" name="hotkey_layer" pattern="^.?$" size="3" value="${g.storage.hotkeys.layer}"></label> / <label><span>${getMessage('hotkey_panel')}</span><input type="text" name="hotkey_panel" pattern="^.?$" size="3" value="${g.storage.hotkeys.panel}"></label></div></div>`,
		].join('');
		fields[1].innerHTML = [
			...['normal', 'member', 'moderator', 'owner', 'verified', 'you'].map(type => `<div><div>${getMessage(type)}</div><div><div><div><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="${type}_display" value="photo"><svg viewBox="-8 -8 16 16"><g id="yt-lcf-photo"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></g></svg></label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="${type}_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle body" title="${getMessage('tooltip_chatMessage')}"><input type="checkbox" name="${type}_display" value="message"><span>${getMessage('display_chatMessage')}</span></label></div><div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="${type}_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="${type}_color"></div></div><input type="text" name="${type}_css" placeholder="${getMessage('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.' + type])}"></div></div>`),
			`<div><div>${getMessage('superchat')}</div><div><div><div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="paid_message_display" value="photo">${svg}</label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="paid_message_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle amount" title="${getMessage('tooltip_purchaseAmount')}"><input type="checkbox" name="paid_message_display" value="amount"><span>${getMessage('display_purchaseAmount')}</span></label><br><label class="toggle body" title="${getMessage('tooltip_chatMessage')}"><input type="checkbox" name="paid_message_display" value="message"><span>${getMessage('display_chatMessage')}</span></label></div><div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="paid_message_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="paid_message_color"></div></div><input type="text" name="paid_message_css" placeholder="${getMessage('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.paid_message'])}"></div></div>`,
			`<div><div>${getMessage('sticker')}</div><div><div><div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="paid_sticker_display" value="photo">${svg}</label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="paid_sticker_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle amount" title="${getMessage('tooltip_purchaseAmount')}"><input type="checkbox" name="paid_sticker_display" value="amount"><span>${getMessage('display_purchaseAmount')}</span></label><br><label class="toggle body" title="${getMessage('tooltip_sticker')}"><input type="checkbox" name="paid_sticker_display" value="sticker"><span>${getMessage('display_sticker')}</span></label></div><div><label title="${getMessage('tooltip_stickerSize')}" style="padding:0 0 0 4px">${getMessage('display_stickerSize')}: x<input type="number" class="styles" name="sticker_size" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.sticker_size) || 2}" data-unit="em"></label></div></div></div></div>`,
			`<div><div>${getMessage('membership')}</div><div><div><div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="membership_display" value="photo">${svg}</label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="membership_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle body" title="${getMessage('tooltip_membershipMessage')}"><input type="checkbox" name="membership_display" value="message"><span>${getMessage('display_membershipMessage')}</span></label></div><div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="membership_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="membership_color"></div></div><input type="text" name="membership_css" placeholder="${getMessage('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.membership'])}"></div></div>`,
			`<div><div>${getMessage('milestone')}</div><div><div><div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="milestone_display" value="photo">${svg}</label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="milestone_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle amount" title="${getMessage('tooltip_milestoneMonths')}"><input type="checkbox" name="milestone_display" value="months"><span>${getMessage('display_milestoneMonths')}</span></label><br><label class="toggle body" title="${getMessage('tooltip_chatMessage')}"><input type="checkbox" name="milestone_display" value="message"><span>${getMessage('display_chatMessage')}</span></label></div><div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="milestone_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="milestone_color"></div></div><input type="text" name="milestone_css" placeholder="${getMessage('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.milestone'])}"></div></div>`,
		].join('');
		fields[2].innerHTML = [
			`<div><div>${getMessage('mutedWordsMode')}</div><div><select name="muted_words_mode">${Object.values(g.index.mutedWords).map(v => `<option value="${v}">` + getMessage(`mutedWordsMode_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${getMessage('mutedWordsReplacement')}</div><div><input type="text" name="muted_words_replacement" placeholder="${getMessage('placeholder_mutedWordsReplacement')}" style="width:20.5em" value="${g.storage.mutedWords.replacement}" title="${g.storage.mutedWords.mode === g.index.mutedWords.char ? getMessage('tooltip_mutedWordsReplacement') : ''}"></div></div>`,
			`<div><div>${getMessage('mutedWordsGrammer')}</div><div><label><input type="checkbox" name="muted_words_regexp"><span>${getMessage('regexp')}</span></label></div></div>`,
			`<textarea name="muted_words_list" rows="20" placeholder="${getMessage('placeholder_mutedWordsList')}" style="width:32em">${g.storage.mutedWords.plainList.join('\n')}</textarea>`
		].join('');
		this.form.append(tablist, ...fields);

		const selects = this.form.querySelectorAll('select');
		for (const select of selects) {
			if (select.name in g.storage.others) {
				/** @type {number} */
				const val = g.storage.others[select.name];
				select.selectedIndex = Math.abs(val);
				if (le) switch (select.name) {
					case 'emoji': {
						le.dataset.emoji = Object.keys(g.index.emoji)[val];
						break;
					}
					case 'wrap': {
						le.style.setProperty('--yt-lcf-message-hyphens', g.array.hyphens[val]);
						le.style.setProperty('--yt-lcf-message-word-break', g.array.wordBreak[val]);
						le.style.setProperty('--yt-lcf-message-white-space', g.array.whiteSpace[val]);
						le.style.setProperty('--yt-lcf-max-width', g.storage.styles.max_width);
						break;
					}
				}
			} else if (select.name === 'muted_words_mode') {
				select.selectedIndex = g.storage.mutedWords.mode;
			}
		}
		const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (this.form.querySelectorAll('input[type="checkbox"]'));
		for (const cb of checkboxes) {
			const match = cb.name.match(/^(.+)_display$/);
			if (match) {
				const [_, type] = match;
				if (type in g.storage.parts) {
					cb.checked = g.storage.parts[type][cb.value];
					switch (cb.value) {
						case 'name': {
							const div = /** @type {HTMLDivElement} */ (cb.closest('div'));
							if (cb.checked) div.classList.add('outlined');
							cb.addEventListener('change', e => {
								const method = cb.checked ? 'add' : 'remove';
								div.classList[method]('outlined');
								le?.classList[method](`has-${type}-name`);
							}, { passive: true });
							break;
						}
						case 'color': {
							const picker = /** @type {HTMLInputElement?} */ (cb.parentElement?.nextElementSibling);
							if (picker) {
								const saved = g.storage.parts[type].color;
								if (saved) {
									picker.value = saved;
								} else if (le) {
									picker.value = formatHexColor(getComputedStyle(le).getPropertyValue('--yt-lcf-' + picker.name.replace(/_/g, '-')));
								}
							}
							break;
						}
					}
				}
			} else {
				switch (cb.name) {
					case 'speed': {
						cb.checked = g.storage.others.px_per_sec > 0;
						this.form.animation_duration.disabled = cb.checked;
						this.form.px_per_sec.disabled = !cb.checked;
						break;
					}
					case 'lines': {
						cb.checked = g.storage.others.number_of_lines > 0;
						this.form.font_size.disabled = cb.checked;
						this.form.number_of_lines.disabled = this.form.type_of_lines.disabled = !cb.checked;
						break;
					}
					case 'unlimited': {
						this.form.limit_number.disabled = cb.checked = g.storage.others.limit === 0;
						if (g.layer) g.layer.limit = g.storage.others.limit;
						break;
					}
					case 'prefix_lang': {
						cb.checked = g.storage.others.translation < 0;
						cb.disabled = this.form.translation.selectedIndex === 0;
						le?.classList[cb.checked ? 'add' : 'remove'](cb.name);
						break;
					}
					case 'except_lang': {
						const val = parseInt(cb.value);
						cb.checked = g.storage.others.except_lang & 1 << val ? true : false;
						const abs = Math.abs(g.storage.others.translation);
						cb.disabled = abs === 0 || abs === val + 1;
						break;
					}
					case 'muted_words_regexp': {
						cb.checked = g.storage.mutedWords.regexp;
						break;
					}
				}
			}
		}
		this.form.addEventListener('change', e => {
			if (!this.form.reportValidity()) return;
			const elem = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
			this.updateStorage(elem);
		}, { passive: true });

		const closeBtn = document.createElement('button');
		closeBtn.className = 'ytp-sfn-close ytp-button';
		closeBtn.title = getMessage('close');
		closeBtn.textContent = '[X]';
		closeBtn.addEventListener('click', () => {
			this.hide();
		}, { passive: true });
		this.element.insertAdjacentElement('beforeend', closeBtn);
		this.element.insertAdjacentElement('beforeend', this.form);
		this.element.addEventListener('keydown', e => {
			e.stopPropagation();
		}, { passive: true });
	}
	hide() {
		this.element.hidden = true;
		this.element.ariaHidden = 'true';
		this.element.style.display = 'none';
	}
	show() {
		this.element.hidden = false;
		this.element.ariaHidden = 'false';
		this.element.style.display = 'block';
	}
	/** @param elem {HTMLInputElement | HTMLSelectElement}  */
	updateStorage(elem) {
		const name = elem.name;
		const le = g.layer?.element;
		if (elem.tagName === 'SELECT' || elem instanceof HTMLSelectElement) {
			if (name in g.storage.others) {
				const val = parseInt(elem.value);
				if (name === 'translation') {
					const prefix = this.form.prefix_lang;
					prefix.disabled = val === 0;
					g.storage.others[name] = val * (prefix.checked ? -1 : 1);
					/** @type {NodeListOf<HTMLInputElement>} */
					const cb = this.form.except_lang;
					if (val) {
						const i = Math.abs(val) - 1;
						cb[i].checked = true;
						cb.forEach((e, _i) => e.disabled = _i === i);
						g.storage.others.except_lang |= 1 << i;
					} else {
						cb.forEach(e => e.disabled = true);
					}
				} else {
					g.storage.others[name] = val;
				}
				if (le) switch (name) {
					case 'emoji': {
						le.dataset.emoji = Object.keys(g.index.emoji)[val];
						updateCurrentItemStyle();
						break;
					}
					case 'wrap': {
						le.style.setProperty('--yt-lcf-message-hyphens', g.array.hyphens[val]);
						le.style.setProperty('--yt-lcf-message-word-break', g.array.wordBreak[val]);
						le.style.setProperty('--yt-lcf-message-white-space', g.array.whiteSpace[val]);
						le.style.setProperty('--yt-lcf-max-width', g.storage.styles.max_width);
						updateCurrentItemStyle();
						break;
					}
				}
			} else if (name === 'muted_words_mode') {
				const mode = parseInt(elem.value);
				g.storage.mutedWords.mode = mode;
				const replacement = this.form.elements['muted_words_replacement'];
				if (mode === g.index.mutedWords.char) {
					replacement.title = getMessage('tooltip_mutedWordsReplacement');
				} else {
					delete replacement.title;
				}
			}
		} else if (elem.classList.contains('styles') && name) {
			g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
			if (le) {
				switch (name) {
					case 'animation_duration': {
						const speed = le.getBoundingClientRect().width / elem.valueAsNumber;
						this.form.px_per_sec.valueAsNumber = Math.round(speed);
						break;
					}
					case 'max_width': updateCurrentItemStyle();
				}
				le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-'), g.storage.styles[name]);
			}
		} else if (name.startsWith('stroke_')) {
			g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
			le?.style.setProperty(name.replace('stroke_', '--yt-lcf-stroke-'), g.storage.styles[name]);
		} else if (name.endsWith('_display')) {
			const match = name.match(/^(.+)_display$/);
			if (match) {
				const [_, type] = match;
				if (type in g.storage.parts && le) {
					if (elem.value !== 'color') {
						g.storage.parts[type][elem.value] = elem.checked;
						le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-') + '-' + elem.value, elem.checked ? 'inherit' : 'none');
					} else {
						if (elem.checked) {
							g.storage.parts[type].color = this.form.elements[type + '_color']?.value;
							le.style.setProperty('--yt-lcf-' + type.replace(/_/g, '-') + '-color', g.storage.parts[type].color || 'inherit');
						} else {
							g.storage.parts[type].color = null;
							le.style.removeProperty('--yt-lcf-' + type.replace(/_/g, '-') + '-color');
						}
					}
					updateCurrentItemStyle(type);
				}
			}
		} else if (name.endsWith('_color')) {
			const match = name.match(/^(.+)_color$/);
			if (match) {
				const [_, type] = match;
				if (/** @type {HTMLInputElement?} */ (elem.previousElementSibling?.firstElementChild)?.checked) {
					g.storage.parts[type].color = this.form.elements[type + '_color']?.value;
					le?.style.setProperty('--yt-lcf-' + type.replace('_', '-') + '-color', g.storage.parts[type].color || 'inherit');
				} else {
					g.storage.parts[type].color = null;
					le?.style.removeProperty('--yt-lcf-' + type.replace('_', '-') + '-color');
				}
			}
		} else if (name.endsWith('_css')) {
			const match = name.match(/^(.*)_css$/);
			if (match) {
				const [_, type] = match;
				const selector = type ? '.' + type : 'div';
				g.storage.cssTexts[selector] = this.form.elements[type + '_css']?.value || '';
				const style = le?.shadowRoot?.querySelector('#customcss');
				if (style) {
					const rule = new RegExp(`:host>${selector.replace('.', '\\.')}{.*?}`);
					style.textContent = (style.textContent || '').replace(rule, `:host>${selector}{${g.storage.cssTexts[selector]}}`);
				}
			}
		} else if (name === 'prefix_lang') {
			const checked = this.form[name].checked;
			const val = g.storage.others.translation;
			g.storage.others.translation = Math.abs(val) * (checked ? -1 : 1);
			le?.classList[checked ? 'add' : 'remove']('prefix_lang');
			updateCurrentItemStyle();
		} else if (name === 'except_lang') {
			/** @type {NodeListOf<HTMLInputElement>} */
			const list = this.form[name];
			g.storage.others[name] = Array.from(list).map((l) => Number(l.checked)).reduce((a, c, i) => a + (c << i), 0);
		} else if (name.startsWith('hotkey_')) {
			const match = name.match(/^hotkey_(.*)$/);
			if (match) {
				const [_, type] = match;
				g.storage.hotkeys[type] = elem.value;
			}
		} else if (name.startsWith('muted_words_')) {
			switch (name) {
				case 'muted_words_replacement': {
					g.storage.mutedWords.replacement = elem.value;
					break;
				}
				default: {
					g.storage.mutedWords.regexp = this.form.elements['muted_words_regexp'].checked;
					g.storage.mutedWords.plainList = this.form.elements['muted_words_list'].value.split(/\n+/).filter(s => s.length > 0);
					updateMutedWordsList();
				}	
			}
		}
		if (['speed', 'px_per_sec'].includes(name)) {
			const checked = this.form.speed.checked;
			this.form.animation_duration.disabled = checked;
			this.form.px_per_sec.disabled = !checked;
			g.storage.others.px_per_sec = checked ? this.form.px_per_sec.valueAsNumber : 0;
			if (g.layer) g.layer.resetAnimationDuration();
		} else if (['lines', 'number_of_lines', 'type_of_lines'].includes(name)) {
			const checked = this.form.lines.checked;
			this.form.font_size.disabled = checked;
			this.form.number_of_lines.disabled = !checked;
			this.form.type_of_lines.disabled = !checked;
			g.storage.others.number_of_lines = checked ? this.form.number_of_lines.valueAsNumber : 0;
			if (g.layer) g.layer.resetFontSize();
		} else if (['unlimited', 'limit_number'].includes(name)) {
			const checked = this.form.unlimited.checked;
			this.form.limit_number.disabled = checked;
			g.storage.others.limit = checked ? 0 : this.form.limit_number.valueAsNumber;
			if (g.layer) g.layer.limit = g.storage.others.limit;
		}
		browser.storage.local.set(g.storage);
	}
	/** @type {(x: number, y: number) => void} */
	move(x, y) {
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}
}

detectPageType();
window.addEventListener('yt-navigate-finish', detectPageType, { passive: true });
window.addEventListener('resize', e => {
	if (!g.layer) return;
	const le = g.layer.element;
	if (g.panel) g.panel.move(10, 10);
	const speed = g.storage.others.px_per_sec;
	if (speed) {
		const durationBySpeed = le.getBoundingClientRect().width / speed;
		le.style.setProperty('--yt-lcf-animation-duration', durationBySpeed.toFixed(1) + 's');
		/** @type {?HTMLInputElement | undefined} */
		const input = g.app?.querySelector('#' + g.tag.panel + ' [name="animation_duration"]');
		if (input) input.value = durationBySpeed.toFixed(1);
	}
	const lines = g.storage.others.number_of_lines;
	if (lines) {
		const sizeByLines = Math.floor(le.getBoundingClientRect().height * .8 / lines);
		le.style.setProperty('--yt-lcf-font-size', [
			`${sizeByLines}px`,
			`max(${g.storage.styles.font_size}, ${sizeByLines}px)`,
			`min(${g.storage.styles.font_size}, ${sizeByLines}px)`,
		][g.storage.others.type_of_lines]);
	}
	updateCurrentItemStyle();
}, { passive: true });

function detectPageType() {
	switch (location.pathname) {
		case '/live_chat':
		case '/live_chat_replay': if (top?.location.pathname === '/watch') {
			g.app = top.document.querySelector('#ytd-player');
			if (g.app) {
				startLiveChatFlusher();
				const storageList = ['styles', 'others', 'parts', 'cssTexts', 'hotkeys', 'mutedWords'];
				browser.storage.local.get(storageList).then(storage => {
					for (const type of storageList) {
						if (storage && storage[type]) {
							for (const [key, value] of Object.entries(storage[type])){
								g.storage[type][key] = value;
							}
						}
					}
					updateMutedWordsList();
					if (g.layer) {
						const le = g.layer.element;
						for (const [prop, value] of Object.entries(g.storage.styles)) {
							le.style.setProperty('--yt-lcf-' + prop.replace(/_/g, '-'), value);
						}
						const lines = g.storage.others.number_of_lines;
						if (lines) {
							const sizeByLines = Math.floor(le.getBoundingClientRect().height * .8 / lines);
							if (g.storage.others.type_of_lines > 0) {
								le.style.setProperty('--yt-lcf-font-size', `max(${g.storage.styles.font_size}, ${sizeByLines}px)`);
							} else {
								le.style.setProperty('--yt-lcf-font-size', `${sizeByLines}px`);
							}
						}
						for (const [key, values] of Object.entries(g.storage.parts)) {
							for (const [prop, bool] of Object.entries(values)) {
								switch (prop) {
									case 'color': {
										if (bool) {
											le.style.setProperty(`--yt-lcf-${key.replace(/_/g, '-')}-color`, `${bool}`);
										} else {
											le.style.removeProperty(`--yt-lcf-${key.replace(/_/g, '-')}-color`);
										}
										break;
									}
									case 'name': le.classList[bool ? 'add' : 'remove'](`has-${key}-name`);
									default: le.style.setProperty(`--yt-lcf-${key.replace(/_/g, '-')}-display-${prop}`, bool ? 'inline' : 'none');
								}
							}
						}
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
						const style = le.shadowRoot?.querySelector('style');
						if (style) style.textContent = Object.entries(g.storage.cssTexts).map(([selector, css]) => `:host>${selector}{${css}}`).join('');
					}
				}).then(() => {
					addSettingMenu();
					top?.document.body.addEventListener('keydown', e => {
						if (!e.repeat) switch (e.key) {
							case g.storage.hotkeys.layer: {
								const checkbox = /** @type {HTMLElement?} */ (g.app?.querySelector('#' + g.tag.checkbox));
								checkbox?.click();
								break;
							}
							case g.storage.hotkeys.panel: {
								const popupmenu = /** @type {HTMLElement?} */ (g.app?.querySelector('#' + g.tag.popupmenu));
								popupmenu?.click();
								break;
							}
						}
					}, { passive: true });
				});
			}
		}
		break;
		case '/watch': {
			document.addEventListener('yt-action', e => {
				switch (e.detail?.actionName) {
					case 'ytd-watch-player-data-changed': {
						/** @type {HTMLDivElement?} */
						const layer = document.querySelector('#' + g.tag.layer);
						if (layer) new LiveChatLayer(layer).init();
						/** @type {HTMLDivElement?} */
						const panel = document.querySelector('#' + g.tag.panel);
						if (panel) new LiveChatPanel(panel).hide();
					}
				}
			}, { passive: true });
		}
		break;
	}
}

function getLayer() {
	const layer = new LiveChatLayer();
	layer.element.addEventListener('contextmenu', e => {
		const origin = /** @type {HTMLElement?} */ (e.composedPath().find(p => 'id' in p));
		if (origin) {
			e.preventDefault();
			e.stopPropagation();
			origin.classList.toggle('paused');
		}
	}, { passive: false });
	layer.element.addEventListener('click', e => {
		const origin = /** @type {HTMLElement?} */ (e.composedPath()[0]);
		if (origin?.tagName === 'A') {
			e.stopPropagation();
		} else {
			/** @type {HTMLElement?} */ (e.target)?.parentElement?.click();
		}
	}, { passive: true });
	layer.element.addEventListener('wheel', e => {
		const origin = /** @type {HTMLElement?} */ (e.composedPath().find(p => 'id' in p));
		if (origin?.classList.contains('paused')) {
			e.preventDefault();
			e.stopPropagation();
			origin.style.animationDelay = `${parseFloat(origin.style.animationDelay || '0') + Math.sign(e.deltaY) * .05}s`;
		}
	}, { passive: false });
	return layer;
}

function skipRenderingOnce() {
	g.skip = true;
}
function initLayer() {
	g.layer?.init();
}

function startLiveChatFlusher() {
	if (!g.app) return;
	const video = g.app.querySelector('video');
	const videoContainer = video?.parentElement;
	
	if (video && videoContainer) {
		const current = g.app.querySelector('#' + g.tag.layer);
		if (current) current.remove();
		g.layer = getLayer();
		videoContainer.insertAdjacentElement('afterend', g.layer.element);
		
		const timer = setInterval(() => {
			const /** @type {HTMLElement?} */ renderer = document.querySelector(g.tag.chat);
			if (renderer) {
				clearInterval(timer);
				renderer.addEventListener('yt-action', handleYtAction, { passive: true });
				renderer.addEventListener('yt-load-reload-continuation', skipRenderingOnce, { passive: true });
			}
		}, 1000);

		fetch('/account_advanced').then(r => r.text()).then(t => {
			const m = t.match(/"(UC[\w-]{22})"/);
			if (m) g.channel = m[1] || '';
			if (g.channel) {
				const style = g.layer?.element.shadowRoot?.querySelector('#yourcss');
				if (style) {
					const you = `[data-author-id="${g.channel}"]`;
					style.textContent = `${you}{color:var(--yt-lcf-you-color)}:host(.has-you-name) ${you}.text{background-color:var(--yt-live-chat-you-message-background-color);border-radius:.5em;padding:0 .25em}${you}.text .photo{display:var(--yt-lcf-you-display-photo)}${you}.text .name{display:var(--yt-lcf-you-display-name)}${you}.text .message{display:var(--yt-lcf-you-display-message)}`;
				}
			}
		});
	}
}

function addSettingMenu() {
	if (!g.app) return;
	/** @type {HTMLDivElement?} */
	const current = g.app.querySelector('#' + g.tag.panel);
	if (current) current.remove();
	const panel = new LiveChatPanel();
	g.panel = panel;
	const attrs = [
		{
			id: g.tag.checkbox,
			role: 'menuitemcheckbox',
			'aria-checked': 'true',
		},
		{
			id: g.tag.popupmenu,
			role: 'menuitem',
			'aria-haspopup': 'true',
		}
	];
	const htmls = [
		`<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -40 80 80"><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0M0,-24Q8,-24,24,-23,31,-22,31,-19,32,-12,32,0" fill="none" stroke="white" stroke-width="3"/><g fill="white" transform="translate(0,10)"><path d="M4,-10l12,12h8l-12,-12,12,-12h-8z"/><circle r="3"/><circle cx="-10" r="3"/><circle cx="-20" r="3"/></g></svg></div><div class="ytp-menuitem-label">${getMessage('ytp_menuitem_label_switch')}</div><div class="ytp-menuitem-content"><div class="ytp-menuitem-toggle-checkbox"></div></div></div>`,
		`<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -64 108 108"><mask id="m"><path d="M-40-80h120v120h-120z" fill="white" /><circle r="9"/></mask><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0" fill="none" stroke="white" stroke-width="4"/><g fill="white" transform="translate(0,10)"><circle cx="8" r="3"/><circle cx="-4" r="3"/><circle cx="-16" r="3"/><g transform="translate(32,-32) scale(1.25)" mask="url(#m)"><path id="p" d="M0,0L-10,-8L-6,-24Q0,-26,6,-24L10,-8L-10,8L-6,24Q0,26,6,24L10,8z"/><use xlink:href="#p" transform="rotate(60)"/><use xlink:href="#p" transform="rotate(120)"/></g></g></svg></div><div class="ytp-menuitem-label">${getMessage('ytp_menuitem_label_config')}</div><div class="ytp-menuitem-content"></div>`,
	];
	/** @type { { [K in keyof GlobalEventHandlersEventMap]?: (ev: GlobalEventHandlersEventMap[K]) => void }[]} */
	const events = [
		{
			click: e => {
				const cb = /** @type {HTMLElement?} */ (e.currentTarget);
				if (cb) {
					const checked = cb.getAttribute('aria-checked') === 'true';
					cb.setAttribute('aria-checked', (!checked).toString());
					initLayer();
					g.layer?.[checked ? 'hide' : 'show']();
				}
			},
		},
		{
			click: _ => {
				panel[panel.element.hidden ? 'show' : 'hide']();
			},
		}
	];
	/** @type {HTMLElement?} */
	const ytpPanelMenu = g.app.querySelector('.ytp-settings-menu .ytp-panel-menu');
	if (ytpPanelMenu) {
		const div = document.createElement('div');
		div.className = 'ytp-menuitem';
		div.tabIndex = 0;
		attrs.forEach((attr, i) => {
			g.app?.querySelector('#' + attr.id)?.remove();
			const menuitem = div.cloneNode();
			for (const [k, v] of Object.entries(attr)) menuitem.setAttribute(k, v);
			menuitem.innerHTML = htmls[i];
			// @ts-ignore
			for (const [k, v] of Object.entries(events[i])) menuitem.addEventListener(k, v, { passive: true });
			ytpPanelMenu.appendChild(menuitem);
		});
	}
	g.layer?.element.insertAdjacentElement('afterend', panel.element);
}

/** @param {string | undefined} type */
function updateCurrentItemStyle(type = undefined) {
	if (!g.layer) return;
	const children = g.layer.element.shadowRoot?.children;
	if (children) {
		const items = Array.from(children).filter(type ? c => c.classList.contains(type) : c => c.tagName === 'DIV');
		/** @type {HTMLElement[]} */ (items).forEach(updateCurrentItem);
	}
}

/** @param {HTMLElement} item */
function updateCurrentItem(item) {
	if (!g.layer) return;
	const isLong = item.clientWidth >= g.layer.element.clientWidth * (parseInt(g.storage.styles.max_width) / 100 || 1);
	item.classList[isLong ? 'add' : 'remove']('wrap');
	item.style.setProperty('--yt-lcf-translate-x', `-${g.layer.element.clientWidth + item.clientWidth}px`);
}

function updateMutedWordsList() {
	const { regexp, plainList } = g.storage.mutedWords;
	if (regexp) {
		g.list.mutedWords = plainList.map(s => new RegExp(s, 'g'));
	} else {
		g.list.mutedWords = plainList.length > 0 ? [ new RegExp(plainList.map(escapeRegExp).join('|'), 'g') ] : [];
	}
	return g.list.mutedWords;
 }
 
/**
 * @param {CustomEvent<{ actionName: string, args: any[][] }>} e 
 */
function handleYtAction(e) {
	switch (e.detail?.actionName) {
		case 'yt-live-chat-actions': {
			if (!g.layer) return;
			const le = g.layer.element;
			const root = le.shadowRoot;
			if (!root || document.visibilityState === 'hidden' || le.hidden || le.parentElement?.classList.contains('paused-mode')) return;
			const actions = e.detail.args[0];
			const filtered = {
				add: actions.filter(a => 'addChatItemAction' in a),
				delete: actions.filter(a => 'markChatItemAsDeletedAction' in a),
				delete_author: actions.filter(a => 'markChatItemsByAuthorAsDeletedAction' in a),
				replace: actions.filter(a => 'replaceChatItemAction' in a),
			};
			if (g.skip && filtered.add.length > 0) {
				g.skip = false;
				return;
			}
	
			// Add
			const fs = parseInt(g.storage.styles.font_size) || 36, lhf = parseFloat(g.storage.styles.line_height) || 1.25, lh = fs * lhf;
			const sv = g.storage.others.simultaneous, si = g.index.simultaneous;
			const last = sv === si.last_merge ? /** @type {HTMLElement?} */ (root.lastElementChild) : null;
			const bodies = last ? [ `<!-- ${last.className} -->` + (last.dataset.text || '') ] : [];
			const ids = last ? [last.id] : [];
			if (sv === si.first) {
				const notext = filtered.add.slice(1).filter(a => !a.addChatItemAction.item.liveChatTextMessageRenderer);
				filtered.add.splice(1, Infinity, ...notext);
			}
			const adding = filtered.add.map(action => new Promise(async (resolve, reject) => {
				const elem = await parseChatItem(action.addChatItemAction.item);
				if (!g.layer || !root) return reject('No layer element');
				if (!elem) return resolve(elem);
				if (sv === si.merge || sv === si.last_merge) {
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
								updateCurrentItem(earlier);
							}
							return resolve(elem.id);
						}
					}
				}
				const duplication = root.getElementById(elem.id);
				if (duplication) {
					const type = elem.className.match(/text (.+)/)?.[1] || 'normal';
					const color = getComputedStyle(g.layer.element).getPropertyValue(`--yt-lcf-${type}-color`);
					console.log(`Message duplication #${elem.id}: %c${elem.dataset.text || elem.lastElementChild?.textContent}`, color ? 'color:' + color : '');
					return resolve(elem.id);
				}
				elem.addEventListener('animationend', e => {
					/** @type {HTMLElement} */ (e.target).remove();
				}, { passive: true });
				const children = Array.from(/** @type {HTMLCollectionOf<HTMLElement>} */ (root.children));
				root.appendChild(elem);
				const { clientHeight: ch, clientWidth: cw } = le;
				if (elem.clientWidth >= cw * (parseInt(g.storage.styles.max_width) / 100 || 1)) elem.classList.add('wrap');
				elem.style.setProperty('--yt-lcf-translate-x', `-${cw + elem.clientWidth}px`);
				const body = /** @type {HTMLElement?} */ (elem.lastElementChild);
				if (body) {
					const content = body.textContent;
					if (content) browser.i18n.detectLanguage(content).then(result => {
						if (result.isReliable) body.lang = result.languages?.[0].language;
					});
				}
				if (elem.clientHeight >= ch) {
					elem.style.top = '0px';
					elem.dataset.line = '0';
					return resolve(elem.id);
				}
				const overline = Math.ceil(ch / lh);
				let y = 0;
				do {
					if (children.length > 0) {
						elem.style.top = `${y * lhf}em`;
						elem.dataset.line = `${y}`;
						if (!children.some(before => isCatchable(before, elem)) && !isOverflow(le, elem)) return resolve(elem.id);
					} else {
						elem.style.top = '0px';
						elem.dataset.line = '0';
						return resolve(elem.id);
					}
				} while (y++ < overline);
				do {
					const tops = children.map(child => parseInt(child.dataset.line || '')).filter(v => !isNaN(v));
					const lines = new Array(y).fill(0);
					tops.forEach(v => {lines[v] += 1});
					let ln = -1, i = -1;
					do ln = lines.indexOf(++i);
					while (ln < 0);
					elem.style.top = `${ln * lhf}em`;
					elem.dataset.line = `${ln}`;
				} while (isOverflow(le, elem) && y-- > 0);
				return resolve(elem.id);
			}));
			
			// Delete
			const deleting = filtered.delete.map(action => new Promise((resolve, reject) => {
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
				const id = action.replaceChatItemAction.targetItemId;
				const target = root.getElementById(id);
				if (target) {
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
		break;
		case 'yt-live-chat-reload-success':
		case 'yt-live-chat-seek-success':
			skipRenderingOnce();
	}
}

/**
 * @param {LiveChat.AnyRenderer} item 
 */
async function parseChatItem(item) {
	const key = Object.keys(item)[0];
	const renderer = item[key];
	const elem = document.createElement('div');
	elem.id = renderer.id || '';
	elem.dataset.authorId = renderer.authorExternalChannelId;
	const name = getChatMessage(renderer.authorName);
	const author = name ? `<a href="/channel/${renderer.authorExternalChannelId}" target="_blank" title="${name}"><img class="photo" src="${renderer.authorPhoto.thumbnails[0].url}" loading="lazy"></a><span class="name">${name}</span>` : '';
	const msg = {
		orig: renderer.message ? getChatMessage(renderer.message, { filterMode: g.storage.mutedWords.mode }) : '',
		trans: '',
		src: '',
	};
	const index = g.storage.others.translation;
	const nl = navigator.languages;
	const tl = ['', ...nl][Math.abs(index)];
	const el = nl.filter((_, i) => g.storage.others.except_lang & 1 << i);
	if (tl && msg.orig) {
		const text = msg.orig.split(/(\s*<.*?>\s*)/).filter(s => s.length);
		msg.trans = await Promise.all(text.map(async q => {
			if (q.startsWith('<')) {
				return q;
			} else {
				const detection = await browser.i18n.detectLanguage(q);
				const sl = detection.languages[0]?.language;
				if (el.includes(sl)) {
					return q;
				} else {
					const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${detection.isReliable ? sl : 'auto'}&tl=${tl}&dt=t&dt=bd&dj=1&q=` + encodeURIComponent(q);
					/** @type { { sentences: { trans: string }[], src: string }? } */
					const json = await fetch(url).then(res => res.json());
					if (json && !el.includes(json.src)) {
						msg.src = json.src || '';
						return json.sentences.map(s => s.trans).join('') || '';
					} else {
						return q;
					}
				}
			}
		})).then(s => s.join(''));
		if (msg.src && msg.trans) msg.trans = `<span data-srclang="${msg.src}">${msg.trans}</span>`;
	}
	switch (key) {
		case 'liveChatTextMessageRenderer': {
			const authorType = getAuthorType(renderer);
			if (Object.values(g.storage.parts[authorType]).includes(true)) {
				elem.className = 'text ' + authorType;
				elem.innerHTML = `<span class="header">${author}</span><span class="body">${msg.trans || msg.orig}</span>`;
				elem.dataset.text = getChatMessage(renderer.message, { emoji: -1 });
			} else {
				return null;
			}
			break;
		}
		case 'liveChatMembershipItemRenderer': {
			const { headerPrimaryText: primary, headerSubtext: sub } = renderer;
			const messageType = primary ? 'milestone' : 'membership';
			elem.className = messageType;
			if (Object.values(g.storage.parts[messageType]).includes(true)) {
				elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))">${author}<span class="months">${getChatMessage(primary || sub, { start: primary ? 1 : 0 })}</span></div><div class="body" style="background-color:rgba(${getColorRGB(0xff0a8043).join()},var(--yt-lcf-background-opacity))">${msg.trans || msg.orig}</div>`;
			} else {
				return null;
			}
			break;
		}
		case 'liveChatPaidMessageRenderer': {
			if (Object.values(g.storage.parts.paid_message).includes(true)) {
				elem.className = 'superchat';
				elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.headerBackgroundColor).join()},var(--yt-lcf-background-opacity))">${author}<span class="amount">${getChatMessage(renderer.purchaseAmountText)}</span></div><div class="body" style="background-color:rgba(${getColorRGB(renderer.bodyBackgroundColor).join()},var(--yt-lcf-background-opacity))">${msg.trans || msg.orig}</div>`;
			} else {
				return null;
			}
			break;
		}
		case 'liveChatPaidStickerRenderer': {
			if (Object.values(g.storage.parts.paid_sticker).includes(true)) {
				elem.className = 'supersticker';
				elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.backgroundColor).join()},var(--yt-lcf-background-opacity))">${author}<span class="amount">${getChatMessage(renderer.purchaseAmountText)}</span></div><figure class="body" style="background-color:rgba(${getColorRGB(renderer.moneyChipBackgroundColor).join()},var(--yt-lcf-background-opacity)"><img class="sticker" src="${(renderer.sticker.thumbnails.find(t => 2 * 36 <= (t.width || 36)) || renderer.sticker.thumbnails[0]).url}" loading="lazy"></figure>`;
			} else {
				return null;
			}
			break;
		}
		case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer': {
			if (Object.values(g.storage.parts.membership).includes(true)) {
				elem.className = 'membership gift';
				const h = renderer.header.liveChatSponsorshipsHeaderRenderer;
				const name = getChatMessage(h.authorName);
				const author = name ? `<a href="/channel/${renderer.authorExternalChannelId}" target="_blank" title="${name}"><img class="photo" src="${h.authorPhoto.thumbnails[0].url}" loading="lazy"></a><span class="name">${name}</span>` : '';
				const icon = document.querySelector('iron-iconset-svg #gift-filled');
				const count = h.primaryText?.runs?.filter(r => !Number.isNaN(parseInt(r.text)))[0]?.text;
				if (count) {
					const gifts = (icon ? `<svg viewBox="0 2 24 24" fill="currentColor" stroke="#000" paint-order="stroke">${icon.innerHTML}</svg>` : '🎁') + count;
					elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))">${author}<span class="gifts">${gifts}</span></div>`;
				}
			} else {
				return null;
			}
			break;
		}
		case 'liveChatViewerEngagementMessageRenderer': {
			switch (renderer.icon.iconType) {
				case 'POLL': {
					elem.className = 'engagement-poll';
					elem.innerHTML = `<div class="body">${msg.trans || msg.orig}</div>`;
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
 * @param {LiveChat.RendererContent} renderer
 * @returns {'normal' | 'owner' | 'moderator' | 'member' | 'verified'}
 */
function getAuthorType(renderer) {
	/** @type { ['owner', 'moderator', 'member', 'verified'] } */
	const statuses = ['owner', 'moderator', 'member', 'verified'];
	const classes = renderer.authorBadges?.map(b => b.liveChatAuthorBadgeRenderer.customThumbnail ? 'member' : b.liveChatAuthorBadgeRenderer.icon?.iconType.toLowerCase() || '') || [];
	for (const s of statuses) if (classes.includes(s)) return s;
	return 'normal';
}

/**
 * @param { LiveChat.Runs | LiveChat.SimpleText | undefined } message
 * @param { { start?: number, end?: number, emoji?: number, filterMode?: number } } options
 */
function getChatMessage(message, options = {}) {
	if (message) {
		const { start, end, filterMode } = options;
		if ('runs' in message) {
			let rslt = '';
			const runs = start || end ? message.runs.slice(start, end) : message.runs;
			for (const r of runs) {
				if ('text' in r) {
					const filtered = filterMessage(r.text, filterMode);
					if (filtered.result && filterMode === g.index.mutedWords.all) break;
					let text = escapeHtml(filtered.value).replace(/\n/g, '<br>');
					if (r.italics) text = '<i>' + text + '</i>';
					if (r.bold) text = '<b>' + text + '</b>';
					if (r.navigationEndpoint) {
						const ep = r.navigationEndpoint.urlEndpoint || r.navigationEndpoint.watchEndpoint;
						if (ep) {
							const icon = document.querySelector('iron-iconset-svg #open_in_new');
							const href = 'url' in ep ? ep.url : (ep.videoId ? '/watch?v=' + ep.videoId : '');
							text = `<a class="open_in_new" href="${href}" target="_blank" title="${text}" rel="${ep.nofollow ? 'nofollow' : ''}"><svg viewBox="0 0 24 24" fill="currentColor" stroke="#000" paint-order="stroke">${icon?.innerHTML}</svg></a>`;
						}
					}
					rslt += text;
				} else {
					const emoji = options.emoji ?? g.storage.others.emoji;
					if (emoji < 0) {
						rslt += r.emoji.shortcuts?.[0] || r.emoji.emojiId || '';
					} else if (emoji) {
						let skip = false;
						if (filterMode) {
							const shortcuts = [...(r.emoji.shortcuts || [r.emoji.emojiId])];
							const plainList = g.storage.mutedWords.plainList;
							for (const rule of plainList) {
								const b = shortcuts.includes(rule);
								if (b) {
									skip = true;
									const replacement = g.storage.mutedWords.replacement;
									switch (filterMode) {
										case g.index.mutedWords.all: return '';
										case g.index.mutedWords.word: rslt += replacement; break;
										case g.index.mutedWords.char: rslt += [...replacement][0] || ''; break;
									}
									break;
								}
							}
						}
						if (!skip) {
							const thumbnail = r.emoji.image.thumbnails.slice(-1)[0];
							const img = thumbnail ? `<img src="${thumbnail.url}" alt="">` : r.emoji.emojiId;
							rslt += `<span class="emoji" data-label="${escapeHtml(r.emoji.image.accessibility.accessibilityData.label)}" data-shortcut="${escapeHtml(r.emoji.shortcuts?.[0] || '')}">${img}</span>`;
						}
					}
				}
			}
			return rslt;
		} else {
			const str = filterMessage(message.simpleText).value;
			return escapeHtml(start || end ? str.slice(start, end) : str);
		}
	} else {
		return '';
	}
}

/** @param {string} str */
function escapeHtml(str) {
	return str.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/** @param {string} str */
function escapeRegExp(str) {
	return str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {Element} before 
 * @param {Element} after 
 */
function isCatchable(before, after) {
	const sec = parseFloat(g.storage.styles.animation_duration) || 4;
	const [b, a] = [before, after].map(elm => elm.getBoundingClientRect());
	if (b.top <= a.top && a.top < b.bottom) {
		if (b.left <= a.left && a.left <= b.right) {
			return true;
		} else if (b.width >= a.width) {
			return false;
		} else {
			const [bSpeed, aSpeed] = [b, a].map(rect => rect.width / sec);
			const speedDiff = aSpeed - bSpeed;
			const posDiff = a.left - b.right;
			return posDiff / speedDiff < sec;
		}
	} else {
		return false;
	}
}

/**
 * @param {Element} parent 
 * @param {Element} child 
 */
function isOverflow(parent, child) {
	const p = parent.getBoundingClientRect();
	const c = child.getBoundingClientRect();
	return c.bottom > p.top + p.height;
}

/**
 * @param {string} str 
 * @param {number} [mode=0] 
 */
function filterMessage(str, mode = 0) {
	const list = g.list.mutedWords;
	const replacement = g.storage.mutedWords.replacement;
	let replaced = false;
	switch (mode) {
		case g.index.mutedWords.all: {
			for (const rule of list) {
				if (rule.test(str)) {
					return { value: '', result: true };
				}
			}
			break;
		}
		case g.index.mutedWords.word: {
			for (const rule of list) {
				if (rule.test(str)) {
					str = str.replace(rule, replacement);
					replaced = true;
				}
			}
			break;
		}
		case g.index.mutedWords.char: {
			const char = replacement ? [...replacement][0] : '';
			for (const rule of list) {
				if (rule.test(str)) {
					str = char ? str.replace(rule, m => {
						const len = [...m].length;
						return char.repeat(len);
					}) : str.replace(rule, '');
					replaced = true;
				}
			}
			break;
		}
	}
	return { value: str, result: replaced };
}

/**
 * @param {number} long
 */
function getColorRGB(long) {
	return (long.toString(16).match(/[0-9a-f]{2}/g) || []).map(hex => parseInt(hex, 16)).slice(1);
}

/**
 * @param {string} css 
 * @param {string} inherit 
 */
function formatHexColor(css, inherit = '#ffffff') {
	const color = css.trim();
	if (color.startsWith('#')) {
		if (color.length > 6) {
			return color.slice(0, 7);
		} else if (color.length > 3) {
			return color[0] + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
		}
	} else if (color.startsWith('rgb')) {
		const [_, r, g, b] = color.match(/(\d+),\s*(\d+),\s*(\d+)/) || [];
		if (_) {
			return '#' + [r, g, b].map(s => parseInt(s).toString(16).padStart(2, '0')).join('');
		}
	}
	return inherit;
}