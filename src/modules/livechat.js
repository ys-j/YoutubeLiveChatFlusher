/// <reference path="../../browser.d.ts" />
/// <reference path="../../extends.d.ts" />
/// <reference path="../../ytlivechatrenderer.d.ts" />

import { filterMessage, formatHexColor, getColorRGB, getText, isCatchable, isNotPip, isOverflow, Storage } from './utils.js';

const parser = new DOMParser();

export const g = {
	app: /** @type {HTMLElement?} */ (null),
	array: {
		hyphens: ['manual', 'auto', 'auto'],
		wordBreak: ['keep-all', 'normal', 'keep-all'],
		whiteSpace: ['pre', 'pre-line', 'pre-line'],
	},
	channel: '',
	index: {
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
	storage: Storage.DEFAULT,
	list: {
		/** @type {RegExp[]} */
		mutedWords: [],
	},
	path: {
		live_chat: ['live_chat', 'live_chat_replay'],
		watch: ['watch', 'live'],
	},
};

/**
 * @typedef {typeof g.index.simultaneous[keyof typeof g.index.simultaneous]} SimultaneousModeEnum
 * @typedef {typeof g.index.emoji[keyof typeof g.index.emoji]} EmojiModeEnum
 * @typedef {typeof g.index.mutedWords[keyof typeof g.index.mutedWords]} MutedWordModeEnum
 */

/**
 * Start app.
 * @param {HTMLElement} player YouTube player element
 */
export async function runApp(player) {
	g.app = player;

	const videoContainer = g.app?.querySelector('#ytd-player video')?.parentElement;
	if (!videoContainer) return Promise.reject('No video container element.');

	document.getElementById('ytlcf-panel')?.remove();
	const panel = new LiveChatPanel();
	g.panel = panel;

	// get storage data
	const storageList = ['styles', 'others', 'parts', 'cssTexts', 'hotkeys', 'mutedWords', 'translation'];
	const storage = await Storage.get(storageList);
	if (storage)
	for (const type of storageList) {
		if (storage[type]) {
			for (const [key, value] of Object.entries(storage[type])) {
				g.storage[type][key] = value;
			}
		}
	}
	const form = await panel.createForm();
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
	g.layer = getLayer();
	if (g.storage.others.disabled) g.layer.hide();
	videoContainer.after(g.layer.element);

	/** @type {Promise[]} */
	const promises = [];

	// fetching your channel ID and set styles for you
	promises.push(fetch('/account_advanced').then(res => res.text()).then(text => {
		const matches = text.match(/"(UC[\w-]{22})"/);
		g.channel = matches?.[1] || '';
		if (g.channel) {
			const style = g.layer?.root?.querySelector('#yourcss');
			if (style) {
				const you = `[data-author-id="${g.channel}"]`;
				style.textContent = `\
${you} { color: var(--yt-lcf-you-color) }
:host(.has-you-name) ${you}.text { background-color: var(--yt-live-chat-you-message-background-color); border-radius: .5em; padding: 0 .25em }
${you}.text .photo { display: var(--yt-lcf-you-display-photo) }
${you}.text .name { display: var(--yt-lcf-you-display-name) }
${you}.text .message { display: var(--yt-lcf-you-display-message) }`
			}
		}
	}));
	updateMutedWordsList();
	setupPanel();
	promises.push(addSettingMenu());
	if (g.layer) g.layer.element.style.cssText += '--yt-lcf-layer-css: below;' + g.storage.styles.layer_css;
	await Promise.allSettled(promises);
	self.dispatchEvent(new CustomEvent('ytlcf-ready'));
}

/**
 * Gets new chat layer.
 * @returns {LiveChatLayer} chat layer
 */
export function getLayer() {
	const layer = new LiveChatLayer();
	layer.root.addEventListener('contextmenu', e => {
		const origin = /** @type {HTMLElement?} */ (e.composedPath().find(p => 'id' in p));
		if (origin) {
			e.preventDefault();
			e.stopPropagation();
			if (origin.classList.contains('paused')) {
				displayContextMenu(/** @type {MouseEvent} */ (e), origin);
			} else {
				origin.classList.add('paused');
			}
		}
	}, { passive: false });
	layer.root.addEventListener('click', e => {
		const origin = /** @type {HTMLElement | undefined} */ (e.composedPath().at(0));
		const interactiveTags = ['A', 'BUTTON', 'INPUT', 'TEXTAREA'];
		if (interactiveTags.includes(origin?.tagName || 'BODY')) {
			e.stopPropagation();
		} else {
			/** @type {HTMLElement?} */ (e.target)?.parentElement?.click();
		}
	}, { passive: true });
	return layer;
}

/**
 * Displays the context menu for the given message element.
 * @param {MouseEvent} event mouse event object
 * @param {HTMLElement} target target message element
 */
async function displayContextMenu(event, target) {
	let contextmenu = document.getElementById('yt-lcf-contextmenu');
	if (!contextmenu) {
		contextmenu = document.createElement('div');
		contextmenu.id = 'yt-lcf-contextmenu';
		contextmenu.classList.add('ytp-popup', 'ytp-contextmenu');
		contextmenu.style.opacity = '0';
		document.body.appendChild(contextmenu);
		document.addEventListener('click', e => {
			const path = e.composedPath();
			if (contextmenu && !path.includes(contextmenu)) {
				contextmenu.style.opacity = '0';
			}
		}, { passive: true });
		contextmenu.addEventListener('transitionend', function(e) {
			if (e.propertyName === 'opacity' && this.style.opacity === '0') {
				this.style.display = 'none';
			}
		}, { passive: true });
	}
	while (contextmenu.firstChild) contextmenu.firstChild.remove();
	const url = browser.runtime.getURL('../templates/panel_contextmenu.html');
	const text = await fetch(url).then(res => res.text());
	const doc = parser.parseFromString(text, 'text/html');
	doc.querySelectorAll('[data-i18n]').forEach(e => {
		const key = /** @type {HTMLElement} */ (e).dataset.i18n;
		if (key) e.textContent = browser.i18n.getMessage(key);
	});
	contextmenu.append(...doc.body.childNodes);
	contextmenu.style.display = '';
	contextmenu.style.opacity = '1';
	const rects = Array.from(contextmenu.children, c => c.getBoundingClientRect());
	const width = Math.max(...rects.map(r => r.width));
	const height = rects.reduce((a, c) => a + c.height, 0);
	contextmenu.style.width = width ? width + 'px' : '';
	contextmenu.style.height = height ? height + 'px' : '';
	contextmenu.style.left = `${event.x}px`;
	contextmenu.style.top = `${event.y}px`;
	contextmenu.onclick = e => {
		loop:
		for (const el of e.composedPath()) {
			switch (/** @type {HTMLElement} */ (el).dataset?.menu) {
				case 'resume_animation':
					target.classList.remove('paused');
					break loop;
				case 'move_message':
					target.style.cursor = 'move';
					target.addEventListener('mousedown', e => {
						const [_, y] = (target.style.translate || '0 0').split(' ').map(v => Number.parseInt(v));
						const computedStyle = getComputedStyle(target);
						const speed = Number.parseInt(target.style.getPropertyValue('--yt-lcf-translate-x')) / Number.parseFloat(computedStyle.animationDuration);
						const x = speed * Number.parseFloat(computedStyle.animationDelay);
						const startX = e.x + x, startY = e.y - y;
						/** @type {(e: MouseEvent) => void} */
						const onmousemove = e => {
							target.style.translate = [0, e.y - startY].map(i => i + 'px').join(' ');
							target.style.animationDelay = ((startX - e.x) / speed).toFixed(3) + 's';
						};
						document.addEventListener('mousemove', onmousemove, { passive: true });
						document.addEventListener('mouseup', () => {
							target.style.cursor = '';
							document.removeEventListener('mousemove', onmousemove);
						}, { passive: true, once: true });
					}, { once: true });
					break loop;
				case 'copy_user_id':
					const clipboard = /** @type {HTMLTextAreaElement?} */ (document.getElementById('yt-lcf-clipboard'));
					if (clipboard) {
						clipboard.textContent = target.dataset.authorId || null;
						clipboard.select();
						document.execCommand('copy');
					}
					break loop;
				case 'hide_user':
					const authorId = target.dataset.authorId;
					const textarea = /** @type {HTMLTextAreaElement | undefined} */ (g.panel?.form.elements.user_defined_css);
					if (authorId && textarea) {
						textarea.value += `\ndiv[data-author-id="${authorId}"] { display: none !important }`;
						g.panel?.updateStorage(textarea);
					}
					target.remove();
					break loop;
				case contextmenu.id:
					return;
			}
		}
		contextmenu.style.opacity = '0';
	};
}

/**
 * Sets the panel up.
 */
export function setupPanel() {
	const le = /** @type {LiveChatLayer} */ (g.layer).element;
	le.after(/** @type {LiveChatPanel} */ (g.panel).element);
	
	const form = /** @type {LiveChatPanel} */ (g.panel).form;
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

	const selects = form.querySelectorAll('select');
	for (const select of selects) {
		if (select.name in g.storage.others) {
			/** @type {number} */
			const val = g.storage.others[select.name];
			select.selectedIndex = Math.abs(val);
			switch (select.name) {
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
	const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[type="checkbox"]'));
	for (const cb of checkboxes) {
		const match = cb.name.match(/^(.+)_display$/);
		if (match) {
			const [_, type] = match;
			if (type in g.storage.parts) {
				cb.checked = g.storage.parts[type][cb.value];
				switch (cb.value) {
					case 'color': {
						const saved = g.storage.parts[type].color;
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
					cb.checked = g.storage.others.px_per_sec > 0;
					/** @type {HTMLInputElement} */ (ctrls.animation_duration).disabled = cb.checked;
					/** @type {HTMLInputElement} */ (ctrls.px_per_sec).disabled = !cb.checked;
					break;
				}
				case 'lines': {
					cb.checked = g.storage.others.number_of_lines > 0;
					/** @type {HTMLInputElement} */ (ctrls.font_size).disabled = cb.checked;
					/** @type {HTMLInputElement} */ (ctrls.number_of_lines).disabled = !cb.checked;
					/** @type {HTMLInputElement} */ (ctrls.type_of_lines).disabled = !cb.checked;
					break;
				}
				case 'unlimited': {
					/** @type {HTMLInputElement} */ (ctrls.limit_number).disabled = cb.checked = g.storage.others.limit === 0;
					/** @type {LiveChatLayer} */ (g.layer).limit = g.storage.others.limit;
					break;
				}
				case 'container_unlimited': {
					/** @type {HTMLInputElement} */ (ctrls.container_limit_number).disabled = cb.checked = g.storage.others.container_limit === 0;
					break;
				}
				case 'overlapping':
				case 'direction': {
					const val = Number.parseInt(cb.value);
					cb.checked = g.storage.others[cb.name] & 1 << val ? true : false;
					break;
				}
				case 'prefix_lang': {
					cb.checked = g.storage.others.translation < 0;
					cb.disabled = /** @type {HTMLSelectElement} */ (ctrls.translation).selectedIndex === 0;
					le.classList[cb.checked ? 'add' : 'remove'](cb.name);
					break;
				}
				case 'except_lang': {
					const val = Number.parseInt(cb.value);
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

	for (const [prop, value] of Object.entries(g.storage.styles)) {
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
		? g.storage.others.px_per_sec
		: Math.round(le.getBoundingClientRect().width / /** @type {HTMLInputElement} */ (ctrls.animation_duration).valueAsNumber);
	/** @type {HTMLInputElement} */ (ctrls.limit_number).valueAsNumber = g.storage.others.limit || 100;
	/** @type {HTMLInputElement} */ (ctrls.container_limit_number).valueAsNumber = g.storage.others.container_limit || 20;
	/** @type {HTMLInputElement} */ (ctrls.time_shift).valueAsNumber = g.storage.others.time_shift || 0;
	/** @type {HTMLInputElement} */ (ctrls.time_shift).disabled = g.storage.others.mode_replay === 0;
	
	const lines = g.storage.others.number_of_lines;
	if (lines) {
		const sizeByLines = Math.floor(le.getBoundingClientRect().height * .8 / lines);
		
		const inputFs = /** @type {HTMLInputElement} */ (ctrls.font_size);
		const inputLn = /** @type {HTMLInputElement} */ (ctrls.number_of_lines);
		if (g.storage.others.type_of_lines > 0) {
			le.style.setProperty('--yt-lcf-font-size', `max(${g.storage.styles.font_size}, ${sizeByLines}px)`);
			inputFs.setAttribute('value', `${sizeByLines}`);
			inputLn.setAttribute('value', `${lines}`);
		} else {
			le.style.setProperty('--yt-lcf-font-size', `${sizeByLines}px`);
			inputLn.setAttribute('value', `${Storage.DEFAULT.others.number_of_lines}`);
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

	const customCss = g.layer?.root?.querySelector('#customcss');
	const userDefinedCss = g.layer?.root?.querySelector('#userdefinedcss');
	for (const [selector, css] of Object.entries(g.storage.cssTexts)) {
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
	const dir = g.storage.others.direction;
	if (dir) {
		le.classList[dir & 1 ? 'add': 'remove']('direction-reversed-y');
		le.classList[dir & 2 ? 'add': 'remove']('direction-reversed-x');
	}

	// layer CSS
	/** @type {HTMLInputElement} */ (ctrls.layer_css).value = g.storage.styles.layer_css;

	/** @type {HTMLInputElement} */ (ctrls.muted_words_replacement).value = g.storage.mutedWords.replacement;
	/** @type {HTMLTextAreaElement} */ (ctrls.muted_words_list).value = g.storage.mutedWords.plainList.join('\n');

}

/**
 * Adds setting menus to the video control.
 */
export async function addSettingMenu() {
	/** @type {HTMLElement | null | undefined} */
	const ytpPanelMenu = g.app?.querySelector('.ytp-settings-menu .ytp-panel-menu');
	if (ytpPanelMenu) {
		const url = browser.runtime.getURL('../templates/panel_menu.html');
		const text = await fetch(url).then(res => res.text());
		const doc = parser.parseFromString(text, 'text/html');
		const [checkbox, popupmenu, pipmenu] = doc.body.children;
		checkbox.setAttribute('aria-checked', g.storage.others.disabled ? 'false' : 'true');
		checkbox.addEventListener('click', e => {
			const cb = /** @type {HTMLElement?} */ (e.currentTarget);
			if (cb) {
				const checked = cb.getAttribute('aria-checked') === 'true';
				cb.setAttribute('aria-checked', (!checked).toString());
				g.layer?.clear();
				g.layer?.[checked ? 'hide' : 'show']();
				g.storage.others.disabled = checked ? 1 : 0;
				Storage.set(g.storage);
			}
		}, { passive: true });
		popupmenu.addEventListener('click', () => {
			const panel = g.panel;
			if (panel) panel[panel.element.hidden ? 'show' : 'hide']();
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
}

/**
 * Fires chat actions.
 * @param {LiveChat.LiveChatItemAction[]} actions chat actions
 */
export function doChatActions(actions) {
	if (!g.layer) return;
	const le = g.layer.element;
	const root = g.layer.root;
	if (!root || (isNotPip() && document.visibilityState === 'hidden') || le.hidden || le.parentElement?.classList.contains('paused-mode')) return;
	const filtered = {
		add: actions.filter(a => a && 'addChatItemAction' in a),
		delete: actions.filter(a => a && 'markChatItemAsDeletedAction' in a),
		delete_author: actions.filter(a => a && 'markChatItemsByAuthorAsDeletedAction' in a),
		replace: actions.filter(a => a && 'replaceChatItemAction' in a),
	};
	if (g.skip && filtered.add.length > 0) {
		g.skip = false;
		return;
	}
	
	// Add
	const fs = Number.parseInt(g.storage.styles.font_size) || 36;
	const lhf = Number.parseFloat(g.storage.styles.line_height) || 1.4;
	const lh = fs * lhf;
	const sv = g.storage.others.simultaneous, si = g.index.simultaneous;
	const last = sv === si.last_merge ? /** @type {HTMLElement?} */ (root.lastElementChild) : null;
	const bodies = last ? [ `<!-- ${last.className} -->` + (last.dataset.text || '') ] : [];
	const ids = last ? [last.id] : [];
	if (sv === si.first) {
		// @ts-ignore
		const notext = filtered.add.slice(1).filter(a => !a.addChatItemAction?.item.liveChatTextMessageRenderer);
		filtered.add.splice(1, Infinity, ...notext);
	}
	const adding = filtered.add.map(action => new Promise(async (resolve, reject) => {
		// @ts-ignore
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
		const dir = g.storage.others.direction & 1 ? 'bottom' : 'top';
		if (elem.clientHeight >= ch) {
			elem.style[dir] = '0px';
			elem.dataset.line = '0';
			return resolve(elem.id);
		}
		const overline = Math.floor(ch / lh);
		const reversed = (g.storage.others.direction & 2) > 0;
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
		const st = g.storage.others.overlapping;
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
 * Sets a flag to skip rendering the messages once.
 */
export function skipRenderingOnce() {
	g.skip = true;
}

/**
 * Creates a chat item element from the message renderer.
 * @param {LiveChat.AnyRenderer} item message renderer
 * @returns {Promise<HTMLDivElement | null>} promise of chat item element or null
 */
async function parseChatItem(item) {
	const key = Object.keys(item)[0];
	/** @type {LiveChat.RendererContent} */
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
	/** @type { { orig: Node[]?, trans: Node[]?, src: string } } */
	const msg = {
		orig: renderer.message ? getChatMessage(renderer.message) : null,
		trans: null,
		src: '',
	};
	const index = g.storage.others.translation;
	const nl = navigator.languages;
	const tl = ['', ...nl][Math.abs(index)];
	if (tl && msg.orig) {
		const el = nl.filter((_, i) => g.storage.others.except_lang & 1 << i);
		msg.trans = await Promise.all(msg.orig.map(async node => {
			const text = node.textContent;
			if (text) {
				if (g.storage.translation.regexp) {
					for (const rule of g.storage.translation.plainList) {
						const isMatches = new RegExp(rule).test(text);
						if (isMatches) return node;
					}
				} else {
					for (const rule of g.storage.translation.plainList) {
						const isMatches = text.includes(rule);
						if (isMatches) return node;
					}
				}
				const detection = await browser.i18n.detectLanguage(text);
				const sl = detection.languages[0]?.language;
				if (!el.includes(sl)) {
					const url = g.storage.translation.url.replace('$sl', detection.isReliable ? sl : 'auto').replace('$tl', tl).replace('$q', encodeURIComponent(text));
					/** @type { { sentences: { trans: string }[], src: string }? } */
					const json = await fetch(url).then(res => res.json());
					if (json && !el.includes(json.src)) {
						msg.src = json.src || '';
						node.textContent = json.sentences.map(s => s.trans).join('') || '';
					}
				}
			}
			return node;
		}));
		if (msg.src && msg.trans !== msg.orig) {
			const wrapper = document.createElement('span');
			wrapper.dataset.srclang = msg.src;
			wrapper.append(...msg.trans);
			msg.trans = [ wrapper ];
		}
	}
	switch (key) {
		case 'liveChatTextMessageRenderer': {
			const authorType = getAuthorType(renderer);
			const allHidden = !Object.values(g.storage.parts[authorType]).includes(true);
			if (allHidden) return null;
			elem.className = 'text ' + authorType;
			const header = document.createElement('span');
			header.className = 'header';
			header.appendChild(authorElems);
			const body = document.createElement('span');
			body.part = 'message';
			body.className = 'body';
			body.append(...(msg.trans || msg.orig || []));
			elem.append(header, body);
			elem.dataset.text = getText(renderer.message);
			return elem;
		}
		case 'liveChatMembershipItemRenderer': {
			const { headerPrimaryText: primary, headerSubtext: sub } 
				= /** @type {LiveChat.MembershipItemRenderer["liveChatMembershipItemRenderer"]} */ (renderer);
			const messageType = primary ? 'milestone' : 'membership';
			elem.className = messageType;
			const allHidden = !Object.values(g.storage.parts[messageType]).includes(true);
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
			body.append(...(msg.trans || msg.orig || []));
			elem.append(header, body);
			return elem;
		}
		case 'liveChatPaidMessageRenderer': {
			const allHidden = !Object.values(g.storage.parts.paid_message).includes(true);
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
			body.append(...(msg.trans || msg.orig || []));
			elem.append(header, body);
			return elem;
		}
		case 'liveChatPaidStickerRenderer': {
			const allHidden = !Object.values(g.storage.parts.paid_sticker).includes(true);
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
			const allHidden = !Object.values(g.storage.parts.membership).includes(true);
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
					elem.append(...(msg.trans || msg.orig || []));
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
 * Gets nodes of chat message from the message item.
 * @param {LiveChat.Runs | LiveChat.SimpleText} [message] message item
 * @param {object} [options={}] message options
 * @param {number} [options.start] start position of message
 * @param {number} [options.end] end position of message
 * @param {EmojiModeEnum} [options.emoji] emoji mode
 * @param {MutedWordModeEnum} [options.filterMode] filter mode
 * @returns {Array<HTMLSpanElement | Text>} nodes of chat message
 */
function getChatMessage(message, options = {}) {
	if (!message) return [];
	
	const { start, end, filterMode } = options;
	const filterOptions = {
		mode: filterMode || g.storage.mutedWords.mode,
		rules: g.list.mutedWords,
		replacement: g.storage.mutedWords.replacement,
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
			if (filtered.done && filterMode === g.index.mutedWords.all) return [];
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
			const emoji = options.emoji ?? g.storage.others.emoji;
			if (emoji < 0) {
				rslt.push(new Text(r.emoji.shortcuts?.[0] || r.emoji.emojiId || ''));
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
								case g.index.mutedWords.all: return [];
								case g.index.mutedWords.word: rslt.push(new Text(replacement)); break;
								case g.index.mutedWords.char: rslt.push(new Text([...replacement][0] || '')); break;
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

/**
 * Updates the current style of the given item.
 * @param {HTMLElement} item message element
 */
function updateCurrentItem(item) {
	if (!g.layer) return;
	const isLong = item.clientWidth >= g.layer.element.clientWidth * (parseInt(g.storage.styles.max_width) / 100 || 1);
	item.classList[isLong ? 'add' : 'remove']('wrap');
	item.style.setProperty('--yt-lcf-translate-x', `-${g.layer.element.clientWidth + item.clientWidth}px`);
}

/**
 * Gets the author type of the message.
 * @param {LiveChat.RendererContent} renderer message renderer
 * @returns {"normal" | "owner" | "moderator" | "member" | "verified"} author type
 */
function getAuthorType(renderer) {
	/** @type { ["owner", "moderator", "member", "verified"] } */
	const statuses = ['owner', 'moderator', 'member', 'verified'];
	const classes = renderer.authorBadges?.map(b => b.liveChatAuthorBadgeRenderer.customThumbnail ? 'member' : b.liveChatAuthorBadgeRenderer.icon?.iconType.toLowerCase() || '') || [];
	for (const s of statuses) if (classes.includes(s)) return s;
	return 'normal';
}


export class LiveChatLayer {
	/**
	 * Maximum number of messages to display
	 * @type {number}
	 */
	limit = 0;

	/**
	 * Container element of the layer
	 * @type {HTMLDivElement}
	 */
	element;

	/**
	 * Shadow root containing all messages
	 * @type {ShadowRoot}
	 */
	root;

	/** 
	 * Creates new layer.
	 * @param {HTMLDivElement | undefined} div container element
	 */
	constructor(div = undefined) {
		this.element = div || document.createElement('div');
		this.element.id = 'yt-lcf-layer';
		this.element.dataset.layer = '1';
		this.element.setAttribute('role', 'marquee');
		this.element.setAttribute('aria-live', 'off');
		this.element.tabIndex = -1;
		const resizeObserver = new ResizeObserver(() => {
			g.layer?.clear();
			this.resetAnimationDuration();
			this.resetFontSize();
		});
		resizeObserver.observe(this.element);
		this.root = this.element.attachShadow({ mode: 'closed' });
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = browser.runtime.getURL('../styles/layer.css');
		const styles = ['customcss', 'yourcss', 'userdefinedcss'].map(id => {
			const element = document.createElement('style');
			element.id = id;
			return element;
		});
		this.root.append(link, ...styles);
		const mutationObserver = new MutationObserver(() => {
			const over = this.root.childElementCount - (this.limit || Infinity);
			let i = 4; // link + styles(3)
			while (i++ < over) this.root.children[4]?.remove();
		});
		mutationObserver.observe(this.root, { childList: true });
		this.clear();
	}

	/**
	 * Removes all messages.
	 * @returns {LiveChatLayer} layer
	 */
	clear() {
		while (this.root.childElementCount > 4) {
			// @ts-ignore
			this.root.removeChild(this.root.lastChild);
		}
		return this;
	}

	/**
	 * Hides the layer.
	 */
	hide() {
		this.element.hidden = true;
		this.element.ariaHidden = 'true';
		this.element.style.display = 'none';
		this.clear();
	}

	/**
	 * Shows the layer.
	 */
	show() {
		this.element.hidden = false;
		this.element.ariaHidden = 'false';
		this.element.style.display = 'block';
	}

	/**
	 * Resets the animation duration.
	 * @param {number} pxPerSec pixels to move per second
	 */
	resetAnimationDuration(pxPerSec = g.storage.others.px_per_sec) {
		if (pxPerSec > 0) {
			const durationBySpeed = (this.element.getBoundingClientRect().width / pxPerSec) || 8;
			g.storage.styles.animation_duration = durationBySpeed.toFixed(1) + 's';
			if (g.panel?.form) {
				const input = /** @type {HTMLInputElement?} */ (g.panel.form.elements.animation_duration);
				if (input) input.value = durationBySpeed.toFixed(1);
			}
		} else {
			if (g.panel?.form) {
				const input = /** @type {HTMLInputElement?} */ (g.panel.form.elements.animation_duration);
				if (input) g.storage.styles.animation_duration = input.value + 's';
			}
		}
		this.element.style.setProperty('--yt-lcf-animation-duration', g.storage.styles.animation_duration);
	}

	/**
	 * Resets the font size.
	 * @param {number} numberOfLines number of lines
	 */
	resetFontSize(numberOfLines = g.storage.others.number_of_lines) {
		if (numberOfLines) {
			const rect = this.element.getBoundingClientRect();
			const lh = Number.parseFloat(g.storage.styles.line_height) || 1.4;
			const sizeByLines = Math.floor(rect.height / lh / numberOfLines);
			this.element.style.setProperty('--yt-lcf-font-size', [
				`${sizeByLines}px`,
				`max(${g.storage.styles.font_size}, ${sizeByLines}px)`,
				`min(${g.storage.styles.font_size}, ${sizeByLines}px)`,
			][g.storage.others.type_of_lines]);
		} else {
			this.element.style.setProperty('--yt-lcf-font-size', g.storage.styles.font_size);
		}
	}

	/**
	 * Updates style of current items.
	 * @param {string} [type] name of type to filter
	 */
	updateCurrentItemStyle(type = undefined) {
		const items = Array.from(this.root.children).filter(type ? c => c.classList.contains(type) : c => c.tagName === 'DIV');
		/** @type {HTMLElement[]} */ (items).forEach(updateCurrentItem);
	}

	/**
	 * Moves the layer to the given coordinates.
	 * @param {number} x x-coordinate
	 * @param {number} y y-coordinate
	 */
	move(x, y) {
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}
}

export class LiveChatPanel {
	/**
	 * Container element of the panel
	 * @type {HTMLDivElement}
	 */
	element;

	/**
	 * Content element of the panel
	 * @type {HTMLFormElement}
	 */
	form;

	/**
	 * Creates new config panel.
	 * @param {HTMLDivElement} [div] container element
	 */
	constructor(div = undefined) {
		this.element = div || document.createElement('div');
		this.element.id = 'yt-lcf-panel';
		this.element.className = 'ytp-sfn';
		this.element.dataset.layer = '4';
		this.hide();
		
		const c = { x: 10, y: 10 };
		/** @type {(val: number, min: number, max: number) => number} */
		const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
		/** @type {(e: MouseEvent) => void} */
		const onmousemove = e => {
			const le = g.layer?.element;
			if (!le || !isNotPip()) return;
			const x = clamp(this.element.offsetLeft + e.clientX - c.x, 10, le.clientWidth - this.element.clientWidth - 10);
			const y = clamp(this.element.offsetTop + e.clientY - c.y, 10, le.clientHeight - this.element.clientHeight - 10);
			this.move(x, y);
			c.x = e.clientX, c.y = e.clientY;
		};
		const onmouseup = () => {
			self.removeEventListener('mousemove', onmousemove);
			self.removeEventListener('mouseup', onmouseup);
			window.removeEventListener('mouseup', onmouseup);
		};
		this.element.addEventListener('mousedown', e => {
			const tagName = /** @type {HTMLElement} */ (e.target)?.tagName;
			if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return;
			c.x = e.clientX, c.y = e.clientY;
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
		const url = browser.runtime.getURL('../templates/panel_form.html');
		const doc = parser.parseFromString(await fetch(url).then(res => res.text()), 'text/html');
		
		this.form = /** @type {HTMLFormElement} */ (doc.querySelector('form'));

		const buttons = this.form.querySelectorAll('button[role="tab"]');
		const tabs = this.form.querySelectorAll('[role="tabpanel"]');
		
		buttons.forEach(btn => {
			btn.addEventListener('click', () => {
				buttons.forEach(btn => {
					btn.setAttribute('aria-selected', 'false');
				});
				btn.setAttribute('aria-selected', 'true');
				tabs.forEach(tab => {
					/** @type {HTMLElement} */ (tab).hidden = true;
				});
				const id = btn.getAttribute('aria-controls');
				/** @type {HTMLElement?} */
				const f = this.form.querySelector(`#${id}`);
				if (f) f.hidden = false;
			}, { passive: true });
		});

		const isDarkMode = document.documentElement.hasAttribute('dark');
		/** @param {string[]} c */
		const createButtonClassList = (...c) => {
			const base = 'yt-spec-button-shape-next';
			const list = c.map(v => `${base}--${v}`);
			list.unshift(base);
			return list.join(' ');
		};

		/** @type {HTMLButtonElement?} */
		const fontHelper = this.form.querySelector('#font_helper');
		if (fontHelper)
		if ('queryLocalFonts' in window) {
			/** @type {HTMLDialogElement?} */
			const dialog = doc.querySelector('#ytlcf-dialog-font_helper');
			if (dialog) {
				fontHelper.after(dialog);
	
				const form = dialog.querySelector('form');
				const ol = dialog.querySelector('ol');
				
				const buttons = ['up', 'down', 'delete'].map(fn => {
					const button = document.createElement('button');
					button.type = 'button';
					button.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
					button.dataset.function = fn;
					const label = browser.i18n.getMessage(fn);
					button.title = label;
					button.textContent = label;
					return button;
				});
	
				const select = dialog.querySelector('select');
				// @ts-ignore
				window.queryLocalFonts().then(fonts => {
					if (select) {
						const families = new Set(fonts.map(f => f.family));
						select.append(...Array.from(families, f => new Option(f)));
					}
				});
	
				const [addBtn, confirmBtn, cancelBtn] = dialog.querySelectorAll('form > div > button');
				addBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
				addBtn.addEventListener('click', () => {
					const family = select?.value;
					if (family) {
						const li = document.createElement('li');
						li.dataset.value = family;
						const div = document.createElement('div');
						div.style.display = 'flex';
						div.style.alignItems = 'center';
						const span = document.createElement('span');
						span.style.fontFamily = family;
						span.style.flex = '3 0';
						span.textContent = family;
						div.append(span, ...buttons.map(b => b.cloneNode(true)));
						li.appendChild(div);
						ol?.appendChild(li);
					}
				}, { passive: true });
				ol?.addEventListener('click', e => {
					const t = /** @type {HTMLElement?} */ (e.target);
					if (t && t.tagName === 'BUTTON') {
						const li = t.closest('li');
						if (li)
						switch (t.dataset.function) {
							case 'up': li.previousElementSibling?.before(li); break;
							case 'down': li.nextElementSibling?.after(li); break;
							case 'delete': li.remove();
						}
					}
				}, { passive: true });
	
				confirmBtn.className = createButtonClassList('filled', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
				cancelBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
				cancelBtn.addEventListener('click', () => {
					dialog.close();
				}, { passive: true });
	
				if (form && ol) form.addEventListener('submit', () => {
					const families = Array.from(ol.children).map(li => {
						const val = /** @type {HTMLLIElement} */ (li).dataset.value;
						return val ? val.includes(' ') ? `"${val}"` : val : undefined;
					});
					const font_family = /** @type {HTMLInputElement?} */ (this.form.elements.font_family);
					if (font_family) {
						font_family.value = families.filter(f => !!f).join(', ');
						this.updateStorage(font_family);
					}
				}, { passive: true });
	
				fontHelper.addEventListener('click', () => {
					while (ol?.childElementCount) ol?.lastElementChild?.remove();
					const families = g.storage.styles.font_family.split(/\s*,\s*/).filter(s => s.length > 0).map(s => s.replace(/^"(.*)"$/, "$1"));
					const listitems = families.map(family => {
						const li = document.createElement('li');
						li.dataset.value = family;
						const div = document.createElement('div');
						div.style.display = 'flex';
						const span = document.createElement('span');
						span.style.fontFamily = family;
						span.style.flex = '3 0';
						span.textContent = family;
						div.append(span, ...buttons.map(b => b.cloneNode(true)));
						li.appendChild(div);
						return li;
					});
					ol?.append(...listitems);
					dialog.showModal();
				}, { passive: true });
			}
		} else {
			fontHelper.hidden = true;
		}

		/** @type {HTMLButtonElement?} */
		const layerResizeHelper = this.form.querySelector('#layer_resize_helper');
		if (layerResizeHelper) {
			layerResizeHelper.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
			layerResizeHelper.addEventListener('click', () => {
				const le = g.layer?.element;
				const vc = g.app?.querySelector('#ytd-player');
				if (!le || !vc) return;
				le.classList.add('resize-mode');
				le.focus();

				const c = { x: le.clientLeft || 0, y: le.clientTop || 0 };
				/** @type {(val: number, min: number, max: number) => number} */
				const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
				/** @type {(e: MouseEvent) => void} */
				const onmousemove = e => {
					if (!le || !isNotPip()) return;
					if (!vc) return;
					const x = clamp(le.offsetLeft + e.clientX - c.x, 0, vc.clientWidth - le.clientWidth);
					const y = clamp(le.offsetTop + e.clientY - c.y, 0, vc.clientHeight - le.clientHeight);
					g.layer?.move(x, y);
					c.x = e.clientX, c.y = e.clientY;
				};
				/** @type {(e: MouseEvent) => void} */
				const onmouseup = e => {
					self.removeEventListener('mousemove', onmousemove);
					self.removeEventListener('mouseup', onmouseup);
					window.removeEventListener('mouseup', onmouseup);
				};
				/** @type {(e: MouseEvent) => void} */
				const onmousedown = e => {
					if (e.clientX > le.clientWidth - 64 && e.clientY > le.clientHeight - 64) return;
					c.x = e.clientX, c.y = e.clientY;
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
					const input = /** @type {HTMLInputElement?} */ (g.panel?.form.elements.layer_css);
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
						Object.entries(percents).forEach(([prop, val]) => {
							if (val === defaults[prop]) {
								styleMap.delete(prop);
							} else if (val) {
								styleMap.set(prop, val.toFixed(1) + '%');
							}
						});
						styleMap.delete('');
						if (input) {
							const newValue = Array.from(styleMap.entries(), entry => entry.join(': ')).join('; ');
							input.value = newValue ? newValue + ';' : '';
							g.panel?.updateStorage(input);
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

		/** @type {HTMLButtonElement?} */
		const userCssHelper = this.form.querySelector('#user_css_helper');
		if (userCssHelper) {
			userCssHelper.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
			/** @type {HTMLDialogElement?} */
			const dialog = doc.querySelector('#ytlcf-dialog-user_css_helper');
			if (dialog) {
				userCssHelper.after(dialog);
				
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
						const invalidLineNum = lines.findIndex(id => id ? !pattern.test(id) : false);
						const validityMsg = invalidLineNum < 0 ? '' : browser.i18n.getMessage('validation_channelId', invalidLineNum + 1);
						textarea.setCustomValidity(validityMsg);
						preview.value = text;
					}, { passive: true });
					form.addEventListener('submit', _ => {
						const textarea = /** @type {HTMLTextAreaElement} */ (this.form.elements.user_defined_css);
						textarea.value += '\n' + preview.value;
						this.updateStorage(textarea);
						form.reset();
						preview.value = '';
					}, { passive: true });
				}
				const [confirmBtn, cancelBtn] = dialog.querySelectorAll('button');
				confirmBtn.className = createButtonClassList('filled', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
				cancelBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-s');
				cancelBtn.addEventListener('click', () => {
					dialog.close();
				}, { passive: true });
				
				userCssHelper.addEventListener('click', () => {
					dialog.showModal();
				}, { passive: true });
			}
		}
		
		const othersBtn = this.form.querySelector('#ytlcf-config-others');
		if (othersBtn) {
			othersBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
			othersBtn.addEventListener('click', () => {
				browser.runtime.sendMessage({ fire: 'openOptions' });
			}, { passive: true });
		}

		this.form.addEventListener('change', e => {
			if (!this.form.reportValidity()) return;
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
		const le = g.layer?.element;
		const ctrls = this.form.elements;
		if (elem.tagName === 'SELECT') {
			if (name in g.storage.others) {
				const val = Number.parseInt(elem.value);
				if (name === 'translation') {
					const prefix = /** @type {HTMLInputElement} */ (ctrls.prefix_lang);
					prefix.disabled = val === 0;
					g.storage.others[name] = val * (prefix.checked ? -1 : 1);
					// @ts-ignore
					const cb = /** @type {NodeListOf<HTMLInputElement>} */ (ctrls.except_lang);
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
				if (le)
				switch (name) {
					case 'emoji': {
						le.dataset.emoji = Object.keys(g.index.emoji)[val];
						g.layer?.updateCurrentItemStyle();
						break;
					}
					case 'wrap': {
						le.style.setProperty('--yt-lcf-message-hyphens', g.array.hyphens[val]);
						le.style.setProperty('--yt-lcf-message-word-break', g.array.wordBreak[val]);
						le.style.setProperty('--yt-lcf-message-white-space', g.array.whiteSpace[val]);
						le.style.setProperty('--yt-lcf-max-width', g.storage.styles.max_width);
						g.layer?.updateCurrentItemStyle();
						break;
					}
				}
			} else if (name === 'muted_words_mode') {
				const mode = Number.parseInt(elem.value);
				g.storage.mutedWords.mode = mode;
				const replacement = /** @type {HTMLInputElement} */ (ctrls.muted_words_replacement);
				replacement.title = mode === g.index.mutedWords.char ? browser.i18n.getMessage('tooltip_mutedWordsReplacement') : '';
			}
		} else if (elem.classList.contains('styles') && name) {
			g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
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
					case 'max_width': g.layer?.updateCurrentItemStyle();
				}
				le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-'), g.storage.styles[name]);
			}
		} else if (name.startsWith('stroke_')) {
			g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
			le?.style.setProperty(name.replace('stroke_', '--yt-lcf-stroke-'), g.storage.styles[name]);
		} else if (name.endsWith('_display')) {
			const match = name.match(/^(.+)_display$/);
			if (match && elem.tagName === 'INPUT') {
				const [_, type] = match;
				if (type in g.storage.parts && le) {
					if (elem.value !== 'color') {
						g.storage.parts[type][elem.value] = /** @type {HTMLInputElement} */ (elem).checked;
						le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-') + '-' + elem.value, /** @type {HTMLInputElement} */ (elem).checked ? 'inherit' : 'none');
					} else {
						if (/** @type {HTMLInputElement} */ (elem).checked) {
							g.storage.parts[type].color = /** @type {HTMLInputElement?} */ (ctrls[type + '_color'])?.value;
							le.style.setProperty('--yt-lcf-' + type.replace(/_/g, '-') + '-color', g.storage.parts[type].color || 'inherit');
						} else {
							g.storage.parts[type].color = null;
							le.style.removeProperty('--yt-lcf-' + type.replace(/_/g, '-') + '-color');
						}
					}
					g.layer?.updateCurrentItemStyle(type);
				}
			}
		} else if (name.endsWith('_color')) {
			const match = name.match(/^(.+)_color$/);
			if (match) {
				const [_, type] = match;
				if (/** @type {HTMLInputElement?} */ (elem.previousElementSibling?.firstElementChild)?.checked) {
					g.storage.parts[type].color = /** @type {HTMLInputElement?} */ (ctrls[type + '_color'])?.value;
					le?.style.setProperty('--yt-lcf-' + type.replace('_', '-') + '-color', g.storage.parts[type].color || 'inherit');
				} else {
					g.storage.parts[type].color = null;
					le?.style.removeProperty('--yt-lcf-' + type.replace('_', '-') + '-color');
				}
			}
		} else if (name === 'layer_css') {
			const newCss = /** @type {HTMLInputElement?} */ (ctrls[name])?.value || '';
			g.storage.styles.layer_css = newCss;
			const le = g.layer?.element;
			if (le) le.style.cssText = le.style.cssText.replace(/\-\-yt\-lcf\-layer\-css: below;.*$/, '--yt-lcf-layer-css: below; ' + newCss);
		} else if (name.endsWith('_css')) {
			const match = name.match(/^(.*)_css$/);
			if (match) {
				const [_, type] = match;
				const selector = type && type !== 'user_defined' ? '.' + type : '';
				g.storage.cssTexts[selector] = /** @type {HTMLInputElement?} */ (ctrls[type + '_css'])?.value || '';
				if (selector) {
					const style = g.layer?.root.getElementById('customcss');
					if (style) {
						const rule = new RegExp(`:host>${selector.replace('.', '\\.')}{.*?}`);
						style.textContent = (style.textContent || '').replace(rule, `:host>${selector}{${g.storage.cssTexts[selector]}}`);
					}
				} else {
					const style = g.layer?.root.getElementById('userdefinedcss');
					if (style) style.textContent = g.storage.cssTexts[''];
				}
			}
		} else if (name === 'prefix_lang') {
			const checked = this.form[name].checked;
			const val = g.storage.others.translation;
			g.storage.others.translation = Math.abs(val) * (checked ? -1 : 1);
			le?.classList[checked ? 'add' : 'remove']('prefix_lang');
			g.layer?.updateCurrentItemStyle();
		} else if (name === 'except_lang' || name === 'overlapping' || name === 'direction') {
			/** @type {NodeListOf<HTMLInputElement>} */
			const list = this.form[name];
			const val = Array.from(list).map((l) => Number(l.checked)).reduce((a, c, i) => a + (c << i), 0);
			g.storage.others[name] = val;
			if (name === 'direction' && le) {
				le.classList[0b01 & val ? 'add': 'remove']('direction-reversed-y');
				le.classList[0b10 & val ? 'add': 'remove']('direction-reversed-x');
			}
		} else if (name.startsWith('muted_words_')) {
			switch (name) {
				case 'muted_words_replacement': {
					g.storage.mutedWords.replacement = elem.value;
					break;
				}
				default: {
					g.storage.mutedWords.regexp = /** @type {HTMLInputElement} */ (ctrls.muted_words_regexp).checked;
					g.storage.mutedWords.plainList = /** @type {HTMLTextAreaElement} */ (ctrls.muted_words_list).value.split(/\n+/).filter(s => s.length > 0);
					updateMutedWordsList();
				}
			}
		}
		if (['speed', 'px_per_sec'].includes(name)) {
			const checked = /** @type {HTMLInputElement} */ (ctrls.speed).checked;
			/** @type {HTMLInputElement} */ (ctrls.animation_duration).disabled = checked;
			/** @type {HTMLInputElement} */ (ctrls.px_per_sec).disabled = !checked;
			g.storage.others.px_per_sec = checked ? /** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber : 0;
			if (g.layer) g.layer.resetAnimationDuration();
		} else if (['lines', 'number_of_lines', 'type_of_lines'].includes(name)) {
			const checked = /** @type {HTMLInputElement} */ (ctrls.lines).checked;
			/** @type {HTMLInputElement} */ (ctrls.font_size).disabled = checked;
			/** @type {HTMLInputElement} */ (ctrls.number_of_lines).disabled = !checked;
			/** @type {HTMLInputElement} */ (ctrls.type_of_lines).disabled = !checked;
			g.storage.others.number_of_lines = checked ? /** @type {HTMLInputElement} */ (ctrls.number_of_lines).valueAsNumber : 0;
			if (g.layer) g.layer.resetFontSize();
		} else if (['unlimited', 'limit_number'].includes(name)) {
			const checked = /** @type {HTMLInputElement} */ (ctrls.unlimited).checked;
			/** @type {HTMLInputElement} */ (ctrls.limit_number).disabled = checked;
			g.storage.others.limit = checked ? 0 : /** @type {HTMLInputElement} */ (ctrls.limit_number).valueAsNumber;
			if (g.layer) g.layer.limit = g.storage.others.limit;
		} else if (['container_unlimited', 'container_limit_number'].includes(name)) {
			const checked = /** @type {HTMLInputElement} */ (ctrls.container_unlimited).checked;
			/** @type {HTMLInputElement} */ (ctrls.container_limit_number).disabled = checked;
			g.storage.others.container_limit = checked ? 0 : /** @type {HTMLInputElement} */ (ctrls.container_limit_number).valueAsNumber;
		} else if (name === 'time_shift') {
			g.storage.others.time_shift = /** @type {HTMLInputElement} */ (ctrls.time_shift).valueAsNumber;
		}
		Storage.set(g.storage);
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

/**
 * Updates muted word list.
 */
export function updateMutedWordsList() {
	/** @type { (str: string) => string } */
	const escapeRegExp = str => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
	const { regexp, plainList } = g.storage.mutedWords;
	g.list.mutedWords = regexp
		? plainList.map(s => new RegExp(s, 'g'))
		: plainList.length > 0
			? [ new RegExp(plainList.map(escapeRegExp).join('|'), 'g') ]
			: [];
}