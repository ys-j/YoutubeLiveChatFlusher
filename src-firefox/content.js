/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';
// @ts-ignore
var browser = browser || chrome;
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
	layer: /** @type {LiveChatLayer?} */ (null),
	/** @type {import('./utils.js').LiveChatPanel?} */
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
			layer_css: '',
		},
		others: {
			disabled: 0,
			px_per_sec: 0,
			number_of_lines: 0,
			type_of_lines: 0,
			wrap: 1,
			limit: 0,
			container_limit: 0,
			simultaneous: 2,
			emoji: 1,
			overlapping: 0,
			direction: 0,
			translation: 0,
			except_lang: 0,
			autostart: 0,
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
			'': '',
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
	},
	path: {
		live_chat: ['live_chat', 'live_chat_replay'],
		watch: ['watch', 'live'],
	},
};

class LiveChatLayer {
	limit = 0;
	element;
	root;
	/** @param div {?HTMLDivElement | undefined} */
	constructor(div = undefined) {
		this.element = div || document.createElement('div');
		this.element.id = g.tag.layer;
		this.element.dataset.layer = '1';
		this.element.setAttribute('role', 'marquee');
		this.element.setAttribute('aria-live', 'off');
		const resizeObserver = new ResizeObserver(() => {
			this.resetAnimationDuration();
			this.resetFontSize();
		});
		resizeObserver.observe(this.element);
		this.root = this.element.shadowRoot || this.element.attachShadow({ mode: 'open' });
		this.init();
	}
	init() {
		this.root.innerHTML = '';
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = browser.runtime.getURL('layer.css');
		const styles = ['customcss', 'yourcss', 'userdefinedcss'].map(id => {
			const element = document.createElement('style');
			element.id = id;
			return element;
		});
		this.root.append(link, ...styles);
		const mutationObserver = new MutationObserver(() => {
			const over = this.root.childElementCount - (this.limit || Infinity);
			let i = 4; // link + styles(3)
			while (i++ < over) styles[length - 1].nextElementSibling?.remove();
		});
		mutationObserver.observe(this.root, { childList: true });
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
	/** @param {string} [type] */
	updateCurrentItemStyle(type = undefined) {
		const items = Array.from(this.root.children).filter(type ? c => c.classList.contains(type) : c => c.tagName === 'DIV');
		/** @type {HTMLElement[]} */ (items).forEach(updateCurrentItem);
	}
}

import(browser.runtime.getURL('utils.js')).then(utils => {
	/** @type import('./utils.js') } */
	const { $msg, escapeHtml, getColorRGB, updateMutedWordsList, LiveChatPanel } = utils;

	detectPageType();
	window.addEventListener('yt-navigate-finish', detectPageType, { passive: true });

	function detectPageType() {
		const selfPath1 = location.pathname.split('/')[1];
		const topPath1 = top?.location.pathname.split('/')[1] || 'never';
		if (g.path.live_chat.includes(selfPath1) && top && g.path.watch.includes(topPath1)) {
			g.app = top.document.querySelector('#ytd-player');
			if (g.app) {
				const storageList = ['styles', 'others', 'parts', 'cssTexts', 'hotkeys', 'mutedWords'];
				browser.storage.local.get(storageList).then(storage => {
					for (const type of storageList) {
						if (storage && storage[type]) {
							for (const [key, value] of Object.entries(storage[type])){
								g.storage[type][key] = value;
							}
						}
					}
				}).then(() => {
					startLiveChatFlusher();
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
						const customCss = le.shadowRoot?.querySelector('#customcss');
						if (customCss) customCss.textContent = Object.entries(g.storage.cssTexts).map(([selector, css]) => selector ? `:host>${selector}{${css}}` : '').join('');
						const userDefinedCss = le.shadowRoot?.querySelector('#userdefinedcss');
						if (userDefinedCss) userDefinedCss.textContent = g.storage.cssTexts[''] || '';
						const dir = g.storage.others.direction;
						if (dir) {
							le.classList[0b01 & dir ? 'add': 'remove']('direction-reversed-y');
							le.classList[0b10 & dir ? 'add': 'remove']('direction-reversed-x');
						}
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
					if (g.layer) g.layer.element.style.cssText += '--yt-lcf-layer-css: below;' + g.storage.styles.layer_css;
				});
				createContainerObserver();
			}
		} else if (g.path.watch.includes(selfPath1)) {
			document.addEventListener('yt-action', e => {
				switch (e.detail?.actionName) {
					case 'ytd-watch-player-data-changed': {
						/** @type {HTMLDivElement?} */
						const layer = document.querySelector('#' + g.tag.layer);
						if (layer) new LiveChatLayer(layer).init();
						/** @type {HTMLDivElement?} */
						const panel = document.querySelector('#' + g.tag.panel);
						if (panel) new LiveChatPanel(panel).hide();
						checkAutoStart();
					}
				}
			}, { passive: true });
			checkAutoStart();
		}
	}

	function startLiveChatFlusher() {
		if (!g.app) return;
		const video = g.app.querySelector('video');
		const videoContainer = video?.parentElement;
		
		if (video && videoContainer) {
			const current = g.app.querySelector('#' + g.tag.layer);
			if (current) current.remove();
			g.layer = getLayer();
			if (g.storage.others.disabled) g.layer.hide();
			videoContainer.insertAdjacentElement('afterend', g.layer.element);
			
			const timer = setInterval(() => {
				const /** @type {HTMLElement?} */ renderer = document.querySelector(g.tag.chat);
				if (renderer) {
					clearInterval(timer);
					renderer.addEventListener('yt-action', handleYtAction, { passive: true });
					renderer.addEventListener('yt-load-reload-continuation', () => {
						skipRenderingOnce();
						createContainerObserver(renderer);
					}, { passive: true });
				}
			}, 1000);
		}
		
		setYourCss();
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
				'aria-checked': g.storage.others.disabled ? 'false' : 'true',
			},
			{
				id: g.tag.popupmenu,
				role: 'menuitem',
				'aria-haspopup': 'true',
			}
		];
		const htmls = [
			`<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -40 80 80"><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0M0,-24Q8,-24,24,-23,31,-22,31,-19,32,-12,32,0" fill="none" stroke="white" stroke-width="3"/><g fill="white" transform="translate(0,10)"><path d="M4,-10l12,12h8l-12,-12,12,-12h-8z"/><circle r="3"/><circle cx="-10" r="3"/><circle cx="-20" r="3"/></g></svg></div><div class="ytp-menuitem-label">${$msg('ytp_menuitem_label_switch')}</div><div class="ytp-menuitem-content"><div class="ytp-menuitem-toggle-checkbox"></div></div></div>`,
			`<div class="ytp-menuitem-icon"><svg height="24" width="24" viewBox="-40 -64 108 108"><mask id="m"><path d="M-40-80h120v120h-120z" fill="white" /><circle r="9"/></mask><path d="M0,24Q8,24,24,23,31,22,31,19,32,12,32,0M0,24Q-8,24,-24,23,-31,22,-31,19,-32,12,-32,0M0,-24Q-8,-24,-24,-23,-31,-22,-31,-19,-32,-12,-32,0" fill="none" stroke="white" stroke-width="4"/><g fill="white" transform="translate(0,10)"><circle cx="8" r="3"/><circle cx="-4" r="3"/><circle cx="-16" r="3"/><g transform="translate(32,-32) scale(1.25)" mask="url(#m)"><path id="p" d="M0,0L-10,-8L-6,-24Q0,-26,6,-24L10,-8L-10,8L-6,24Q0,26,6,24L10,8z"/><use xlink:href="#p" transform="rotate(60)"/><use xlink:href="#p" transform="rotate(120)"/></g></g></svg></div><div class="ytp-menuitem-label">${$msg('ytp_menuitem_label_config')}</div><div class="ytp-menuitem-content"></div>`,
		];
		/** @type { { [K in keyof GlobalEventHandlersEventMap]?: EventListener }[]} */
		const events = [ {
			click: e => {
				const cb = /** @type {HTMLElement?} */ (e.currentTarget);
				if (cb) {
					const checked = cb.getAttribute('aria-checked') === 'true';
					cb.setAttribute('aria-checked', (!checked).toString());
					g.layer?.init();
					g.layer?.[checked ? 'hide' : 'show']();
					g.storage.others.disabled = checked ? 1 : 0;
					browser.storage.local.set(g.storage);
				}
			},
		}, {
			click: _ => {
				panel[panel.element.hidden ? 'show' : 'hide']();
			},
		} ];
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
				for (const [k, v] of Object.entries(events[i])) menuitem.addEventListener(k, v, { passive: true });
				ytpPanelMenu.appendChild(menuitem);
			});
		}
		g.layer?.element.insertAdjacentElement('afterend', panel.element);
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
					elem.addEventListener('animationend', () => {
						elem.remove();
					}, { passive: true });
					const children = Array.from(/** @type {HTMLCollectionOf<HTMLElement>} */ (root.children)).filter(child => child.tagName === 'DIV');
					root.appendChild(elem);
					const ch = le.clientHeight, cw = le.clientWidth;
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
					const overline = Math.floor(ch / lh);
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
					} while (++y <= overline);

					elem.classList.add(`overlap`);
					const line = new Array(overline).fill(0), zIndex = new Array(overline).fill(0);
					for (let j = 0; j < children.length; j++) {
						const before = children[j];
						const overlapping = isOverlapping(before, elem);
						const ln = parseInt(before.dataset.line || '');
						if (Number.isInteger(ln)) {
							line[ln] = Math.max(overlapping, line[ln]);
							if (overlapping) zIndex[ln]--;
						}
					}
					y = 0;
					const st = g.storage.others.overlapping;
					const o = st & 0b01 ? .8 : 1;
					const dy = st & 0b10 ? .5 : 0;
					do {
						const min = Math.min(...line), max = Math.max(...line);
						y = min < max ? line.indexOf(min) : zIndex.indexOf(Math.max(...zIndex));
						if (y < 0) break;
						elem.style.top = `${(y + dy) * lhf}em`;
						elem.style.opacity = `${Math.max(.5, Math.pow(o, -zIndex[y] || 1))}`;
						elem.style.zIndex = zIndex[y];
						elem.dataset.line = `${y}`;
						line[y] = Infinity;
					} while (y && isOverflow(le, elem));
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
		const author = name ? `<a href="/channel/${renderer.authorExternalChannelId}" target="_blank" title="${name}"><img part="photo" class="photo" src="${renderer.authorPhoto.thumbnails[0].url}" loading="lazy"></a><span part="name" class="name">${name}</span>` : '';
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
			if (msg.src && msg.trans !== msg.orig) msg.trans = `<span data-srclang="${msg.src}">${msg.trans}</span>`;
		}
		switch (key) {
			case 'liveChatTextMessageRenderer': {
				const authorType = getAuthorType(renderer);
				if (Object.values(g.storage.parts[authorType]).includes(true)) {
					elem.className = 'text ' + authorType;
					elem.innerHTML = `<span class="header">${author}</span><span part="message" class="body">${msg.trans || msg.orig}</span>`;
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
					elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))">${author}<span part="months" class="months">${getChatMessage(primary || sub, { start: primary ? 1 : 0 })}</span></div><div part="message" class="body" style="background-color:rgba(${getColorRGB(0xff0a8043).join()},var(--yt-lcf-background-opacity))">${msg.trans || msg.orig}</div>`;
				} else {
					return null;
				}
				break;
			}
			case 'liveChatPaidMessageRenderer': {
				if (Object.values(g.storage.parts.paid_message).includes(true)) {
					elem.className = 'superchat';
					elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.headerBackgroundColor).join()},var(--yt-lcf-background-opacity))">${author}<span part="amount" class="amount">${getChatMessage(renderer.purchaseAmountText)}</span></div><div part="message" class="body" style="background-color:rgba(${getColorRGB(renderer.bodyBackgroundColor).join()},var(--yt-lcf-background-opacity))">${msg.trans || msg.orig}</div>`;
				} else {
					return null;
				}
				break;
			}
			case 'liveChatPaidStickerRenderer': {
				if (Object.values(g.storage.parts.paid_sticker).includes(true)) {
					elem.className = 'supersticker';
					elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.backgroundColor).join()},var(--yt-lcf-background-opacity))">${author}<span part="amount" class="amount">${getChatMessage(renderer.purchaseAmountText)}</span></div><figure part="sticker" class="body" style="background-color:rgba(${getColorRGB(renderer.moneyChipBackgroundColor).join()},var(--yt-lcf-background-opacity)"><img class="sticker" src="${(renderer.sticker.thumbnails.find(t => 2 * 36 <= (t.width || 36)) || renderer.sticker.thumbnails[0]).url}" loading="lazy"></figure>`;
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
					const author = name ? `<a href="/channel/${renderer.authorExternalChannelId}" target="_blank" title="${name}"><img part="photo" class="photo" src="${h.authorPhoto.thumbnails[0].url}" loading="lazy"></a><span part="name" class="name">${name}</span>` : '';
					const icon = document.querySelector('iron-iconset-svg #gift-filled');
					const count = h.primaryText?.runs?.filter(r => !Number.isNaN(parseInt(r.text)))[0]?.text;
					if (count) {
						const gifts = (icon ? `<svg viewBox="0 2 24 24" fill="currentColor" stroke="#000" paint-order="stroke">${icon.innerHTML}</svg>` : '🎁') + count;
						elem.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))">${author}<span part="gifts" class="gifts">${gifts}</span></div>`;
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
						elem.innerHTML = `<div part="message" class="body">${msg.trans || msg.orig}</div>`;
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
						if (filtered.result && filterMode === g.index.mutedWords.all) return '';
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
								const label = escapeHtml(r.emoji.image.accessibility.accessibilityData.label);
								const img = thumbnail ? `<img src="${thumbnail.url}" alt="${label}">` : r.emoji.emojiId;
								rslt += `<span class="emoji" data-label="${label}" data-shortcut="${escapeHtml(r.emoji.shortcuts?.[0] || '')}">${img}</span>`;
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
});

async function checkAutoStart() {
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
 * @param {Element} [renderer] 
 */
function createContainerObserver(renderer) {
	const io = new MutationObserver(records => {
		const children = records[0].target.childNodes;
		const limit = g.storage.others.container_limit;
		if (limit) while (children.length > limit) children[0].remove();
	});
	if (renderer) {
		const ro = new MutationObserver(records => {
			ro.disconnect();
			for (const r of records) {
				const t = /** @type {Element} */ (r.target);
				if (r.oldValue === '') {
					const items = t.querySelector('yt-live-chat-item-list-renderer #items');
					if (items) io.observe(items, { childList: true });
				} else {
					io.disconnect();
				}
			}
		});
		ro.observe(renderer, { attributes: true, attributeOldValue: true, attributeFilter: ['loading'] });
	} else {
		const items = document.querySelector('yt-live-chat-item-list-renderer #items');
		if (items) io.observe(items, { childList: true });
	}
}

function getLayer() {
	const layer = new LiveChatLayer();
	const le = layer.element;
	le.addEventListener('contextmenu', e => {
		const origin = /** @type {HTMLElement?} */ (e.composedPath().find(p => 'id' in p));
		if (origin) {
			e.preventDefault();
			e.stopPropagation();
			origin.classList.toggle('paused');
		}
	}, { passive: false });
	le.addEventListener('click', e => {
		const origin = /** @type {HTMLElement?} */ (e.composedPath()[0]);
		if (origin?.tagName === 'A') {
			e.stopPropagation();
		} else {
			/** @type {HTMLElement?} */ (e.target)?.parentElement?.click();
		}
	}, { passive: true });
	le.addEventListener('wheel', e => {
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

async function setYourCss() {
	return fetch('/account_advanced').then(r => r.text()).then(t => {
		const m = t.match(/"(UC[\w-]{22})"/);
		if (m) g.channel = m[1] || '';
		if (g.channel) {
			const style = g.layer?.element.shadowRoot?.querySelector('#yourcss');
			if (style) {
				const you = `[data-author-id="${g.channel}"]`;
				style.textContent = `${you}{color:var(--yt-lcf-you-color)}:host(.has-you-name) ${you}.text{background-color:var(--yt-live-chat-you-message-background-color);border-radius:.5em;padding:0 .25em}${you}.text .photo{display:var(--yt-lcf-you-display-photo)}${you}.text .name{display:var(--yt-lcf-you-display-name)}${you}.text .message{display:var(--yt-lcf-you-display-message)}`;
			}
		}
		return true;
	}).catch(() => {
		return false;
	});
}

/** @param {HTMLElement} item */
function updateCurrentItem(item) {
	if (!g.layer) return;
	const isLong = item.clientWidth >= g.layer.element.clientWidth * (parseInt(g.storage.styles.max_width) / 100 || 1);
	item.classList[isLong ? 'add' : 'remove']('wrap');
	item.style.setProperty('--yt-lcf-translate-x', `-${g.layer.element.clientWidth + item.clientWidth}px`);
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
 * @param {Element} before 
 * @param {Element} after 
 */
function isOverlapping(before, after) {
	const [b, a] = [before, after].map(elm => elm.getBoundingClientRect());
	const [bDur, aDur] = [before, after].map(elm => {
		const dur = getComputedStyle(elm).animationDuration;
		const [_, num, unit] = dur.match(/([\d\.]+)(\D+)/) || [];
		if (num && unit) switch (unit) {
			case 'ms': return parseFloat(num);
			case 's': return parseFloat(num) * 1000;
		}
		return parseFloat(g.storage.styles.animation_duration) * 1000 || 4000;
	});
	const bSpeed = b.width / bDur, aSpeed = a.width / aDur;
	const speedDiff = aSpeed - bSpeed;
	const start = (a.left - b.right) / speedDiff;
	const end = (a.right - b.left) / speedDiff;
	return end > start ? Math.min(Math.round(end - start), bDur) : 0;
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
					rule.lastIndex = 0;
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