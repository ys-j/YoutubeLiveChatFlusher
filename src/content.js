/* Copyright 2021 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/** @typedef { "photo" | "name" | "amount" | "months" | "message" | "sticker" } StoragePartKey */
/**
 * @type { {
 * app: HTMLElement?,
 * enum: { [key:string]: number },
 * id: string,
 * layer: HTMLElement?,
 * panel: HTMLElement?,
 * storage: {
 * 	styles: { [key:string]: string },
 * 	others: { [key:string]: number },
 * 	parts: { [key:string]: { [key in StoragePartKey]?: boolean } & { color?: string? } }
 * }
 * } }
 */
const g = {
	app: null,
	enum: {
		SIMULTANEOUS_ALL: 0,
		SIMULTANEOUS_FIRST: 1,
		SIMULTANEOUS_MERGE: 2,
		EMOJI_NONE: 0,
		EMOJI_ALL: 1,
		EMOJI_LABEL: 2,
		EMOJI_SHORTCUT: 3,
	},
	id: 'youtube-livechat-flusher',
	layer: null,
	panel: null,
	storage: {
		styles: {
			animation_duration: '4s',
			font_size: '36px',
			layer_opacity: '1',
			background_opacity: '0.5',
			sticker_size: '3em',
		},
		others: {
			number_of_lines: 0,
			simultaneous: 2,
			emoji: 1,
		},
		parts: {
			normal: { photo: false, name: false, message: true, color: null },
			member: { photo: true, name: false, message: true, color: null },
			moderator: { photo: true, name: true, message: true, color: null },
			owner: { photo: true, name: true, message: true, color: null },
			paid_message: { photo: true, name: true, amount: true, message: true, color: null },
			paid_sticker: { photo: true, name: true, amount: true, sticker: true },
			new_membership: { photo: true, name: false, message: true, color: null },
			milestone: { photo: true, name: true, months: true, message: true, color: null },
		},
	},
};

const getMessage = browser.i18n.getMessage;

detectPageType();
window.addEventListener('yt-navigate-finish', e => {
	detectPageType();
}, { passive: true });
window.addEventListener('resize', e => {
	if (!g.layer) return;
	const lines = g.storage.others.number_of_lines;
	if (lines) {
		const height = g.layer.getBoundingClientRect().height;
		g.layer.style.setProperty('--yt-live-chat-flusher-font-size', (height * .8 / lines).toFixed(0) + 'px');
	}
}, { passive: true });

function detectPageType() {
	if (location.pathname.startsWith('/live_chat') && top && top.location.pathname === '/watch') {
		g.app = top.document.querySelector('ytd-app');
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
				if (lines) {
					g.layer?.style.setProperty('--yt-live-chat-flusher-font-size', Math.floor(g.layer.getBoundingClientRect().height * .8 / lines).toString() + 'px');
				}
				for (const [key, values] of Object.entries(g.storage.parts)) {
					if (values) {
						for (const [prop, bool] of Object.entries(values)) {
							if (prop !== 'color') {
								g.layer?.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-display-${prop}`, bool ? 'inherit' : 'none');
							} else {
								if (bool) {
									g.layer?.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-color`, `${bool}`);
								} else {
									g.layer?.style.removeProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-color`);
								}
							}
						}
					}
				}
				/** @type { [ string, number, number ][] } */
				const colormap = [
					['--yt-live-chat-normal-message-background-color', 0xffc0c0c0, -1],
					['--yt-live-chat-member-message-background-color', 0xffc0c0c0, -1],
					['--yt-live-chat-moderator-message-background-color', 0xffc0c0c0, -1],
					['--yt-live-chat-owner-message-background-color', 0xffc0c0c0, -1],
					['--yt-live-chat-paid-sticker-background-color', 0xffffb300, -1],
					['--yt-live-chat-author-chip-owner-background-color', 0xffffd600, -1],
				];
				colormap.forEach(([name, rgb, alpha]) => {
					g.layer?.style.setProperty(name, `rgba(${getColorRGB(rgb).join()},${alpha < 0 ? 'var(--yt-live-chat-flusher-background-opacity)' : alpha})`);
				});
			}).then(() => {
				addSettingMenu();
			});
		}
	} else if (location.pathname === '/watch') {
		document.addEventListener('yt-action', e => {
			switch (e.detail.actionName) {
				case 'ytd-watch-player-data-changed': {
					const layer = document.getElementById(g.id);
					if (layer) {
						layer.innerHTML = '';
					}
				}
			}
		}, { passive: true });
	}
}

function getLayer() {
	const oldOne = g.app?.querySelector(`#${g.id}`);
	if (oldOne) {
		oldOne.innerHTML = '';
		return /** @type {HTMLElement} */ (oldOne);
	} else {
		const newOne = document.createElement('div');
		newOne.id = g.id;
		newOne.dataset.layer = '1';
		newOne.setAttribute('role', 'marquee');
		newOne.setAttribute('aria-live', 'off');
		return newOne;
	}
}

function getPanel() {
	const oldOne = g.app?.querySelector(`#${g.id}-panel`);
	if (oldOne) {
		oldOne.innerHTML = '';
		return /** @type {HTMLElement} */ (oldOne);
	} else {
		const newOne = document.createElement('div');
		newOne.id = g.id + '-panel';
		newOne.className = 'html5-video-info-panel';
		newOne.dataset.layer = '4';
		newOne.hidden = true;
		newOne.style.display = 'none';
		return newOne;
	}
}

function startLiveChatFlusher() {
	if (!g.app) return;
	const video = g.app.querySelector('video');
	const videoContainer = g.app.querySelector('video')?.parentElement;
	
	if (video && videoContainer) {
		g.layer = getLayer();
		videoContainer.insertAdjacentElement('afterend', g.layer);
		
		const timer = setInterval(() => {
			const /** @type {HTMLElement?} */ renderer = document.querySelector('yt-live-chat-renderer');
			if (renderer) {
				clearInterval(timer);
				renderer.addEventListener('yt-action', handleYtAction, { passive: true });
				video.addEventListener('pause', () => {
					g.layer?.classList.add('paused');
				}, { passive: true });
				video.addEventListener('play', () => {
					g.layer?.classList.remove('paused');
				}, { passive: true });
			}
		}, 1000);
	}
}

function addSettingMenu() {
	if (!g.app) return;
	g.panel = getPanel();
	const checkbox = g.app.querySelector(`#${g.id}-checkbox`), popupmenu = g.app.querySelector(`#${g.id}-popupmenu`);
	if (checkbox && popupmenu) {
		checkbox.remove(), popupmenu.remove();
	}
	/** @type {HTMLElement?} */
	const ytpPanelMenu = g.app.querySelector('#ytp-id-17 .ytp-panel .ytp-panel-menu');
	if (ytpPanelMenu) {
		const checkbox = document.createElement('div'), popupmenu = document.createElement('div');
		checkbox.id = g.id + '-checkbox', popupmenu.id = g.id + '-popupmenu';
		checkbox.className = popupmenu.className = 'ytp-menuitem';
		checkbox.tabIndex = popupmenu.tabIndex = 0;
		checkbox.setAttribute('role', 'menuitemcheckbox'), popupmenu.setAttribute('role', 'menuitem');
		checkbox.setAttribute('aria-checked', 'true'), popupmenu.setAttribute('aria-haspopup', 'true');
		checkbox.onclick = e => {
			const checked = checkbox.getAttribute('aria-checked') === 'true';
			checkbox.setAttribute('aria-checked', (!checked).toString());
			if (checked) {
				if (g.layer) {
					g.layer.hidden = true;
					g.layer.setAttribute('aria-hidden', 'true');
				}
			} else {
				if (g.layer) {
					g.layer.hidden = false;
					g.layer.setAttribute('aria-hidden', 'false');
				}
				browser.runtime.reload();
			}
		};
		checkbox.innerHTML = `<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -40 80 80"><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0M0,-24Q8,-24,24,-23,31,-22,31,-19,32,-12,32,0" fill="none" stroke="white" stroke-width="3"/><g fill="white" transform="translate(0,10)"><path d="M4,-10l12,12h8l-12,-12,12,-12h-8z"/><circle r="3"/><circle cx="-10" r="3"/><circle cx="-20" r="3"/></g></svg></div><div class="ytp-menuitem-label">${getMessage('ytp-menuitem-label-switch')}</div><div class="ytp-menuitem-content"><div class="ytp-menuitem-toggle-checkbox"></div></div></div>`;
		popupmenu.onclick = e => {
			if (g.panel) {
				g.panel.hidden = !g.panel.hidden;
				g.panel.style.display = g.panel.style.display === 'none' ? 'block' : 'none';
			}
		};
		popupmenu.innerHTML = `<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -64 108 108"><mask id="m"><path d="M-40-80h120v120h-120z" fill="white" /><circle r="9"/></mask><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0" fill="none" stroke="white" stroke-width="4"/><g fill="white" transform="translate(0,10)"><circle cx="8" r="3"/><circle cx="-4" r="3"/><circle cx="-16" r="3"/><g transform="translate(32,-32) scale(1.25)" mask="url(#m)"><path id="p" d="M0,0L-10,-8L-6,-24Q0,-26,6,-24L10,-8L-10,8L-6,24Q0,26,6,24L10,8z"/><use xlink:href="#p" transform="rotate(60)"/><use xlink:href="#p" transform="rotate(120)"/></g></g></svg></div><div class="ytp-menuitem-label">${getMessage('ytp-menuitem-label-config')}</div><div class="ytp-menuitem-content"></div>`;
		ytpPanelMenu.append(checkbox, popupmenu);
	}
	if (!g.layer) g.layer = getLayer();
	g.layer.after(g.panel);
	g.panel.onkeydown = e => {
		e.stopPropagation();
	};
	const styles = getComputedStyle(g.layer);
	const closeBtn = document.createElement('button');
	closeBtn.className = 'html5-video-info-panel-close ytp-button';
	closeBtn.title = getMessage('close');
	closeBtn.textContent = '[x]';
	closeBtn.onclick = () => {
		if (g.panel) {
			g.panel.hidden = true;
			g.panel.style.display = 'none';
		}
	};
	const form = document.createElement('form');
	form.className = 'html5-video-info-panel-content';
	form.insertAdjacentHTML('beforeend', [
		[
			`<div>${getMessage('animation_duration')}</div>`,
			`<div><label><input type="number" class="styles" name="animation_duration" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.animation_duration) || 4}" data-unit="s"> s</label></div>`,
		],
		[
			`<div>${getMessage('font_size')}</div>`,
			`<div><label><input type="number" class="styles" name="font_size" min="12" size="5" value="${parseInt(g.storage.styles.font_size) || 36}" data-unit="px"> px</label> / <label><input type="checkbox" name="lines"><input type="number" name="number_of_lines" min="6" size="5" value="${g.storage.others.number_of_lines || 20}">${getMessage('lines')}</label></div>`,
		],
		[
			`<div>${getMessage('layer_opacity')}</div>`,
			`<div>${getMessage('opacity_0')}<input type="range" class="styles" name="layer_opacity" min="0" max="1" step="0.1" value="${parseFloat(g.storage.styles.layer_opacity) || 1}">${getMessage('opacity_1')}</div>`,
		],
		[
			`<div>${getMessage('background_opacity')}</div>`,
			`<div>${getMessage('opacity_0')}<input type="range" class="styles" name="background_opacity" min="0" max="1" step="0.1" value="${parseFloat(g.storage.styles.background_opacity) || 0.5}">${getMessage('opacity_1')}</div>`,
		],
		[
			`<div>${getMessage('simultaneous_message')}</div>`,
			`<div><select name="simultaneous"><option value="0">${getMessage('simultaneous_message_0')}</option><option value="1">${getMessage('simultaneous_message_1')}</option><option value="2">${getMessage('simultaneous_message_2')}</option></select>▼</div>`
		],
		[
			`<div>${getMessage('emoji_expression')}</div>`,
			`<div><select name="emoji"><option value="0">${getMessage('emoji_expression_0')}</option><option value="1">${getMessage('emoji_expression_1')}</option><option value="2">${getMessage('emoji_expression_2')}</option><option value="3">${getMessage('emoji_expression_3')}</option></select>▼</div>`
		],
		[
			`<div>${getMessage('normal')}</div>`,
			`<div><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="normal_display" value="photo"><svg viewBox="-8 -8 16 16"><g id="yt-lcf-photo"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></g></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="normal_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="normal_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
			`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="normal_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="normal_color"></div>`,
		],
		[
			`<div>${getMessage('member')}</div>`,
			`<div><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="member_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="member_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="member_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
			`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="member_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="member_color"></div>`,
		],
		[
			`<div>${getMessage('moderator')}</div>`,
			`<div><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="moderator_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="moderator_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="moderator_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
			`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="moderator_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="moderator_color"></div>`,
		],
		[
			`<div>${getMessage('owner')}</div>`,
			`<div><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="owner_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="owner_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="owner_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
			`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="owner_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="owner_color"></div>`,
		],
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
			`<div>${getMessage('new_membership')}</div>`,
			`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="new_membership_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="new_membership_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle body" title="${getMessage('tooltip-new_membership_message')}"><input type="checkbox" name="new_membership_display" value="message"><span>${getMessage('display-new_membership_message')}</span></label></div>`,
			`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="new_membership_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="new_membership_color"></div>`,
		],
		[
			`<div>${getMessage('milestone')}</div>`,
			`<div class="superchat"><label class="toggle photo" title="${getMessage('tooltip-author_photo')}"><input type="checkbox" name="milestone_display" value="photo"><svg viewBox="-8 -8 16 16"><use xlink:href="#yt-lcf-photo"/></svg></label><label class="toggle name" title="${getMessage('tooltip-author_name')}"><input type="checkbox" name="milestone_display" value="name"><span>${getMessage('display-author_name')}</span></label><label class="toggle amount" title="${getMessage('tooltip-milestone_months')}"><input type="checkbox" name="milestone_display" value="months"><span>${getMessage('display-milestone_months')}</span></label><br><label class="toggle body" title="${getMessage('tooltip-chat_message')}"><input type="checkbox" name="milestone_display" value="message"><span>${getMessage('display-chat_message')}</span></label></div>`,
			`<div><label title="${getMessage('tooltip-custom_color')}"><input type="checkbox" name="milestone_display" value="color">${getMessage('display-custom_color')}</label><input type="color" name="milestone_color"></div>`,
		],
	].map(row => '<div>' + row.join('') + '</div>').join(''));
	const selects = form.querySelectorAll('select');
	selects.forEach(select => {
		if (select.name in g.storage.others) {
			const val = g.storage.others[select.name];
			select.selectedIndex = val;
		}
	});
	const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[type="checkbox"]'));
	checkboxes.forEach(checkbox => {
		const match = checkbox.name.match(/^(.+)_display$/);
		if (match) {
			const [_, type] = match;
			if (type in g.storage.parts) {
				checkbox.checked = g.storage.parts[type][checkbox.value];
				switch (checkbox.value) {
					case 'name': {
						const div = /** @type {HTMLDivElement} */ (checkbox.closest('div'));
						if (checkbox.checked) {
							div.classList.add('outlined');
						}
						checkbox.onchange = () => {
							div.classList[checkbox.checked ? 'add' : 'remove']('outlined');
						};
						break;
					}
					case 'color': {
						const picker = /** @type {HTMLInputElement?} */ (checkbox.parentElement?.nextElementSibling);
						if (picker) {
							picker.value = g.storage.parts[type].color || formatHexColor(styles.getPropertyValue('--yt-live-chat-flusher-' + picker.name.replace(/_/g, '-')));
						}
						break;
					}
				}
			}
		} else if (checkbox.name === 'lines') {
			checkbox.checked = g.storage.others['number_of_lines'] > 0;
			form.font_size.disabled = checkbox.checked;
			form.number_of_lines.disabled = !checkbox.checked;
		}
	});
	form.addEventListener('change', e => {
		const elem = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
		const name = elem.name;
		if (elem instanceof HTMLSelectElement) {
			if (name in g.storage.others) {
				g.storage.others[name] = parseInt(elem.value);
			}
		} else if (elem.classList.contains('styles')) {
			if (name) {
				g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
				g.layer?.style.setProperty('--yt-live-chat-flusher-' + name.replace(/_/g, '-'), g.storage.styles[name]);
			}
		} else if (name.endsWith('_display')) {
			const match = name.match(/^(.+)_display$/);
			if (match) {
				const [_, type] = match;
				if (type in g.storage.parts) {
					if (elem.value !== 'color') {
						g.storage.parts[type][elem.value] = elem.checked;
						g.layer?.style.setProperty('--yt-live-chat-flusher-' + name.replace(/_/g, '-') + '-' + elem.value, elem.checked ? 'inherit' : 'none');
					} else {
						if (elem.checked) {
							g.storage.parts[type].color = form.elements[type + '_color']?.value;
							g.layer?.style.setProperty('--yt-live-chat-flusher-' + type.replace(/_/g, '-') + '-color', g.storage.parts[type].color || 'inherit');
						} else {
							g.storage.parts[type].color = null;
							g.layer?.style.removeProperty('--yt-live-chat-flusher-' + type.replace(/_/g, '-') + '-color');
						}
					}
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
		} else if (['lines', 'number_of_lines'].includes(name)) {
			const checked = form.lines.checked;
			form.font_size.disabled = checked;
			form.number_of_lines.disabled = !checked;
			g.storage.others.number_of_lines = checked ? form.number_of_lines.valueAsNumber : 0;
			g.layer?.style.setProperty('--yt-live-chat-flusher-font-size', (checked ? Math.floor(g.layer.getBoundingClientRect().height * .8 / form.number_of_lines.valueAsNumber).toString() : form.font_size.value) + 'px');
		}
		browser.storage.local.set(g.storage);
	}, { passive: true });
	g.panel.insertAdjacentElement('beforeend', closeBtn);
	g.panel.insertAdjacentElement('beforeend', form);
}

/**
 * 
 * @param {CustomEvent<{ actionName: string, args: any[][] }>} e 
 */
function handleYtAction(e) {
	switch (e.detail.actionName) {
		case 'yt-live-chat-actions': {
			if (document.visibilityState === 'hidden' || g.layer?.hidden || g.layer?.classList.contains('paused')) {
				break;
			}
			const actions = e.detail.args[0];
			const bodies = [];
			const ids = [];
			action: for (const action of actions) {
				const elem = handleChatAction(action);
				if (elem) {
					simultaneous: switch (g.storage.others.simultaneous) {
						case g.enum.SIMULTANEOUS_ALL: break simultaneous;
						case g.enum.SIMULTANEOUS_FIRST: break action;
						case g.enum.SIMULTANEOUS_MERGE: {
							const body = elem.querySelector('span.body');
							if (body) {
								const html = body.outerHTML;
								const index = bodies.indexOf(html);
								if (index < 0) {
									bodies.push(html);
									ids.push(elem.id);
								} else {
									const /** @type {HTMLElement?} */ targetElem = g.layer?.querySelector('#' + ids[index]) || null;
									const /** @type {HTMLElement?} */ header = elem.querySelector('span.header');
									if (targetElem && header) {
										targetElem.querySelector('span.body')?.before(header);
										targetElem.style.setProperty('--yt-live-chat-flusher-translate-x', `-${(g.layer?.clientWidth || 720) + targetElem.clientWidth}px`);
										elem.remove();
									}
								}
							}
						}
					}
				}
			}
			break;
		}
		case 'yt-live-chat-pause-replay': {
			g.layer?.classList.add('paused');
			break;
		}
		case 'yt-live-chat-resume-replay': {
			g.layer?.classList.remove('paused');
			break;
		}
	}
}

/**
 * 
 * @param { {
 * addBannerToLiveChatCommand?: *,
 * addChatItemAction?: *,
 * addLiveChatTickerItemAction?: *,
 * markChatItemAsDeletedAction?: *,
 * markChatItemsByAuthorAsDeletedAction?: *,
 * replaceChatItemAction?: *,
 * } } action 
 * @returns 
 */
function handleChatAction(action) {
	if (action.addChatItemAction) {
		const item = action.addChatItemAction.item;
		const fs = parseInt(g.storage.styles.font_size) || 36, lh = fs * 1.25;
		const elem = parseChatItem(item);
		if (elem && g.layer) {
			const children = Array.from(/** @type {HTMLCollectionOf<HTMLElement>} */ (g.layer.children));
			elem.onanimationend = () => {
				elem.remove();
			};
			g.layer.insertAdjacentElement('beforeend', elem);
			if (elem.clientWidth >= g.layer.clientWidth) {
				elem.classList.add('multiline');
			}
			elem.style.setProperty('--yt-live-chat-flusher-translate-x', `-${g.layer.clientWidth + elem.clientWidth}px`);
			let y = 0;
			const overline = Math.ceil(g.layer.clientHeight / lh);
			do {
				if (children.length > 0) {
					elem.style.top = `${y * 1.25}em`;
					if (!children.some(before => isCatchable(before, elem)) && !isOverflow(g.layer, elem)) {
						return elem;
					}
				} else {
					elem.style.top = '0px';
					return elem;
				}
			} while (y++ < overline);
			do {
				const tops = children.map(child => child.offsetTop);
				const lines = new Array(y).fill(0);
				tops.forEach(v => {
					lines[v / lh]++;
				});
				let ln = -1, i = 0;
				do {
					ln = lines.indexOf(i++);
				} while (ln < 0);
				elem.style.top = `${ln * 1.25}em`;
			} while (isOverflow(g.layer, elem) && y-- > 0);
			return elem;
		}
	} else if (action.markChatItemAsDeletedAction) {
		g.layer?.querySelector('#' + action.markChatItemAsDeletedAction.targetItemId)?.remove();
	} else if (action.markChatItemsByAuthorAsDeletedAction) {
		g.layer?.querySelectorAll(`[data-channel="${action.markChatItemsByAuthorAsDeletedAction.externalChannelId}"]`).forEach(elem => elem.remove());
	} else if (action.replaceChatItemAction) {
		const target = g.layer?.querySelector('#' + action.replaceChatItemAction.targetItemId);
		if (target) {
			const item = action.replaceChatItemAction.replacementItem;
			const elem = parseChatItem(item);
			if (elem) {
				target.replaceWith(elem);
			}
		}
	}
	return null;
}

const parser = {
	/**
	 * @param { LiveChat.Runs | LiveChat.SimpleText | undefined } message
	 * @param {number} startIndex
	 * @param {number} endIndex
	 */
	message(message, startIndex = 0, endIndex = 0) {
		if (message) {
			if ('runs' in message) {
				const runs = startIndex || endIndex ? message.runs.slice(startIndex, endIndex || undefined) : message.runs;
				return runs.map(r => {
					if ('text' in r) {
						return r.bold ? `<b>${r.text}</b>` : r.text;
					} else if (g.storage.others.emoji) {
						switch (g.storage.others.emoji) {
							case g.enum.EMOJI_ALL: {
								const thumbnail = r.emoji.image.thumbnails.slice(-1)[0];
								return thumbnail ? `<img class="emoji" src="${thumbnail.url}">` : `<span class="emoji">${r.emoji.emojiId}</span>`;
							}
							case g.enum.EMOJI_LABEL: {
								return `<span class="emoji">${r.emoji.image.accessibility.accessibilityData.label}</span>`;
							}
							case g.enum.EMOJI_SHORTCUT: {
								return `<span class="emoji">${r.emoji.shortcuts[0]}</span>`;
							}
						}
					}
				}).join('');
			} else {
				const text = startIndex || endIndex ? message.simpleText.slice(startIndex, endIndex || undefined): message.simpleText;
				return text;
			}
		} else {
			return '';
		}
	},
	/**
	 * @param {LiveChat.RendererContent} renderer
	 */
	author(renderer) {
		return {
			id: renderer.authorExternalChannelId,
			class: renderer.authorBadges?.map(b => b.liveChatAuthorBadgeRenderer.customThumbnail ? 'member' : b.liveChatAuthorBadgeRenderer.icon?.iconType.toLowerCase()),
			name: renderer.authorName.simpleText,
			photo: renderer.authorPhoto.thumbnails,
		};
	},
};

/**
 * 
 * @param {LiveChat.AnyRenderer} item 
 */
function parseChatItem(item) {
	if ('liveChatTextMessageRenderer' in item) {
		const renderer = item.liveChatTextMessageRenderer;
		const message = parser.message(renderer.message);
		const author = parser.author(renderer);
		const span = document.createElement('span');
		span.id = renderer.id;
		const authorType = author.class ? author.class.join(' ') : 'normal';
		span.className = 'text ' + authorType;
		span.dataset.author = author.name;
		span.dataset.channel = author.id;
		span.innerHTML = `<span class="header"><img class="photo" src="${author.photo[0].url}" loading="lazy"><span class="name">${author.name}</span></span><span class="body ${authorType}">${message}</span>`;
		return span;
	} else if ('liveChatMembershipItemRenderer' in item) {
		const renderer = item.liveChatMembershipItemRenderer;
		const message = parser.message(renderer.message);
		const author = parser.author(renderer);
		const div = document.createElement('div');
		div.id = renderer.id;
		div.dataset.author = author.name;
		div.dataset.channel = author.id;
		const headerText = (() => {
			if (renderer.headerPrimaryText) {
				div.className = 'milestone';
				return parser.message(renderer.headerPrimaryText, 1);
			} else {
				div.className = 'newmember';
				return renderer.headerSubtext ? parser.message(renderer.headerSubtext) : '';
			}
		})();
		div.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-live-chat-flusher-background-opacity));">\
<img class="photo" src="${author.photo[0].url}" loading="lazy">\
<span class="name">${author.name}</span>\
<span class="months">${headerText}</span>\
</div><div class="body" style="background-color:rgba(${getColorRGB(0xff0a8043).join()},var(--yt-live-chat-flusher-background-opacity));">${message}</div>`;
		return div;
	} else if ('liveChatPaidMessageRenderer' in item) {
		const renderer = item.liveChatPaidMessageRenderer;
		const message = parser.message(renderer.message);
		const author = parser.author(renderer);
		const div = document.createElement('div');
		div.id = renderer.id;
		div.className = 'paid';
		div.dataset.author = author.name;
		div.dataset.channel = author.id;
		div.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.headerBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">\
<img class="photo" src="${author.photo[0].url}" loading="lazy">\
<span class="name">${author.name}</span>\
<span class="amount">${renderer.purchaseAmountText.simpleText}</span>\
</div><div class="body" style="background-color:rgba(${getColorRGB(renderer.bodyBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">${message}</div>`;
		return div;
	} else if ('liveChatPaidStickerRenderer' in item) {
		const renderer = item.liveChatPaidStickerRenderer;
		const author = parser.author(renderer);
		const sticker = renderer.sticker.thumbnails.find(t => 2 * 36 <= t.width) || renderer.sticker.thumbnails.pop();
		const div = document.createElement('div');
		div.id = renderer.id;
		div.className = 'sticker';
		div.dataset.author = author.name;
		div.dataset.channel = author.id;
		div.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.backgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">\
<img class="photo" src="${author.photo[0].url}" loading="lazy">\
<span class="name">${author.name}</span>\
<span class="amount">${renderer.purchaseAmountText.simpleText}</span>\
</div>` + (sticker ? `<figure class="body" style="background-color:rgba(${getColorRGB(renderer.moneyChipBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity)">\
<img src="${sticker.url}"></figure>` : '');
		return div;
	} else if ('liveChatViewerEngagementMessageRenderer' in item) {
		// TODO: POLL
		const renderer = item.liveChatViewerEngagementMessageRenderer;
		console.log(renderer);
		if (renderer.icon.iconType === 'POLL') {
			const message = parser.message(renderer.message);
			const div = document.createElement('div');
			div.id = renderer.id;
			div.className = 'engagement-poll';
			div.innerHTML = `<div class="body">${message.replace('\n', '<br>')}</div>`;
			return div;
		}
	}
}

/**
 * 
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
 * 
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
 * 
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