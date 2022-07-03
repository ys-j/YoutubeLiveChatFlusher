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
	/** @type {LiveChatLayer?} */
	layer: null,
	/** @type {LiveChatPanel?} */
	panel: null,
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
			px_per_sec: 0,
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

const getMessage = chrome.i18n.getMessage;

class LiveChatLayer {
	/** @param div {?HTMLDivElement | undefined} */
	constructor(div = undefined) {
		this.limit = 0;
		this.element = div || document.createElement('div');
		this.element.id = 'yt-live-chat-flusher-layer';
		this.element.dataset.layer = '1';
		this.element.setAttribute('role', 'marquee');
		this.element.setAttribute('aria-live', 'off');
		this.init();
	}
	init() {
		const root = this.element.shadowRoot || this.element.attachShadow({ mode: 'open' });
		root.innerHTML = '';
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = chrome.runtime.getURL('layer.css');
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
}

class LiveChatPanel {
	/** @param div {?HTMLDivElement | undefined} */
	constructor(div = undefined) {
		this.element = div || document.createElement('div');
		this.element.id = 'yt-live-chat-flusher-panel';
		this.element.className = 'html5-video-info-panel';
		this.element.dataset.layer = '4';
		this.hide();

		this.form = document.createElement('form');
		this.form.className = 'html5-video-info-panel-content';
		this.form.innerHTML = [
			[
				`<div>${getMessage('animationDuration')}</div>`,
				`<div><label><input type="number" class="styles" name="animation_duration" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.animation_duration) || 8}" data-unit="s">s</label> /<input type="checkbox" name="speed"><label><input type="number" name="px_per_sec" min="1" size="8" value="${g.storage.others.px_per_sec || 160}" data-unit="px/s">px/s</label></div>`,
			],
			[
				`<div>${getMessage('fontSize')}</div>`,
				`<div><label><input type="number" class="styles" name="font_size" min="12" size="5" value="${parseInt(g.storage.styles.font_size) || 36}" data-unit="px">px</label> /<input type="checkbox" name="lines"><label><input type="number" name="number_of_lines" min="6" size="5" value="${g.storage.others.number_of_lines || 20}">${getMessage('lines')}</label><select name="type_of_lines">${Object.values(g.index.lines).map(v => `<option value="${v}">` + getMessage(`typeOfLines_${v}`)).join('')}</select><span>▼</span></div>`,
			],
			[
				`<div>${getMessage('layerOpacity')}</div>`,
				`<div>${getMessage('opacity_0')}<input type="range" class="styles" name="layer_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.layer_opacity) || 1}">${getMessage('opacity_1')}</div>`,
			],
			[
				`<div>${getMessage('backgroundOpacity')}</div>`,
				`<div>${getMessage('opacity_0')}<input type="range" class="styles" name="background_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.background_opacity) || 0.5}">${getMessage('opacity_1')}</div>`,
			],
			[
				`<div>${getMessage('maxWidth')}/${getMessage('wordWrap')}</div>`,
				`<div><label><input type="number" class="styles" name="max_width" min="50" size="8" value="${parseInt(g.storage.styles.max_width) || 100}" data-unit="%"><span>%</span></label> /<select name="wrap">${Object.values(g.index.wrap).map(v => `<option value="${v}">` + getMessage(`wordWrap_${v}`)).join('')}</select>▼</div>`,
			],
			[
				`<div>${getMessage('displayLimit')}</div>`,
				`<div><input type="number" class="others" name="limit_number" min="1" size="8" value="${g.storage.others.limit || 100}"><label><input type="checkbox" name="unlimited">${getMessage('unlimited')}</label></div>`,
			],
			[
				`<div>${getMessage('simultaneousMessage')}</div>`,
				`<div><select name="simultaneous">${Object.values(g.index.simultaneous).map(v => `<option value="${v}">` + getMessage(`simultaneousMessage_${v}`)).join('')}</select>▼</div>`,
			],
			[
				`<div>${getMessage('emojiExpression')}</div>`,
				`<div><select name="emoji">${Object.values(g.index.emoji).map(v => `<option value="${v}">` + getMessage(`emojiExpression_${v}`)).join('')}</select>▼</div>`,
			],
			...['normal', 'member', 'moderator', 'owner', 'verified'].map(type => [
				`<div>${getMessage(type)}</div>`,
				`<div><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="${type}_display" value="photo"><svg viewBox="-8 -8 16 16"><g id="yt-lcf-photo"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></g></svg></label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="${type}_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle body" title="${getMessage('tooltip_chatMessage')}"><input type="checkbox" name="${type}_display" value="message"><span>${getMessage('display_chatMessage')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="${type}_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="${type}_color"></div>`,
			]),
			[
				`<div>${getMessage('superchat')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="paid_message_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="paid_message_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle amount" title="${getMessage('tooltip_purchaseAmount')}"><input type="checkbox" name="paid_message_display" value="amount"><span>${getMessage('display_purchaseAmount')}</span></label><br><label class="toggle body" title="${getMessage('tooltip_chatMessage')}"><input type="checkbox" name="paid_message_display" value="message"><span>${getMessage('display_chatMessage')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="paid_message_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="paid_message_color"></div>`,
			],
			[
				`<div>${getMessage('sticker')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="paid_sticker_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="paid_sticker_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle amount" title="${getMessage('tooltip_purchaseAmount')}"><input type="checkbox" name="paid_sticker_display" value="amount"><span>${getMessage('display_purchaseAmount')}</span></label><br><label class="toggle body" title="${getMessage('tooltip_sticker')}"><input type="checkbox" name="paid_sticker_display" value="sticker"><span>${getMessage('display_sticker')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip_stickerSize')}" style="padding-left:4px">${getMessage('display_stickerSize')}: x<input type="number" class="styles" name="sticker_size" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.sticker_size) || 2}" data-unit="em"></label></div>`
			],
			[
				`<div>${getMessage('membership')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="membership_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="membership_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle body" title="${getMessage('tooltip_membershipMessage')}"><input type="checkbox" name="membership_display" value="message"><span>${getMessage('display_membershipMessage')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="membership_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="membership_color"></div>`,
			],
			[
				`<div>${getMessage('milestone')}</div>`,
				`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip_authorPhoto')}"><input type="checkbox" name="milestone_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip_authorName')}"><input type="checkbox" name="milestone_display" value="name"><span>${getMessage('display_authorName')}</span></label><label class="toggle amount" title="${getMessage('tooltip_milestoneMonths')}"><input type="checkbox" name="milestone_display" value="months"><span>${getMessage('display_milestoneMonths')}</span></label><br><label class="toggle body" title="${getMessage('tooltip_chatMessage')}"><input type="checkbox" name="milestone_display" value="message"><span>${getMessage('display_chatMessage')}</span></label></div>`,
				`<div><label title="${getMessage('tooltip_customColor')}"><input type="checkbox" name="milestone_display" value="color">${getMessage('display_customColor')}</label><input type="color" name="milestone_color"></div>`,
			],
			[
				`<div>${getMessage('translation')}</div>`,
				`<div><select name="translation" title="${getMessage('addableByFirefoxLanguageSettings')}"><option value="0">${getMessage('disabled')}${navigator.languages.map((lang, i) => `<option value="${i + 1}">` + lang).join('')}</select>▼</div>`,
				`<div>(beta feature)</div>`,
			],
		].map(row => '<div>' + row.join('') + '</div>').join('');

		const selects = this.form.querySelectorAll('select');
		for (const select of selects) {
			if (select.name in g.storage.others) {
				const val = g.storage.others[select.name];
				select.selectedIndex = val;
				switch (select.name) {
					case 'wrap': if (g.layer) {
						g.layer.element.style.setProperty('--yt-live-chat-flusher-message-hyphens', g.array.hyphens[val]);
						g.layer.element.style.setProperty('--yt-live-chat-flusher-message-word-break', g.array.wordBreak[val]);
						g.layer.element.style.setProperty('--yt-live-chat-flusher-message-white-space', g.array.whiteSpace[val]);
						g.layer.element.style.setProperty('--yt-live-chat-flusher-max-width', g.storage.styles.max_width);
					}
					break;
				}
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
								g.layer?.element.classList[method](`has-${type}-name`);
							}, { passive: true });
							break;
						}
						case 'color': {
							const picker = /** @type {HTMLInputElement?} */ (cb.parentElement?.nextElementSibling);
							if (picker) {
								const saved = g.storage.parts[type].color;
								if (saved) {
									picker.value = saved;
								} else if (g.layer) {
									picker.value = formatHexColor(getComputedStyle(g.layer.element).getPropertyValue('--yt-live-chat-flusher-' + picker.name.replace(/_/g, '-')));
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
				}
			}
		}
		this.form.addEventListener('change', e => {
			if (!this.form.reportValidity()) return;
			const elem = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
			this.updateStorage(elem);
		}, { passive: true });

		const closeBtn = document.createElement('button');
		closeBtn.className = 'html5-video-info-panel-close ytp-button';
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
				g.storage.others[name] = val;
				switch (name) {
					case 'wrap': if (le) {
						le.style.setProperty('--yt-live-chat-flusher-message-hyphens', g.array.hyphens[val]);
						le.style.setProperty('--yt-live-chat-flusher-message-word-break', g.array.wordBreak[val]);
						le.style.setProperty('--yt-live-chat-flusher-message-white-space', g.array.whiteSpace[val]);
						le.style.setProperty('--yt-live-chat-flusher-max-width', g.storage.styles.max_width);
						updateCurrentItemStyle();
					}
					break;
				}
			}
		} else if (elem.classList.contains('styles')) {
			if (name) {
				g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
				le?.style.setProperty('--yt-live-chat-flusher-' + name.replace(/_/g, '-'), g.storage.styles[name]);
				if (name === 'max_width') updateCurrentItemStyle();
			}
		} else if (name.endsWith('_display')) {
			const match = name.match(/^(.+)_display$/);
			if (match) {
				const [_, type] = match;
				if (type in g.storage.parts && le) {
					if (elem.value !== 'color') {
						g.storage.parts[type][elem.value] = elem.checked;
						le.style.setProperty('--yt-live-chat-flusher-' + name.replace(/_/g, '-') + '-' + elem.value, elem.checked ? 'inherit' : 'none');
					} else {
						if (elem.checked) {
							g.storage.parts[type].color = this.form.elements[type + '_color']?.value;
							le.style.setProperty('--yt-live-chat-flusher-' + type.replace(/_/g, '-') + '-color', g.storage.parts[type].color || 'inherit');
						} else {
							g.storage.parts[type].color = null;
							le.style.removeProperty('--yt-live-chat-flusher-' + type.replace(/_/g, '-') + '-color');
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
					le?.style.setProperty('--yt-live-chat-flusher-' + type.replace('_', '-') + '-color', g.storage.parts[type].color || 'inherit');
				} else {
					g.storage.parts[type].color = null;
					le?.style.removeProperty('--yt-live-chat-flusher-' + type.replace('_', '-') + '-color');
				}
			}
		}
		if (['speed', 'px_per_sec'].includes(name)) {
			const checked = this.form.speed.checked;
			this.form.animation_duration.disabled = checked;
			this.form.px_per_sec.disabled = !checked;
			g.storage.others.px_per_sec = checked ? this.form.px_per_sec.valueAsNumber : 0;
			if (le) {
				if (checked) {
					const durationBySpeed = le.getBoundingClientRect().width / this.form.px_per_sec.valueAsNumber;
					le.style.setProperty('--yt-live-chat-flusher-animation-duration', durationBySpeed.toFixed(2) + 's');
				} else {
					le.style.setProperty('--yt-live-chat-flusher-animation-duration', this.form.animation_duration.value + 's');
				}
			}
		} else if (['lines', 'number_of_lines', 'type_of_lines'].includes(name)) {
			const checked = this.form.lines.checked;
			this.form.font_size.disabled = checked;
			this.form.number_of_lines.disabled = !checked;
			this.form.type_of_lines.disabled = !checked;
			g.storage.others.number_of_lines = checked ? this.form.number_of_lines.valueAsNumber : 0;
			if (le) {
				if (checked) {
					const sizeByLines = Math.floor(le.getBoundingClientRect().height * .8 / this.form.number_of_lines.valueAsNumber);
					le.style.setProperty('--yt-live-chat-flusher-font-size', [
						`${sizeByLines}px`,
						`max(${this.form.font_size.value}px, ${sizeByLines}px)`,
						`min(${this.form.font_size.value}px, ${sizeByLines}px)`,
					][g.storage.others.type_of_lines]);
				} else {
					le.style.setProperty('--yt-live-chat-flusher-font-size', this.form.font_size.value + 'px');
				}
			}
		} else if (['unlimited', 'limit_number'].includes(name)) {
			const checked = this.form.unlimited.checked;
			this.form.limit_number.disabled = checked;
			g.storage.others.limit = checked ? 0 : this.form.limit_number.valueAsNumber;
			if (g.layer) g.layer.limit = g.storage.others.limit;
		}
		chrome.storage.local.set(g.storage);
	}
}

detectPageType();
window.addEventListener('yt-navigate-finish', detectPageType, { passive: true });
window.addEventListener('resize', e => {
	if (!g.layer) return;
	const le = g.layer.element;
	const speed = g.storage.others.px_per_sec;
	if (speed) {
		const durationBySpeed = le.getBoundingClientRect().width / speed;
		le.style.setProperty('--yt-live-chat-flusher-animation-duration', durationBySpeed.toFixed(2) + 's');
	}
	const lines = g.storage.others.number_of_lines;
	if (lines) {
		const sizeByLines = Math.floor(le.getBoundingClientRect().height * .8 / lines);
		le.style.setProperty('--yt-live-chat-flusher-font-size', [
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
			chrome.storage.local.get(storageList).then(storage => {
				for (const type of storageList) {
					if (storage && storage[type]) {
						for (const [key, value] of Object.entries(storage[type])){
							g.storage[type][key] = value;
						}
					}
				}
				if (g.layer) {
					const le = g.layer.element;
					for (const [prop, value] of Object.entries(g.storage.styles)) {
						le.style.setProperty('--yt-live-chat-flusher-' + prop.replace(/_/g, '-'), value);
					}
					const lines = g.storage.others.number_of_lines;
					if (lines) {
						const sizeByLines = Math.floor(le.getBoundingClientRect().height * .8 / lines);
						if (g.storage.others.type_of_lines > 0) {
							le.style.setProperty('--yt-live-chat-flusher-font-size', `max(${g.storage.styles.font_size}, ${sizeByLines}px)`);
						} else {
							le.style.setProperty('--yt-live-chat-flusher-font-size', `${sizeByLines}px`);
						}
					}
					for (const [key, values] of Object.entries(g.storage.parts)) {
						for (const [prop, bool] of Object.entries(values)) {
							if (prop !== 'color') {
								le.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-display-${prop}`, bool ? 'inline' : 'none');
								if (prop === 'name') {
									le.classList[bool ? 'add' : 'remove'](`has-${key}-name`);
								}
							} else {
								if (bool) {
									le.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-color`, `${bool}`);
								} else {
									le.style.removeProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-color`);
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
						le.style.setProperty(name, `rgba(${getColorRGB(rgb).join()},${alpha < 0 ? 'var(--yt-live-chat-flusher-background-opacity)' : alpha})`);
					}
				}
			}).then(addSettingMenu);
		}
	} else if (location.pathname === '/watch') {
		document.addEventListener('yt-action', e => {
			switch (e.detail.actionName) {
				case 'ytd-watch-player-data-changed': {
					/** @type {HTMLDivElement?} */
					const div = document.querySelector('#' + g.tag.layer);
					if (div) {
						const layer = new LiveChatLayer(div);
						layer.init();
					}
				}
			}
		}, { passive: true });
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
			}
		}, 1000);
	}
}

function addSettingMenu() {
	if (!g.app) return;
	/** @type {HTMLDivElement?} */
	const current = g.app.querySelector('#' + g.tag.panel);
	if (current) current.remove();
	const panel = new LiveChatPanel();
	const attrs = [
		{
			id: g.id + '-checkbox',
			role: 'menuitemcheckbox',
			'aria-checked': 'true',
		},
		{
			id: g.id + '-popupmenu',
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
		const items = Array.from(children).filter(type ? c => c.classList.contains(type) : c => c.tagName !== 'LINK');
		/** @type {HTMLElement[]} */ (items).forEach(updateCurrentItem);
	}
}

/** @param {HTMLElement} item */
function updateCurrentItem(item) {
	if (!g.layer) return;
	const isLong = item.clientWidth >= g.layer.element.clientWidth * (parseInt(g.storage.styles.max_width) / 100 || 1);
	item.classList[isLong ? 'add' : 'remove']('wrap');
	item.style.setProperty('--yt-live-chat-flusher-translate-x', `-${g.layer.element.clientWidth + item.clientWidth}px`);
}

/**
 * @param {CustomEvent<{ actionName: string, args: any[][] }>} e 
 */
function handleYtAction(e) {
	if (e.detail.actionName === 'yt-live-chat-actions') {
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

		// Add
		const fs = parseInt(g.storage.styles.font_size) || 36, lhf = 1.25, lh = fs * lhf;
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
			const { clientHeight: ch, clientWidth: cw } = le;
			const isLong = elem.clientWidth >= cw * (parseInt(g.storage.styles.max_width) / 100 || 1)
			if (isLong) elem.classList.add('wrap');
			elem.style.setProperty('--yt-live-chat-flusher-translate-x', `-${cw + elem.clientWidth}px`);
			const body = elem.lastElementChild?.textContent;
			if (body) chrome.i18n.detectLanguage(body).then(result => {
				if (result.isReliable) elem.lang = result.languages?.[0].language;
			});
			elem.addEventListener('animationend', e => {
				/** @type {HTMLElement} */ (e.target).remove();
			}, { passive: true });
			let y = 0;
			if (elem.clientHeight >= ch) {
				elem.style.top = '0px';
				return resolve(elem.id);
			}
			const overline = Math.ceil(ch / lh);
			do {
				if (children.length > 0) {
					elem.style.top = `${y * lhf}em`;
					if (!children.some(before => isCatchable(before, elem)) && !isOverflow(le, elem)) return resolve(elem.id);
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
				elem.style.top = `${ln * lhf}em`;
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
				const detection = await chrome.i18n.detectLanguage(q);
				const sl = detection.isReliable ? detection.languages[0].language : 'auto';
				if (tl.split('-')[0] === sl) {
					return q;
				} else {
					const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&dj=1&q=` + encodeURIComponent(q);
					/** @type { { sentences: { trans: string }[] }? } */
					const json = await fetch(url).then(res => res.json());
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
		case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer': {
			elem.className = 'membership gift';
			const h = renderer.header.liveChatSponsorshipsHeaderRenderer;
			const name = getChatMessage(h.authorName);
			const author = name ? `<a href="/channel/${renderer.authorExternalChannelId}" target="_blank" title="${name}"><img class="photo" src="${h.authorPhoto.thumbnails[0].url}" loading="lazy"></a><span class="name">${name}</span>` : '';
			const icon = document.querySelector('iron-iconset-svg #gift-filled');
			const count = h.primaryText?.runs?.filter(r => parseInt(r.text) !== NaN)[0]?.text;
			if (count) {
				const gifts = (icon ? `<svg viewBox="0 2 24 24" fill="currentColor" stroke="#000" paint-order="stroke">${icon.innerHTML}</svg>` : '🎁') + count;
				elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-live-chat-flusher-background-opacity))">${author}<span class="gifts">${gifts}</span></div>`;
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
						const ep = r.navigationEndpoint.urlEndpoint || r.navigationEndpoint.watchEndpoint;
						if (ep) {
							const icon = document.querySelector('iron-iconset-svg #open_in_new');
							const href = 'url' in ep ? ep.url : (ep.videoId ? '/watch?v=' + ep.videoId : '');
							text = `<a class="open_in_new" href="${href}" target="_blank" title="${text}" rel="${ep.nofollow ? 'nofollow' : ''}"><svg viewBox="0 0 24 24" fill="currentColor" stroke="#000" paint-order="stroke">${icon?.innerHTML}</svg></a>`;
						}
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