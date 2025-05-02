/// <reference lib="esnext" />
/// <reference path="../../browser.d.ts" />
/// <reference path="../../extends.d.ts" />
/// <reference path="../../ytlivechatrenderer.d.ts" />

const manifest = browser.runtime.getManifest();
const parser = new DOMParser();

const defaultSettings = {
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
		time_shift: 0,
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
	translation: {
		url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&dt=bd&dj=1&q=$q',
	},
};
const defaultSettingsJson = JSON.stringify(defaultSettings);

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
	storage: defaultSettings,
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
 * Start app.
 * @param {HTMLElement} player 
 */
export function runApp(player) {
	g.app = player;


	const videoContainer = g.app?.querySelector('#ytd-player video')?.parentElement;
	if (!videoContainer) return Promise.reject();

	// remove old panel and generate new panel
	// g.app.querySelector('#yt-lcf-panel')?.remove();
	const panel = new LiveChatPanel();
	g.panel = panel;

	// get storage data
	const storageList = ['styles', 'others', 'parts', 'cssTexts', 'hotkeys', 'mutedWords', 'translation'];
	return browser.storage.local.get(storageList)
	.then(storage => {
		for (const type of storageList) {
			if (storage && storage[type]) {
				for (const [key, value] of Object.entries(storage[type])){
					g.storage[type][key] = value;
				}
			}
		}
	})
	.then(() => panel.createForm())
	.then(form => {
		// bind i18n labels
		/** @type {NodeListOf<HTMLElement>} */
		const i18nElems = form.querySelectorAll('[data-i18n]');
		i18nElems.forEach(e => {
			const key = e.dataset.i18n;
			if (key) e.textContent = browser.i18n.getMessage(key);
		});
		/** @type {NodeListOf<HTMLElement>} */
		const i18nTitleElems = form.querySelectorAll('[data-i18n-title]');
		i18nTitleElems.forEach(e => {
			const key = e.dataset.i18nTitle;
			if (key) e.title = browser.i18n.getMessage(key);
		});
		/** @type {NodeListOf<HTMLInputElement | HTMLTextAreaElement>} */
		const i18nPlaceholderElems = form.querySelectorAll('[data-i18n-placeholder]');
		i18nPlaceholderElems.forEach(e => {
			const key = e.dataset.i18nPlaceholder;
			if (key) e.placeholder = browser.i18n.getMessage(key);
		});
	})
	.then(() => {
		g.layer = getLayer();
		if (g.storage.others.disabled) g.layer.hide();
		videoContainer.after(g.layer.element);
		self.addEventListener('ytlcf-actions', e => {
			doChatActions(e.detail);
		}, { passive: true });
	})
	.then(async () => {
		// fetching your channel ID and set styles for you
		const res = await fetch('/account_advanced');
		const text = await res.text();
		const matches = text.match(/"(UC[\w-]{22})"/);
		g.channel = matches?.[1] || '';
		if (g.channel) {
			const style = g.layer?.element.shadowRoot?.querySelector('#yourcss');
			if (style) {
				const you = `[data-author-id="${g.channel}"]`;
				style.textContent = `${you}{color:var(--yt-lcf-you-color)}:host(.has-you-name) ${you}.text{background-color:var(--yt-live-chat-you-message-background-color);border-radius:.5em;padding:0 .25em}${you}.text .photo{display:var(--yt-lcf-you-display-photo)}${you}.text .name{display:var(--yt-lcf-you-display-name)}${you}.text .message{display:var(--yt-lcf-you-display-message)}`;
			}
		}
	})
	.then(updateMutedWordsList)
	.then(setupPanel)
	.then(addSettingMenu)
	.then(() => {
		if (g.layer) g.layer.element.style.cssText += '--yt-lcf-layer-css: below;' + g.storage.styles.layer_css;
	})
	.then(() => {
		const ev = new CustomEvent('ytlcf-ready');
		self.dispatchEvent(ev);
	});
}

export function getLayer() {
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
		if (input)
		if (input.type === 'number') input.valueAsNumber = Number.parseFloat(value);
		else input.value = value;
	}
	// number
	/** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber = /** @type {HTMLInputElement} */ (ctrls.speed).checked
		? g.storage.others.px_per_sec
		: Math.round(le.getBoundingClientRect().width / /** @type {HTMLInputElement} */ (ctrls.animation_duration).valueAsNumber);
	/** @type {HTMLInputElement} */ (ctrls.limit_number).valueAsNumber = g.storage.others.limit || 100;
	/** @type {HTMLInputElement} */ (ctrls.container_limit_number).valueAsNumber = g.storage.others.container_limit || 20;
	/** @type {HTMLInputElement} */ (ctrls.time_shift).valueAsNumber = g.storage.others.time_shift || 0;
	
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
			inputLn.setAttribute('value', `${defaultSettings.others.number_of_lines}`);
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
	const userDefinedCss = le.shadowRoot?.querySelector('#userdefinedcss');
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

	// hotkeys
	/** @type {HTMLInputElement} */ (ctrls.hotkey_layer).value = g.storage.hotkeys.layer;
	/** @type {HTMLInputElement} */ (ctrls.hotkey_panel).value = g.storage.hotkeys.panel;

	/** @type {HTMLInputElement} */ (ctrls.muted_words_replacement).value = g.storage.mutedWords.replacement;
	/** @type {HTMLTextAreaElement} */ (ctrls.muted_words_list).value = g.storage.mutedWords.plainList.join('\n');
	/** @type {HTMLInputElement} */ (ctrls.translation_url).value = g.storage.translation.url;

}

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
				g.layer?.init();
				g.layer?.[checked ? 'hide' : 'show']();
				g.storage.others.disabled = checked ? 1 : 0;
				browser.storage.local.set(g.storage);
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
 * @param {LiveChat.LiveChatItemAction[]} actions 
 * @returns 
 */
export function doChatActions(actions) {
	if (!g.layer) return;
	const le = g.layer.element;
	const root = le.shadowRoot;
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
	const fs = parseInt(g.storage.styles.font_size) || 36, lhf = parseFloat(g.storage.styles.line_height) || 1.25, lh = fs * lhf;
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

		elem.classList.add('overlap');
		y = 0;
		const st = g.storage.others.overlapping;
		const o = st & 0b01 ? .8 : 1;
		const dy = st & 0b10 ? .5 : 0;
		// const d = st & 0b100 ? 'none': 'block';

		y = Math.floor(Math.random() * (overline - 1));
		const sibling = children.filter(c => c.dataset.line === `${y}`);
		elem.style.top = `${(y + dy) * lhf}em`;
		elem.style.opacity = `${Math.max(.5, Math.pow(o, sibling.length || 1))}`;
		elem.style.zIndex = `-${sibling.length || 1}`;
		// elem.style.display = d;
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

export function skipRenderingOnce() {
	g.skip = true;
}

/** @param {LiveChat.AnyRenderer} item */
async function parseChatItem(item) {
	const key = Object.keys(item)[0];
	const renderer = item[key];
	const elem = document.createElement('div');
	elem.id = renderer.id || '';
	elem.dataset.authorId = renderer.authorExternalChannelId;
	const name = getRawText(renderer.authorName);
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
		orig: renderer.message ? getChatMessage(renderer.message, { filterMode: g.storage.mutedWords.mode }) : null,
		trans: null,
		src: '',
	};
	const index = g.storage.others.translation;
	const nl = navigator.languages;
	const tl = ['', ...nl][Math.abs(index)];
	const el = nl.filter((_, i) => g.storage.others.except_lang & 1 << i);
	if (tl && msg.orig) {
		msg.trans = await Promise.all(msg.orig.map(async node => {
			const text = node.textContent;
			if (text) {
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
			if (Object.values(g.storage.parts[authorType]).includes(true)) {
				elem.className = 'text ' + authorType;
				const header = document.createElement('span');
				header.className = 'header';
				header.appendChild(authorElems);
				const body = document.createElement('span');
				body.part = 'message';
				body.className = 'body';
				body.append(...(msg.trans || msg.orig || []));
				elem.append(header, body);
				elem.dataset.text = getRawText(renderer.message);
				return elem;
			} else {
				return null;
			}
		}
		case 'liveChatMembershipItemRenderer': {
			const { headerPrimaryText: primary, headerSubtext: sub } = renderer;
			const messageType = primary ? 'milestone' : 'membership';
			elem.className = messageType;
			if (Object.values(g.storage.parts[messageType]).includes(true)) {
				const header = document.createElement('div');
				header.className = 'header';
				header.style.backgroundColor = `rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))`;
				const months = document.createElement('span');
				months.part = months.className = 'months';
				months.append(...getChatMessage(primary || sub, { start: primary ? 1 : 0 }));
				header.append(authorElems, months);
				const body = document.createElement('div');
				body.part = 'message';
				body.className = 'body';
				body.style.backgroundColor = `rgba(${getColorRGB(0xff0a8043).join()},var(--yt-lcf-background-opacity))`;
				body.append(...(msg.trans || msg.orig || []));
				elem.append(header, body);
				return elem;
			} else {
				return null;
			}
		}
		case 'liveChatPaidMessageRenderer': {
			if (Object.values(g.storage.parts.paid_message).includes(true)) {
				elem.className = 'superchat';
				const header = document.createElement('div');
				header.className = 'header';
				header.style.backgroundColor = `rgba(${getColorRGB(renderer.headerBackgroundColor).join()},var(--yt-lcf-background-opacity))`;
				const amount = document.createElement('span');
				amount.part = amount.className = 'amount';
				amount.append(getRawText(renderer.purchaseAmountText));
				header.append(authorElems, amount);
				const body = document.createElement('div');
				body.part = 'message';
				body.className = 'body';
				body.style.backgroundColor = `rgba(${getColorRGB(renderer.bodyBackgroundColor).join()},var(--yt-lcf-background-opacity))`;
				body.append(...(msg.trans || msg.orig || []));
				elem.append(header, body);
				return elem;
			} else {
				return null;
			}
		}
		case 'liveChatPaidStickerRenderer': {
			if (Object.values(g.storage.parts.paid_sticker).includes(true)) {
				elem.className = 'supersticker';
				const header = document.createElement('div');
				header.className = 'header';
				header.style.backgroundColor = `rgba(${getColorRGB(renderer.backgroundColor).join()},var(--yt-lcf-background-opacity))`;
				const amount = document.createElement('span');
				amount.part = amount.className = 'amount';
				amount.append(getRawText(renderer.purchaseAmountText));
				header.append(authorElems, amount);
				const body = document.createElement('figure');
				body.part = 'sticker';
				body.className = 'body';
				body.style.backgroundColor = `rgba(${getColorRGB(renderer.moneyChipBackgroundColor).join()},var(--yt-lcf-background-opacity)`;
				const sticker = new Image();
				sticker.className = 'sticker';
				sticker.src = (renderer.sticker.thumbnails.find(t => 2 * 36 <= (t.width || 36)) || renderer.sticker.thumbnails[0]).url;
				sticker.loading = 'lazy';
				body.appendChild(sticker);
				elem.append(header, body);
				return elem;
			} else {
				return null;
			}
		}
		case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer': {
			if (Object.values(g.storage.parts.membership).includes(true)) {
				elem.className = 'membership gift';
				const h = renderer.header.liveChatSponsorshipsHeaderRenderer;
				authorElems;
				/** @type {SVGGElement?} */
				const iconref = document.querySelector('iron-iconset-svg #gift-filled');
				const count = h.primaryText?.runs?.filter(r => !Number.isNaN(parseInt(r.text)))[0]?.text;
				if (count) {
					const header = document.createElement('div');
					header.className = 'header';
					header.style.backgroundColor = `rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))`;
					const gifts = document.createElement('span');
					gifts.part = gifts.className = 'gifts';
					if (iconref) {
						const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
						svg.setAttribute('viewBox', '0 2 24 24');
						svg.setAttribute('fill', 'currentColor');
						svg.setAttribute('stroke', '#000');
						svg.setAttribute('paint-order', 'stroke');
						svg.appendChild(iconref.cloneNode(true));
						gifts.append(svg, count);
					} else {
						gifts.append('🎁', count);
					}
					header.append(authorElems, gifts);
					elem.appendChild(header);
					return elem;
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
 * @param { LiveChat.Runs | LiveChat.SimpleText | undefined } message
 */
function getRawText(message) {
	if (!message) return '';
	if ('simpleText' in message) return message.simpleText;
	const rslt = [];
	for (const r of message.runs) {
		if ('text' in r) {
			rslt.push(r.text);
		} else {
			rslt.push(r.emoji.shortcuts?.[0] || r.emoji.emojiId || '');
		}
	}
	return rslt.join('');
}

/**
 * @param { LiveChat.Runs | LiveChat.SimpleText | undefined } message
 * @param { { start?: number, end?: number, emoji?: number, filterMode?: number } } options
 */
function getChatMessage(message, options = {}) {
	if (!message) return [];
	
	const { start, end, filterMode } = options;
	if ('simpleText' in message) {
		const str = filterMessage(message.simpleText).value;
		return [ new Text(start || end ? str.slice(start, end) : str) ];
	}
	const rslt = [];
	const runs = start || end ? message.runs.slice(start, end) : message.runs;
	for (const r of runs) {
		if ('text' in r) {
			const filtered = filterMessage(r.text, filterMode);
			if (filtered.result && filterMode === g.index.mutedWords.all) return [];
			let node;
			if (r.navigationEndpoint || r.bold || r.italics) {
				if (r.navigationEndpoint) {
					node = document.createElement('a');
					const ep = r.navigationEndpoint.urlEndpoint || r.navigationEndpoint.watchEndpoint;
					if (ep) {
						/** @type {SVGGElement?} */
						const iconref = document.querySelector('iron-iconset-svg #open_in_new');
						node.pathname = 'url' in ep ? ep.url : (ep.videoId ? '/watch?v=' + ep.videoId : '');
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
 * @param {boolean} [reversed=false] 
 */
function isCatchable(before, after, reversed = (g.storage.others.direction & 2) > 0) {
	const sec = Number.parseFloat(g.storage.styles.animation_duration) || 4;
	const [b, a] = [before, after].map(elm => elm.getBoundingClientRect());
	if (b.top <= a.top && a.top < b.bottom) {
		if (reversed ? b.left <= a.right : a.left <= b.right) {
			return true;
		} else if (b.width >= a.width) {
			return false;
		} else {
			const [bSpeed, aSpeed] = [b, a].map(rect => rect.width / sec);
			const speedDiff = aSpeed - bSpeed;
			const posDiff = reversed ? b.left - a.right : a.left - b.right;
			return posDiff < speedDiff * sec;
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
			case 'ms': return Number.parseFloat(num);
			case 's': return Number.parseFloat(num) * 1000;
		}
		return Number.parseFloat(g.storage.styles.animation_duration) * 1000 || 4000;
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

export class LiveChatLayer {
	limit = 0;
	element;
	root;
	/** @param {HTMLDivElement | undefined} div */
	constructor(div = undefined) {
		this.element = div || document.createElement('div');
		this.element.id = 'yt-lcf-layer';
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
		while (this.root.lastChild) this.root.removeChild(this.root.lastChild);
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
			while (i++ < over) styles[styles.length - 1].nextElementSibling?.remove();
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
			if (g.panel?.form)
			/** @type {HTMLInputElement} */ (g.panel.form.elements.animation_duration).value = durationBySpeed.toFixed(1);
		} else {
			if (g.panel?.form)
			g.storage.styles.animation_duration = /** @type {HTMLInputElement} */ (g.panel.form.elements.animation_duration).value + 's';
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

export class LiveChatPanel {
	element;
	/** @type {HTMLFormElement} */
	form;

	/**
	 * @param {HTMLDivElement} [div]
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
			if (['INPUT', 'TEXTAREA', 'SELECT'].includes(/** @type {HTMLElement} */ (e.target)?.tagName)) return;
			c.x = e.clientX, c.y = e.clientY;
			self.addEventListener('mousemove', onmousemove, { passive: true });
			self.addEventListener('mouseup', onmouseup, { passive: true });
			window.addEventListener('mouseup', onmouseup, { passive: true });
		}, { passive: true });
		this.element.addEventListener('keyup', e => {
			e.stopPropagation();
		});
	}

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
	
				/** @type {string?} */
				if (ol) {
					const families = g.storage.styles.font_family.split(/,\s*/).map(s => s.replace(/^"(.*)"$/, "$1"));
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
					ol.append(...listitems);
				}
	
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
					if (family && family !== 'inherit') {
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
					dialog.showModal();
				}, { passive: true });
			}
		} else {
			fontHelper.hidden = true;
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

		const version = this.form.querySelector('#manifest_version');
		if (version && manifest.version) version.textContent = manifest.version;
		
		const exportBtn = this.form.querySelector('#ytlcf-config-export');
		if (exportBtn) {
			exportBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
			exportBtn.addEventListener('click', this.export, { passive: true });
		}
		const importBtn = this.form.querySelector('#ytlcf-config-import');
		if (importBtn) {
			importBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
			importBtn.addEventListener('click', this.import, { passive: true });
		}
		const initBtn = this.form.querySelector('#ytlcf-config-init');
		if (initBtn) {
			initBtn.className = createButtonClassList('tonal', isDarkMode ? 'mono' : 'mono-inverse', 'size-xs');
			initBtn.addEventListener('click', this.init, { passive: true });
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

	hide() {
		this.element.querySelector('button')?.blur(); // avoid ARIA error
		this.element.hidden = true;
		this.element.ariaHidden = 'true';
		this.element.style.display = 'none';
	}
	show() {
		this.element.hidden = false;
		this.element.ariaHidden = 'false';
		this.element.style.display = 'block';
	}
	/** @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} elem */
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
				const mode = parseInt(elem.value);
				g.storage.mutedWords.mode = mode;
				const replacement = /** @type {HTMLInputElement} */ (ctrls.muted_words_replacement);
				replacement.title = mode === g.index.mutedWords.char ? browser.i18n.getMessage('tooltip_mutedWordsReplacement') : '';
			}
		} else if (elem.classList.contains('styles') && name) {
			g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
			if (le) {
				switch (name) {
					case 'animation_duration': {
						const speed = le.getBoundingClientRect().width / /** @type {HTMLInputElement} */ (elem).valueAsNumber;
						/** @type {HTMLInputElement} */ (ctrls.px_per_sec).valueAsNumber = Math.round(speed);
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
					const style = le?.shadowRoot?.querySelector('#customcss');
					if (style) {
						const rule = new RegExp(`:host>${selector.replace('.', '\\.')}{.*?}`);
						style.textContent = (style.textContent || '').replace(rule, `:host>${selector}{${g.storage.cssTexts[selector]}}`);
					}
				} else {
					const style = le?.shadowRoot?.querySelector('#userdefinedcss');
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
					g.storage.mutedWords.regexp = /** @type {HTMLInputElement} */ (ctrls.muted_words_regexp).checked;
					g.storage.mutedWords.plainList = /** @type {HTMLTextAreaElement} */ (ctrls.muted_words_list).value.split(/\n+/).filter(s => s.length > 0);
					updateMutedWordsList();
				}
			}
		} else if (name === 'user_defined_css') {
			g.storage.cssTexts[''] = elem.value;
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
		browser.storage.local.set(g.storage);
	}

	/** @type {(x: number, y: number) => void} */
	move(x, y) {
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}

	export() {
		const storageList = ['styles', 'others', 'parts', 'cssTexts', 'hotkeys', 'mutedWords', 'translation'];
		return browser.storage.local.get(storageList).then(storage => {
			const blob = new Blob([JSON.stringify(storage)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.download = `ytlcf-config-${Date.now()}.json`;
			a.href = url;
			a.click();
		});
	}

	import() {
		return new Promise((resolve, reject) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'application/json';
			input.addEventListener('canncel', () => {
				console.log('Config file import is canceled.');
				reject();
			}, { passive: true });
			input.addEventListener('change', e => {
				const files = input.files;
				if (files && files.length > 0) {
					console.log('Config file selected: ' + files[0].name);
					const reader = new FileReader();
					reader.onload = e => {
						const json = JSON.parse(/** @type {string} */ (e.target?.result));
						browser.storage.local.set(json).then(resolve);
					};
					reader.readAsText(files[0]);
				}
			}, { passive: true });
			input.click();
		}).then(refreshPage);
	}

	init() {
		return browser.storage.local.set(JSON.parse(defaultSettingsJson)).then(refreshPage);
	}
}

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

/**
 * Check if now in PiP-mode
 * @returns {boolean} if not PiP-mode now
 */
export function isNotPip() {
	return !self.documentPictureInPicture?.window;
}

/**
 * Convert color from long integer to array of integer.
 * @param {number} long integer of color `0xAARRGGBB`
 * @returns {number[]} array of integer `[RR, GG, BB]`
 */
export function getColorRGB(long) {
	const separated = /** @type {string[]} */ (long.toString(16).match(/[0-9a-f]{2}/g) || [])
	return separated.map(hex => Number.parseInt(hex, 16)).slice(1);
}

/**
 * Convert CSS color value from short hex-format or rgb()-format to normal hex-format.
 * @param {string} css short hex-format or rgb()-format color value (e.g. `#abc`, `rgb(0, 128, 255)`)
 * @param {string} [inherit='#ffffff'] default value
 * @returns {string} normal hex-format color (e.g. `#123456`)
 */
export function formatHexColor(css, inherit = '#ffffff') {
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

function refreshPage() {
	alert(browser.i18n.getMessage('page_refresh'));
	location.reload();
}