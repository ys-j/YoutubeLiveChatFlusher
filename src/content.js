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
		maxWidth: ['', '', ''],
	},
	/** @type {'youtube-livechat-flusher'} */
	id: 'youtube-livechat-flusher',
	index: {
		/** @type { { fixed: 0, max: 1, min: 2 } } */
		lines: { fixed: 0, max: 1, min: 2 },
		/** @type { {  none: 0, normal: 1, auto: 2} } */
		wrap: { none: 0, normal: 1, auto: 2 },
		/** @type { { all: 0, first: 1, merge: 2, last_merge: 3 } } */
		simultaneous: { all: 0, first: 1, merge: 2, last_merge: 3 },
		/** @type { { none: 0, all: 1, label: 2, shortcut: 3 } } */
		emoji: { none: 0, all: 1, label: 2, shortcut: 3 },
	},
	/** @type {LiveChatLayerElement?} */
	layer: null,
	storage: {
		// default value
		styles: {
			animation_duration: '8s',
			font_size: '32px',
			layer_opacity: '1',
			background_opacity: '0.5',
			max_width: '100%',
			sticker_size: '3em',
		},
		others: {
			number_of_lines: 0,
			type_of_lines: 0,
			wrap: 1,
			limit: 0,
			simultaneous: 2,
			emoji: 1,
			translation: 0,
		},
		parts: {
			normal: { photo: false, name: false, message: true, color: '' },
			verified: { photo: true, name: true, message: true, color: '' },
			member: { photo: false, name: false, message: true, color: '' },
			moderator: { photo: true, name: true, message: true, color: '' },
			owner: { photo: true, name: true, message: true, color: '' },
			paid_message: { photo: true, name: true, amount: true, message: true, color: '' },
			paid_sticker: { photo: true, name: true, amount: true, sticker: true },
			membership: { photo: true, name: false, message: true, color: '' },
			milestone: { photo: true, name: true, months: true, message: true, color: '' },
		},
	},
	tag: {
		chat: 'yt-live-chat-renderer',
		layer: 'yt-live-chat-flusher-layer',
		panel: 'yt-live-chat-flusher-panel',
	}
};

const getMessage = browser.i18n.getMessage;

class LiveChatLayerElement extends HTMLElement {
	constructor() {
		super();
		/** @type {number} */
		this.limit = 0;
		this.hide = () => {
			this.hidden = true;
			this.ariaHidden = 'true';
			this.style.display = 'none';
			this.init();
		};
		this.show = () => {
			this.hidden = false;
			this.ariaHidden = 'false';
			this.style.display = 'block';
		};
		this.init = () => {
			const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
			root.innerHTML = '';
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = browser.runtime.getURL('layer.css');
			root.appendChild(link);
			const observer = new MutationObserver(() => {
				const over = root.childElementCount - (this.limit || Infinity);
				if (over > 0) {
					let i = 1;
					while (i++ < over) link.nextElementSibling?.remove();
				}
			});
			observer.observe(root, { childList: true });
			return this;
		};
	}
	connectedCallback() {
		this.dataset.layer = '1';
		this.setAttribute('role', 'marquee');
		this.setAttribute('aria-live', 'off');
		this.init();
	}
}
customElements.define(g.tag.layer, LiveChatLayerElement);

class LiveChatPanelElement extends HTMLElement {
	constructor() {
		super();
		this.hide = () => {
			this.hidden = true;
			this.ariaHidden = 'true';
			this.style.display = 'none';
		};
		this.show = () => {
			this.hidden = false;
			this.ariaHidden = 'false';
			this.style.display = 'block';
		};
	}
	connectedCallback() {
		this.className = 'html5-video-info-panel';
		this.dataset.layer = '4';
		this.innerHTML = '';
		this.hide();

		const form = document.createElement('form');
		form.className = 'html5-video-info-panel-content';
		form.innerHTML = [
			[
				`<div>${getMessage('animation_duration')}</div>`,
				`<div><label><input type="number" class="styles" name="animation_duration" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.animation_duration) || 6}" data-unit="s"> s</label></div>`,
			],
			[
				`<div>${getMessage('font_size')}</div>`,
				`<div><label><input type="number" class="styles" name="font_size" min="12" size="5" value="${parseInt(g.storage.styles.font_size) || 36}" data-unit="px"><span>px</span></label> /<input type="checkbox" name="lines"><label><input type="number" name="number_of_lines" min="6" size="5" value="${g.storage.others.number_of_lines || 20}"><span>${getMessage('lines')}</span></label><select name="type_of_lines">${Object.values(g.index.lines).map(v => `<option value="${v}">` + getMessage(`type_of_lines_${v}`)).join('')}</select><span>▼</span></div>`,
			],
			[
				`<div>${getMessage('layer_opacity')}</div>`,
				`<div>${getMessage('opacity_0')}<input type="range" class="styles" name="layer_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.layer_opacity) || 1}">${getMessage('opacity_1')}</div>`,
			],
			[
				`<div>${getMessage('background_opacity')}</div>`,
				`<div>${getMessage('opacity_0')}<input type="range" class="styles" name="background_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.background_opacity) || 0.5}">${getMessage('opacity_1')}</div>`,
			],
			[
				`<div>${getMessage('max_width')}/${getMessage('word_wrap')}</div>`,
				`<div><label><input type="number" class="styles" name="max_width" min="50" size="8" value="${parseInt(g.storage.styles.max_width) || 100}" data-unit="%"><span>%</span></label> /<select name="wrap">${Object.values(g.index.wrap).map(v => `<option value="${v}">` + getMessage(`word_wrap_${v}`)).join('')}</select>▼</div>`,
			],
			[
				`<div>${getMessage('display_limit')}</div>`,
				`<div><input type="number" class="others" name="limit_number" min="1" size="8" value="${g.storage.others.limit || 100}"><label><input type="checkbox" name="unlimited">${getMessage('unlimited')}</label></div>`,
			],
			[
				`<div>${getMessage('simultaneous_message')}</div>`,
				`<div><select name="simultaneous">${Object.values(g.index.simultaneous).map(v => `<option value="${v}">` + getMessage(`simultaneous_message_${v}`)).join('')}</select>▼</div>`,
			],
			[
				`<div>${getMessage('emoji_expression')}</div>`,
				`<div><select name="emoji">${Object.values(g.index.emoji).map(v => `<option value="${v}">` + getMessage(`emoji_expression_${v}`)).join('')}</select>▼</div>`,
			],
			...['normal', 'member', 'moderator', 'owner', 'verified'].map(type => [
				`<div>${getMessage(type)}</div>`,
				`<div><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="${type}_display" value="photo"><svg viewBox="-8 -8 16 16"><g id="yt-lcf-photo"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></g></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="${type}_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="${type}_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="${type}_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="${type}_color"></div>`,
			]),
			[
				`<div>${getMessage('superchat')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="paid_message_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="paid_message_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle amount" title="${getMessage('tooltip-purchase_amount')}"><input type="checkbox" name="paid_message_display" value="amount"><span>${getMessage('display-purchase_amount')}</span></label><br><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="paid_message_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="paid_message_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="paid_message_color"></div>`,
			],
			[
				`<div>${getMessage('sticker')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="paid_sticker_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="paid_sticker_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle amount" title="${getMessage('tooltip-purchase_amount')}"><input type="checkbox" name="paid_sticker_display" value="amount"><span>${getMessage('display-purchase_amount')}</span></label><br><label class="toggle body" title="${getMessage('tooltip-sticker')}"><input type="checkbox" name="paid_sticker_display" value="sticker"><span>${getMessage('display-sticker')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip-sticker_size')}" style="padding-left:4px">${getMessage('display-sticker_size')}: x<input type="number" class="styles" name="sticker_size" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.sticker_size) || 2}" data-unit="em"></label></div>`
			],
			[
				`<div>${getMessage('membership')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="membership_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="membership_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle body" title="${getMessage('tooltip-membership_message')}"><input type="checkbox" name="membership_display" value="message"><span>${getMessage('display-membership_message')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="membership_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="membership_color"></div>`,
			],
			[
				`<div>${getMessage('milestone')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="milestone_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="milestone_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle amount" title="${getMessage('tooltip-milestone_months')}"><input type="checkbox" name="milestone_display" value="months"><span>${getMessage('display-milestone_months')}</span></label><br><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="milestone_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="milestone_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="milestone_color"></div>`,
			],
			[
				`<div>${getMessage('translation')}</div>`,
				`<div><select name="translation" title="${getMessage('addable_by_firefox_language_settings')}"><option value="0">${getMessage('disabled')}${navigator.languages.map((lang, i) => `<option value="${i + 1}">` + lang).join('')}</select>▼</div>`,
				`<div>(beta feature)</div>`,
			],
		].map(row => '<div>' + row.join('') + '</div>').join('');
		
		const selects = form.querySelectorAll('select');
		for (const select of selects) {
			if (select.name in g.storage.others) {
				const val = g.storage.others[select.name];
				select.selectedIndex = val;
				switch (select.name) {
					case 'wrap': if (g.layer) {
						g.layer.style.setProperty('--yt-live-chat-flusher-message-hyphens', g.array.hyphens[val]);
						g.layer.style.setProperty('--yt-live-chat-flusher-message-word-break', g.array.wordBreak[val]);
						g.layer.style.setProperty('--yt-live-chat-flusher-message-white-space', g.array.whiteSpace[val]);
						g.layer.style.setProperty('--yt-live-chat-flusher-max-width', g.array.maxWidth[val] || g.storage.styles.max_width);
					}
					break;
				}
			}
		}
		const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[type="checkbox"]'));
		for (const checkbox of checkboxes) {
			const match = checkbox.name.match(/^(.+)_display$/);
			if (match) {
				const [_, type] = match;
				if (type in g.storage.parts) {
					checkbox.checked = g.storage.parts[type][checkbox.value];
					switch (checkbox.value) {
						case 'name': {
							const div = /** @type {HTMLDivElement} */ (checkbox.closest('div'));
							if (checkbox.checked) div.classList.add('outlined');
							checkbox.addEventListener('change', e => {
								const method = checkbox.checked ? 'add' : 'remove';
								div.classList[method]('outlined');
								g.layer?.classList[method](`has-${type}-name`);
							}, { passive: true });
							break;
						}
						case 'color': {
							const picker = /** @type {HTMLInputElement?} */ (checkbox.parentElement?.nextElementSibling);
							if (picker) {
								const saved = g.storage.parts[type].color;
								if (saved) {
									picker.value = saved;
								} else if (g.layer) {
									picker.value = formatHexColor(getComputedStyle(g.layer).getPropertyValue('--yt-live-chat-flusher-' + picker.name.replace(/_/g, '-')))
								}
							}
							break;
						}
					}
				}
			} else if (checkbox.name === 'lines') {
				checkbox.checked = g.storage.others.number_of_lines > 0;
				form.font_size.disabled = checkbox.checked;
				form.number_of_lines.disabled = form.type_of_lines.disabled = !checkbox.checked;
			} else if (checkbox.name === 'unlimited') {
				form.limit_number.disabled = checkbox.checked = g.storage.others.limit === 0;
				if (g.layer) g.layer.limit = g.storage.others.limit;
			}
		}
		form.addEventListener('change', e => {
			if (!form.reportValidity()) return;
			const elem = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
			const name = elem.name;
			if (elem instanceof HTMLSelectElement) {
				if (name in g.storage.others) {
					const val = parseInt(elem.value);
					g.storage.others[name] = val;
					switch (name) {
						case 'wrap': if (g.layer) {
							g.layer.style.setProperty('--yt-live-chat-flusher-message-hyphens', g.array.hyphens[val]);
							g.layer.style.setProperty('--yt-live-chat-flusher-message-word-break', g.array.wordBreak[val]);
							g.layer.style.setProperty('--yt-live-chat-flusher-message-white-space', g.array.whiteSpace[val]);
							g.layer.style.setProperty('--yt-live-chat-flusher-max-width', g.array.maxWidth[val] || g.storage.styles.max_width);
							updateCurrentItemStyle();
						}
						break;
					}
				}
			} else if (elem.classList.contains('styles')) {
				if (name) {
					g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
					g.layer?.style.setProperty('--yt-live-chat-flusher-' + name.replace(/_/g, '-'), g.storage.styles[name]);
					if (name === 'max_width') updateCurrentItemStyle();
				}
			} else if (name.endsWith('_display')) {
				const match = name.match(/^(.+)_display$/);
				if (match) {
					const [_, type] = match;
					if (type in g.storage.parts && g.layer) {
						if (elem.value !== 'color') {
							g.storage.parts[type][elem.value] = elem.checked;
							g.layer.style.setProperty('--yt-live-chat-flusher-' + name.replace(/_/g, '-') + '-' + elem.value, elem.checked ? 'inherit' : 'none');
						} else {
							if (elem.checked) {
								g.storage.parts[type].color = form.elements[type + '_color']?.value;
								g.layer.style.setProperty('--yt-live-chat-flusher-' + type.replace(/_/g, '-') + '-color', g.storage.parts[type].color || 'inherit');
							} else {
								g.storage.parts[type].color = null;
								g.layer.style.removeProperty('--yt-live-chat-flusher-' + type.replace(/_/g, '-') + '-color');
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
						g.storage.parts[type].color = form.elements[type + '_color']?.value;
						g.layer?.style.setProperty('--yt-live-chat-flusher-' + type.replace('_', '-') + '-color', g.storage.parts[type].color || 'inherit');
					} else {
						g.storage.parts[type].color = null;
						g.layer?.style.removeProperty('--yt-live-chat-flusher-' + type.replace('_', '-') + '-color');
					}
				}
			}
			if (['lines', 'number_of_lines', 'type_of_lines'].includes(name)) {
				const checked = form.lines.checked;
				form.font_size.disabled = checked;
				form.number_of_lines.disabled = !checked;
				form.type_of_lines.disabled = !checked;
				g.storage.others.number_of_lines = checked ? form.number_of_lines.valueAsNumber : 0;
				if (g.layer) {
					if (checked) {
						const sizeByLines = Math.floor(g.layer.getBoundingClientRect().height * .8 / form.number_of_lines.valueAsNumber);
						g.layer?.style.setProperty('--yt-live-chat-flusher-font-size', [
							`${sizeByLines}px`,
							`max(${form.font_size.value}px, ${sizeByLines}px)`,
							`min(${form.font_size.value}px, ${sizeByLines}px)`,
						][g.storage.others.type_of_lines]);
					} else {
						g.layer.style.setProperty('--yt-live-chat-flusher-font-size', `${form.font_size.value}px`);
					}
				}
			} else if (['unlimited', 'limit_number'].includes(name)) {
				const checked = form.unlimited.checked;
				form.limit_number.disabled = checked;
				g.storage.others.limit = checked ? 0 : form.limit_number.valueAsNumber;
				if (g.layer) g.layer.limit = g.storage.others.limit;
			}
			browser.storage.local.set(g.storage);
		}, { passive: true });
		const closeBtn = document.createElement('button');
		closeBtn.className = 'html5-video-info-panel-close ytp-button';
		closeBtn.title = getMessage('close');
		closeBtn.textContent = '[X]';
		closeBtn.addEventListener('click', this.hide, { passive: true });
		this.insertAdjacentElement('beforeend', closeBtn);
		this.insertAdjacentElement('beforeend', form);
		this.addEventListener('keydown', e => {
			e.stopPropagation();
		}, { passive: true });
	}
}
customElements.define(g.tag.panel, LiveChatPanelElement);

detectPageType();
window.addEventListener('yt-navigate-finish', detectPageType, { passive: true });
window.addEventListener('resize', e => {
	if (!g.layer) return;
	const lines = g.storage.others.number_of_lines;
	if (lines) {
		const sizeByLines = Math.floor(g.layer.getBoundingClientRect().height * .8 / lines);
		g.layer.style.setProperty('--yt-live-chat-flusher-font-size', [
			`${sizeByLines}px`,
			`max(${g.storage.styles.font_size}, ${sizeByLines}px)`,
			`min(${g.storage.styles.font_size}, ${sizeByLines}px)`,
		][g.storage.others.type_of_lines]);
	}
	updateCurrentItemStyle();
}, { passive: true });

function detectPageType() {
	if (location.pathname.startsWith('/live_chat') && top?.location.pathname === '/watch') {
		g.app = top.document.querySelector('#ytd-player');
		if (g.app) {
			startLiveChatFlusher();
			const storageList = ['styles', 'others', 'parts'];
			browser.storage.local.get(storageList).then(storage => {
				for (const type of storageList) {
					if (storage && storage[type]) {
						for (const [key, value] of Object.entries(storage[type])){
							g.storage[type][key] = value;
						}
					}
				}
				for (const [prop, value] of Object.entries(g.storage.styles)) {
					g.layer?.style.setProperty('--yt-live-chat-flusher-' + prop.replace(/_/g, '-'), value);
				}
				const lines = g.storage.others.number_of_lines;
				if (g.layer && lines) {
					const sizeByLines = Math.floor(g.layer.getBoundingClientRect().height * .8 / lines);
					if (g.storage.others.type_of_lines > 0) {
						g.layer.style.setProperty('--yt-live-chat-flusher-font-size', `max(${g.storage.styles.font_size}, ${sizeByLines}px)`);
					} else {
						g.layer.style.setProperty('--yt-live-chat-flusher-font-size', `${sizeByLines}px`);
					}
				}
				for (const [key, values] of Object.entries(g.storage.parts)) {
					for (const [prop, bool] of Object.entries(values)) {
						if (prop !== 'color') {
							g.layer?.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-display-${prop}`, bool ? 'inline' : 'none');
							if (prop === 'name') {
								g.layer?.classList[bool ? 'add' : 'remove'](`has-${key}-name`);
							}
						} else {
							if (bool) {
								g.layer?.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-color`, `${bool}`);
							} else {
								g.layer?.style.removeProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-color`);
							}
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
					['--yt-live-chat-paid-sticker-background-color', 0xffffb300, -1],
					['--yt-live-chat-author-chip-owner-background-color', 0xffffd600, -1],
				];
				for (const [name, rgb, alpha] of colormap) {
					g.layer?.style.setProperty(name, `rgba(${getColorRGB(rgb).join()},${alpha < 0 ? 'var(--yt-live-chat-flusher-background-opacity)' : alpha})`);
				}
			}).then(addSettingMenu);
		}
	} else if (location.pathname === '/watch') {
		document.addEventListener('yt-action', e => {
			switch (e.detail.actionName) {
				case 'ytd-watch-player-data-changed': {
					const layer = document.querySelector(g.tag.layer);
					if (layer) /** @type {LiveChatLayerElement} */ (layer).init();
				}
			}
		}, { passive: true });
	}
}

function getLayer() {
	const layer = /** @type {LiveChatLayerElement} */ (document.createElement(g.tag.layer));
	layer.addEventListener('contextmenu', e => {
		const origin = /** @type {HTMLElement?} */ (e.originalTarget);
		if (origin) {
			e.preventDefault();
			e.stopPropagation();
			origin.classList.toggle('paused');
		}
	}, { passive: false });
	layer.addEventListener('click', e => {
		const origin = /** @type {HTMLElement?} */ (e.originalTarget);
		if (origin?.tagName === 'A') {
			e.stopPropagation();
		} else {
			/** @type {HTMLElement?} */ (e.target)?.parentElement?.click();
		}
	}, { passive: true });
	layer.addEventListener('wheel', e => {
		const origin = /** @type {HTMLElement?} */ (e.originalTarget);
		if (origin) {
			e.preventDefault();
			if (origin.classList.contains('paused')) {
				e.stopPropagation();
				origin.style.animationDelay = `${parseFloat(origin.style.animationDelay || '0') + Math.sign(e.deltaY) * .05}s`;
			}
		}
	}, { passive: false });
	return layer;
}

function startLiveChatFlusher() {
	if (!g.app) return;
	const video = g.app.querySelector('video');
	const videoContainer = video?.parentElement;
	
	if (video && videoContainer) {
		const current = g.app.querySelector(g.tag.layer);
		if (current) current.remove();
		g.layer = getLayer();
		videoContainer.insertAdjacentElement('afterend', g.layer);
		
		const timer = setInterval(() => {
			const /** @type {HTMLElement?} */ renderer = document.querySelector(g.tag.chat);
			if (renderer) {
				clearInterval(timer);
				renderer.addEventListener('yt-action', handleYtAction, { passive: true });
			}
		}, 1000);
	}
}

function addSettingMenu() {
	if (!g.app) return;
	const current = g.app.querySelector(g.tag.panel);
	if (current) current.remove();
	const panel = document.createElement(g.tag.panel);
	const checkboxId = g.id + '-checkbox';
	const popupmenuId = g.id + '-popupmenu';
	g.app.querySelector('#' + checkboxId)?.remove();
	g.app.querySelector('#' + popupmenuId)?.remove();
	/** @type {HTMLElement?} */
	const ytpPanelMenu = g.app.querySelector('.ytp-settings-menu .ytp-panel-menu');
	if (ytpPanelMenu) {
		const checkbox = document.createElement('div');
		const popupmenu = document.createElement('div');
		checkbox.id = checkboxId;
		popupmenu.id = popupmenuId;
		checkbox.className = popupmenu.className = 'ytp-menuitem';
		checkbox.tabIndex = popupmenu.tabIndex = 0;
		checkbox.setAttribute('role', 'menuitemcheckbox');
		popupmenu.setAttribute('role', 'menuitem');
		checkbox.setAttribute('aria-checked', 'true');
		popupmenu.setAttribute('aria-haspopup', 'true');
		checkbox.addEventListener('click', _ => {
			const checked = checkbox.getAttribute('aria-checked') === 'true';
			checkbox.setAttribute('aria-checked', (!checked).toString());
			if (g.layer) g.layer[checked ? 'hide' : 'show']();
			if (!checked) browser.runtime.reload();
		}, { passive: true });
		checkbox.innerHTML = `<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -40 80 80"><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0M0,-24Q8,-24,24,-23,31,-22,31,-19,32,-12,32,0" fill="none" stroke="white" stroke-width="3"/><g fill="white" transform="translate(0,10)"><path d="M4,-10l12,12h8l-12,-12,12,-12h-8z"/><circle r="3"/><circle cx="-10" r="3"/><circle cx="-20" r="3"/></g></svg></div><div class="ytp-menuitem-label">${getMessage('ytp-menuitem-label-switch')}</div><div class="ytp-menuitem-content"><div class="ytp-menuitem-toggle-checkbox"></div></div></div>`;
		popupmenu.addEventListener('click', _ => {
			panel[panel.hidden ? 'show' : 'hide']();
		}, { passive: true });
		popupmenu.innerHTML = `<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -64 108 108"><mask id="m"><path d="M-40-80h120v120h-120z" fill="white" /><circle r="9"/></mask><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0" fill="none" stroke="white" stroke-width="4"/><g fill="white" transform="translate(0,10)"><circle cx="8" r="3"/><circle cx="-4" r="3"/><circle cx="-16" r="3"/><g transform="translate(32,-32) scale(1.25)" mask="url(#m)"><path id="p" d="M0,0L-10,-8L-6,-24Q0,-26,6,-24L10,-8L-10,8L-6,24Q0,26,6,24L10,8z"/><use xlink:href="#p" transform="rotate(60)"/><use xlink:href="#p" transform="rotate(120)"/></g></g></svg></div><div class="ytp-menuitem-label">${getMessage('ytp-menuitem-label-config')}</div><div class="ytp-menuitem-content"></div>`;
		ytpPanelMenu.appendChild(checkbox);
		ytpPanelMenu.appendChild(popupmenu);
	}
	g.layer?.insertAdjacentElement('afterend', panel);
}

/** @param {string | undefined} type */
function updateCurrentItemStyle(type = undefined) {
	if (!g.layer) return;
	const children = g.layer.shadowRoot?.children;
	if (children) {
		const items = Array.from(children).filter(type ? c => c.classList.contains(type) : c => c.tagName !== 'LINK');
		/** @type {HTMLElement[]} */ (items).forEach(updateCurrentItem);
	}
}

/** @param {HTMLElement} item */
function updateCurrentItem(item) {
	if (!g.layer) return;
	const isLong = item.clientWidth >= g.layer.clientWidth * (parseInt(g.storage.styles.max_width) / 100 || 1);
	item.classList[isLong ? 'add' : 'remove']('wrap');
	item.style.setProperty('--yt-live-chat-flusher-translate-x', `-${g.layer.clientWidth + item.clientWidth}px`);
}

/**
 * @param {CustomEvent<{ actionName: string, args: any[][] }>} e 
 */
function handleYtAction(e) {
	if (e.detail.actionName === 'yt-live-chat-actions') {
		const root = g.layer?.shadowRoot;
		if (!g.layer || !root) return;
		if (document.visibilityState === 'hidden') return;
		if (g.layer.hidden) return;
		if (g.layer.parentElement?.classList.contains('paused-mode')) return;
		const actions = e.detail.args[0];
		const filtered = {
			add: actions.filter(a => 'addChatItemAction' in a),
			delete: actions.filter(a => 'markChatItemAsDeletedAction' in a),
			delete_author: actions.filter(a => 'markChatItemsByAuthorAsDeletedAction' in a),
			replace: actions.filter(a => 'replaceChatItemAction' in a),
		};

		// Add
		const fs = parseInt(g.storage.styles.font_size) || 36, lh = fs * 1.25;
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
			if (!elem) return reject('No target element');
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
			const children = Array.from(/** @type {HTMLCollectionOf<HTMLElement>} */ (root.children));
			root.appendChild(elem);
			const isLong = elem.clientWidth >= g.layer.clientWidth * (parseInt(g.storage.styles.max_width) / 100 || 1)
			if (isLong) elem.classList.add('wrap');
			elem.style.setProperty('--yt-live-chat-flusher-translate-x', `-${g.layer.clientWidth + elem.clientWidth}px`);
			const body = elem.lastElementChild?.textContent;
			if (body) browser.i18n.detectLanguage(body).then(result => {
				if (result.isReliable) elem.lang = result.languages[0].language;
			});
			elem.addEventListener('animationend', _ => elem.remove() , { passive: true });
			let y = 0;
			if (elem.clientHeight >= g.layer.clientHeight) {
				elem.style.top = '0px';
				return resolve(elem.id);
			}
			const overline = Math.ceil(g.layer.clientHeight / lh);
			do {
				if (children.length > 0) {
					elem.style.top = `${y * 1.25}em`;
					if (!children.some(before => isCatchable(before, elem)) && !isOverflow(g.layer, elem)) return resolve(elem.id);
				} else {
					elem.style.top = '0px';
					return resolve(elem.id);
				}
			} while (y++ < overline);
			do {
				const tops = children.map(child => child.offsetTop);
				const lines = new Array(y).fill(0);
				tops.forEach(v => { lines[v / lh]++; });
				let ln = -1, i = 0;
				do ln = lines.indexOf(i++);
				while (ln < 0);
				elem.style.top = `${ln * 1.25}em`;
			} while (isOverflow(g.layer, elem) && y-- > 0);
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
		orig: renderer.message ? getChatMessage(renderer.message) : '',
		trans: '',
	};
	const tl = [null, ...navigator.languages][g.storage.others.translation];
	if (tl && msg.orig) {
		const text = msg.orig.split(/(\s*<.*?>\s*)/).filter(s => s.length);
		msg.trans = await Promise.all(text.map(async q => {
			if (q.startsWith('<')) {
				return q;
			} else {
				const detection = await browser.i18n.detectLanguage(q);
				const sl = detection.isReliable ? detection.languages[0].language : 'auto';
				if (tl.split('-')[0] === sl) {
					return q;
				} else {
					const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dj=1&q=` + encodeURIComponent(q);
					/** @type { { sentences: { trans: string }[] }? } */
					const json = await content.fetch(url).then(res => res.json());
					return json?.sentences.map(s => s.trans).join('') || '';
				}
			}
		})).then(s => s.join(''));
	}
	switch (key) {
		case 'liveChatTextMessageRenderer': {
			elem.className = 'text ' + getAuthorType(renderer);
			elem.innerHTML = [
				`<span class="header">${author}</span>`,
				`<span class="body">${msg.trans || msg.orig}</span>`,
			].join('');
			elem.dataset.text = getChatMessage(renderer.message, { emoji: -1 });
			break;
		}
		case 'liveChatMembershipItemRenderer': {
			const { headerPrimaryText: primary, headerSubtext: sub } = renderer;
			elem.className = primary ? 'milestone' : 'membership';
			elem.innerHTML = [
				`<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-live-chat-flusher-background-opacity))">${author}<span class="months">${getChatMessage(primary || sub, { start: primary ? 1 : 0 })}</span></div>`,
				`<div class="body" style="background-color:rgba(${getColorRGB(0xff0a8043).join()},var(--yt-live-chat-flusher-background-opacity))">${msg.trans || msg.orig}</div>`,
			].join('');
			break;
		}
		case 'liveChatPaidMessageRenderer': {
			elem.className = 'superchat';
			elem.innerHTML = [
				`<div class="header" style="background-color:rgba(${getColorRGB(renderer.headerBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">${author}<span class="amount">${getChatMessage(renderer.purchaseAmountText)}</span></div>`,
				`<div class="body" style="background-color:rgba(${getColorRGB(renderer.bodyBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">${msg.trans || msg.orig}</div>`,
			].join('');
			break;
		}
		case 'liveChatPaidStickerRenderer': {
			elem.className = 'supersticker';
			elem.innerHTML = [
				`<div class="header" style="background-color:rgba(${getColorRGB(renderer.backgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">${author}<span class="amount">${getChatMessage(renderer.purchaseAmountText)}</span></div>`,
				`<figure class="body" style="background-color:rgba(${getColorRGB(renderer.moneyChipBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity)"><img class="sticker" src="${(renderer.sticker.thumbnails.find(t => 2 * 36 <= (t.width || 36)) || renderer.sticker.thumbnails[0]).url}" loading="lazy"></figure>`,
			].join('');
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
		case 'liveChatPlaceholderItemRenderer': break;
		// liveChatModeChangeMessageRenderer
		default: console.log(item);
	}
	return elem;
}

/**
 * @param {LiveChat.RendererContent} renderer
 */
function getAuthorType(renderer) {
	const statuses = ['owner', 'moderator', 'member', 'verified'];
	const classes = renderer.authorBadges?.map(b => b.liveChatAuthorBadgeRenderer.customThumbnail ? 'member' : b.liveChatAuthorBadgeRenderer.icon?.iconType.toLowerCase() || '') || [];
	for (const s of statuses) if (classes.includes(s)) return s;
	return 'normal';
}

/**
 * @param { LiveChat.Runs | LiveChat.SimpleText | undefined } message
 * @param { { start?: number, end?: number, emoji?: number } } options
 */
function getChatMessage(message, options = {}) {
	if (message) {
		const { start, end } = options;
		if ('runs' in message) {
			const runs = start || end ? message.runs.slice(start, end) : message.runs;
			return runs.map(r => {
				if ('text' in r) {
					let text = escapeHtml(r.text).replace(/\n/g, '<br>');
					if (r.italics) text = '<i>' + text + '</i>';
					if (r.bold) text = '<b>' + text + '</b>';
					if (r.navigationEndpoint) {
						const icon = document.querySelector('iron-iconset-svg #open_in_new');
						const { url, nofollow } = r.navigationEndpoint.urlEndpoint;
						text = `<a class="open_in_new" href="${url}" target="_blank" title="${text}" rel="${nofollow ? 'nofollow' : ''}"><svg viewBox="0 0 24 24" fill="currentColor" stroke="#000" paint-order="stroke">${icon?.innerHTML}</svg></a>`;
					}
					return text;
				} else {
					const emoji = options.emoji ?? g.storage.others.emoji;
					if (!emoji) return '';
					const e = g.index.emoji;
					switch (emoji) {
						case e.all: {
							const thumbnail = r.emoji.image.thumbnails.slice(-1)[0];
							return thumbnail ? `<img class="emoji" src="${thumbnail.url}">` : `<span class="emoji">${r.emoji.emojiId}</span>`;
						}
						case e.label: return `<span class="emoji">${r.emoji.image.accessibility.accessibilityData.label}</span>`;
						case e.shortcut: return `<span class="emoji">${r.emoji.shortcuts?.[0] || ''}</span>`;
						case -1: return r.emoji.shortcuts?.[0] || r.emoji.emojiId || '';
						default: return '';
					}
				}
			}).join('');
		} else {
			return escapeHtml(start || end ? message.simpleText.slice(start, end): message.simpleText);
		}
	} else {
		return '';
	}
}

/** @param {string} str */
function escapeHtml(str) {
	return str.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
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
 * @param {number} long
 */
function getColorRGB(long) {
	return (long.toString(16).match(/[0-9a-f]{2}/g) || []).map(hex => parseInt(hex, 16)).slice(1);
}

/**
 * @param {string} color 
 * @param {string} inherit 
 */
function formatHexColor(color, inherit = '#ffffff') {
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