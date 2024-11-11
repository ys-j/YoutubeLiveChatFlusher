var browser = browser || chrome;
export const $msg = browser.i18n.getMessage;

/** @param {string} str */
export function escapeHtml(str) {
	return str.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/** @param {string} str */
export function escapeRegExp(str) {
	return str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {number} long
 */
export function getColorRGB(long) {
	return (long.toString(16).match(/[0-9a-f]{2}/g) || []).map(hex => parseInt(hex, 16)).slice(1);
}

/**
 * @param {string} css 
 * @param {string} inherit 
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

export function updateMutedWordsList() {
	const { regexp, plainList } = g.storage.mutedWords;
	g.list.mutedWords = regexp ? plainList.map(s => new RegExp(s, 'g')) : plainList.length > 0 ? [ new RegExp(plainList.map(escapeRegExp).join('|'), 'g') ] : [];
	return g.list.mutedWords;
}

export class LiveChatPanel {
	element;
	form;
	/** @param {HTMLDivElement} [div] */
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
		this.element.addEventListener('keyup', e => {
			e.stopPropagation();
		});

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
		const buttons = ['displayTab', 'byTypeTab', 'mutedWordsTab', 'userDefinedCssTab'].map((s, i) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'ytp-button';
			b.id = `yt-lcf-panel-tabbutton-${i}`;
			b.setAttribute('role', 'tab');
			b.setAttribute('aria-controls', `yt-lcf-panel-tabpanel-${i}`);
			b.setAttribute('aria-selected', (!Boolean(i)).toString());
			b.textContent = $msg(s);
			b.addEventListener('click', changeTab);
			return b;
		});
		tablist.append(...buttons);

		const fields = Array.from({ length: 4 }, (_, i) => {
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
			`<div><div>${$msg('animationDuration')}</div><div><label><input type="number" class="styles" name="animation_duration" min="1" step="0.1" size="5" value="${(parseFloat(g.storage.styles.animation_duration) || 8).toFixed(1)}" data-unit="s">s</label> /<input type="checkbox" name="speed"><label><input type="number" name="px_per_sec" min="1" size="5" value="${g.storage.others.px_per_sec || 160}" data-unit="px/s"><span>px/s</span></label></div></div>`,
			`<div><div>${$msg('fontSize')}</div><div><label><input type="number" class="styles" name="font_size" min="12" size="5" value="${parseInt(g.storage.styles.font_size) || 36}" data-unit="px">px</label> /<input type="checkbox" name="lines"><label><input type="number" name="number_of_lines" min="6" size="5" value="${g.storage.others.number_of_lines || 20}"><span>${$msg('lines')}</span></label><select name="type_of_lines">${Object.values(g.index.lines).map(v => `<option value="${v}">` + $msg(`typeOfLines_${v}`)).join('')}</select><span>▼</span></div></div>`,
			`<div><div>${$msg('lineHeight')}</div><div><input type="number" class="styles" name="line_height" min="1" step="0.05" value="${g.storage.styles.line_height || 1.25}"></div></div>`,
			`<div><div>${$msg('fontFamily')} / ${$msg('fontWeight')}</div><div><input type="text" class="styles" name="font_family" value="${escapeHtml(g.storage.styles.font_family) || 'inherit'}"> / <input type="number" class="styles" name="font_weight" min="100" max="900" step="100" size="5" value="${g.storage.styles.font_weight || '500'}"></div></div>`,
			`<div><div>${$msg('strokeStyle')}</div><div><label><input type="color" name="stroke_color" value="${g.storage.styles.stroke_color || '#000000'}"></label> / <label>${$msg('strokeOffset')}<input type="number" name="stroke_offset" min="0" step="0.1" size="5" value="${(parseFloat(g.storage.styles.stroke_offset) || 1).toFixed(1)}" data-unit="px">px</label> / <label>${$msg('strokeBlur')}<input type="number" name="strolke_blur" min="0" step="0.1" size="5" value="${(parseFloat(g.storage.styles.stroke_blur) || 0).toFixed(1)}" data-unit="px">px</label></div></div>`,
			`<div><div>${$msg('layerOpacity')}</div><div>${$msg('opacity_0')}<input type="range" class="styles" name="layer_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.layer_opacity) || 1}">${$msg('opacity_1')}</div></div>`,
			`<div><div>${$msg('backgroundOpacity')}</div><div>${$msg('opacity_0')}<input type="range" class="styles" name="background_opacity" min="0" max="1" step="0.05" value="${parseFloat(g.storage.styles.background_opacity) || 0.5}">${$msg('opacity_1')}</div></div>`,
			`<div><div>${$msg('maxWidth')}/${$msg('wordWrap')}</div><div><label><input type="number" class="styles" name="max_width" min="50" size="8" value="${parseInt(g.storage.styles.max_width) || 100}" data-unit="%"><span>%</span></label> /<select name="wrap">${Object.values(g.index.wrap).map(v => `<option value="${v}">` + $msg(`wordWrap_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${$msg('displayLimit')}</div><div><input type="number" class="others" name="limit_number" min="1" size="8" value="${g.storage.others.limit || 100}"><label><input type="checkbox" name="unlimited">${$msg('unlimited')}</label></div></div>`,
			`<div><div>${$msg('containerLimit')}</div><div><input type="number" class="others" name="container_limit_number" min="1" size="8" value="${g.storage.others.container_limit || 20}"><label><input type="checkbox" name="container_unlimited">${$msg('unlimited')}</label></div></div>`,
			`<div><div>${$msg('simultaneousMessage')}</div><div><select name="simultaneous">${Object.values(g.index.simultaneous).map(v => `<option value="${v}">` + $msg(`simultaneousMessage_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${$msg('emojiExpression')}</div><div><select name="emoji">${Object.values(g.index.emoji).map(v => `<option value="${v}">` + $msg(`emojiExpression_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${$msg('overlapping')}</div><div>${['overlapping_transparent', 'overlapping_translate'].map((m, i) => `<label><input type="checkbox" name="overlapping" value="${i}"><span>${$msg(m)}</span></label>`).join('')}</div></div>`,
			`<div><div>${$msg('direction')}</div><div>${['direction_bottom_to_top', 'direction_left_to_right'].map((m, i) => `<label><input type="checkbox" name="direction" value="${i}"><span>${$msg(m)}</span></label>`).join('')}</div></div>`,
			`<div><div>${$msg('layerCSS')}</div><div><input type="text" name="layer_css" placeholder="${$msg('placeholder_customCSS')}" value="${escapeHtml(g.storage.styles.layer_css)}" style="width:20.5em"></div></div>`,
			`<div><div>${$msg('translation')}</div><div><select name="translation" title="${$msg('addableByFirefoxLanguageSettings')}"><option value="0">${$msg('disabled')}${navigator.languages.map((lang, i) => `<option value="${i + 1}">` + lang).join('')}</select>▼ /<label><input type="checkbox" name="prefix_lang"><span>${$msg('prefixOriginalLanguage')}</span></label><br><span>${$msg('exception')}</span>${navigator.languages.map((lang, i) => `<label><input type="checkbox" name="except_lang" value="${i}"><span>${lang}</span></label>`).join('')}</div><div></div></div>`,
			`<div><div>${$msg('hotkey')}</div><div><label><span>${$msg('hotkey_layer')}</span><input type="text" name="hotkey_layer" maxlength="1" size="1" value="${g.storage.hotkeys.layer}"></label> / <label><span>${$msg('hotkey_panel')}</span><input type="text" name="hotkey_panel" maxlength="1" size="1" value="${g.storage.hotkeys.panel}"></label></div></div>`,
			`<div><div>${$msg('autostart')}</div><div><label><select name="autostart"><option value="0">${$msg('disabled')}<option value="1">${$msg('enabled')}</select>▼</div></div>`,
		].join('');
		fields[1].innerHTML = [
			...['normal', 'member', 'moderator', 'owner', 'verified', 'you'].map(type => `<div><div>${$msg(type)}</div><div><div><div><label class="toggle photo" title="${$msg('tooltip_authorPhoto')}"><input type="checkbox" name="${type}_display" value="photo"><svg viewBox="-8 -8 16 16"><g id="yt-lcf-photo"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></g></svg></label><label class="toggle name" title="${$msg('tooltip_authorName')}"><input type="checkbox" name="${type}_display" value="name"><span>${$msg('display_authorName')}</span></label><label class="toggle body" title="${$msg('tooltip_chatMessage')}"><input type="checkbox" name="${type}_display" value="message"><span>${$msg('display_chatMessage')}</span></label></div><div><label title="${$msg('tooltip_customColor')}"><input type="checkbox" name="${type}_display" value="color">${$msg('display_customColor')}</label><input type="color" name="${type}_color"></div></div><input type="text" name="${type}_css" placeholder="${$msg('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.' + type])}"></div></div>`),
			`<div><div>${$msg('superchat')}</div><div><div><div class="superchat"><label class="toggle photo" title="${$msg('tooltip_authorPhoto')}"><input type="checkbox" name="paid_message_display" value="photo">${svg}</label><label class="toggle name" title="${$msg('tooltip_authorName')}"><input type="checkbox" name="paid_message_display" value="name"><span>${$msg('display_authorName')}</span></label><label class="toggle amount" title="${$msg('tooltip_purchaseAmount')}"><input type="checkbox" name="paid_message_display" value="amount"><span>${$msg('display_purchaseAmount')}</span></label><br><label class="toggle body" title="${$msg('tooltip_chatMessage')}"><input type="checkbox" name="paid_message_display" value="message"><span>${$msg('display_chatMessage')}</span></label></div><div><label title="${$msg('tooltip_customColor')}"><input type="checkbox" name="paid_message_display" value="color">${$msg('display_customColor')}</label><input type="color" name="paid_message_color"></div></div><input type="text" name="paid_message_css" placeholder="${$msg('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.paid_message'])}"></div></div>`,
			`<div><div>${$msg('sticker')}</div><div><div><div class="superchat"><label class="toggle photo" title="${$msg('tooltip_authorPhoto')}"><input type="checkbox" name="paid_sticker_display" value="photo">${svg}</label><label class="toggle name" title="${$msg('tooltip_authorName')}"><input type="checkbox" name="paid_sticker_display" value="name"><span>${$msg('display_authorName')}</span></label><label class="toggle amount" title="${$msg('tooltip_purchaseAmount')}"><input type="checkbox" name="paid_sticker_display" value="amount"><span>${$msg('display_purchaseAmount')}</span></label><br><label class="toggle body" title="${$msg('tooltip_sticker')}"><input type="checkbox" name="paid_sticker_display" value="sticker"><span>${$msg('display_sticker')}</span></label></div><div><label title="${$msg('tooltip_stickerSize')}" style="padding:0 0 0 4px">${$msg('display_stickerSize')}: x<input type="number" class="styles" name="sticker_size" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.sticker_size) || 2}" data-unit="em"></label></div></div></div></div>`,
			`<div><div>${$msg('membership')}</div><div><div><div class="superchat"><label class="toggle photo" title="${$msg('tooltip_authorPhoto')}"><input type="checkbox" name="membership_display" value="photo">${svg}</label><label class="toggle name" title="${$msg('tooltip_authorName')}"><input type="checkbox" name="membership_display" value="name"><span>${$msg('display_authorName')}</span></label><label class="toggle body" title="${$msg('tooltip_membershipMessage')}"><input type="checkbox" name="membership_display" value="message"><span>${$msg('display_membershipMessage')}</span></label></div><div><label title="${$msg('tooltip_customColor')}"><input type="checkbox" name="membership_display" value="color">${$msg('display_customColor')}</label><input type="color" name="membership_color"></div></div><input type="text" name="membership_css" placeholder="${$msg('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.membership'])}"></div></div>`,
			`<div><div>${$msg('milestone')}</div><div><div><div class="superchat"><label class="toggle photo" title="${$msg('tooltip_authorPhoto')}"><input type="checkbox" name="milestone_display" value="photo">${svg}</label><label class="toggle name" title="${$msg('tooltip_authorName')}"><input type="checkbox" name="milestone_display" value="name"><span>${$msg('display_authorName')}</span></label><label class="toggle amount" title="${$msg('tooltip_milestoneMonths')}"><input type="checkbox" name="milestone_display" value="months"><span>${$msg('display_milestoneMonths')}</span></label><br><label class="toggle body" title="${$msg('tooltip_chatMessage')}"><input type="checkbox" name="milestone_display" value="message"><span>${$msg('display_chatMessage')}</span></label></div><div><label title="${$msg('tooltip_customColor')}"><input type="checkbox" name="milestone_display" value="color">${$msg('display_customColor')}</label><input type="color" name="milestone_color"></div></div><input type="text" name="milestone_css" placeholder="${$msg('placeholder_customCSS')}" value="${escapeHtml(g.storage.cssTexts['.milestone'])}"></div></div>`,
		].join('');
		fields[2].innerHTML = [
			`<div><div>${$msg('mutedWordsMode')}</div><div><select name="muted_words_mode">${Object.values(g.index.mutedWords).map(v => `<option value="${v}">` + $msg(`mutedWordsMode_${v}`)).join('')}</select>▼</div></div>`,
			`<div><div>${$msg('mutedWordsReplacement')}</div><div><input type="text" name="muted_words_replacement" placeholder="${$msg('placeholder_mutedWordsReplacement')}" style="width:20.5em" value="${g.storage.mutedWords.replacement}" title="${g.storage.mutedWords.mode === g.index.mutedWords.char ? $msg('tooltip_mutedWordsReplacement') : ''}"></div></div>`,
			`<div><div>${$msg('mutedWordsGrammer')}</div><div><label><input type="checkbox" name="muted_words_regexp"><span>${$msg('regexp')}</span></label></div></div>`,
			`<textarea name="muted_words_list" rows="20" placeholder="${$msg('placeholder_mutedWordsList')}" style="width:32em">${g.storage.mutedWords.plainList.join('\n')}</textarea>`,
		].join('');
		fields[3].innerHTML = [
			`<div><div>${$msg('user_defined_css')}</div><div></div></div>`,
			`<textarea name="user_defined_css" rows="30" placeholder=".name::after {\n  content: '\\a';\n}" style="width:32em;font-family:Consolas,'Courier New',monospace">${escapeHtml(g.storage.cssTexts[''] || ('div {\n  ' + (g.storage.cssTexts['div'] || '') + '\n}'))}</textarea>`,
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
					case 'container_unlimited': {
						this.form.container_limit_number.disabled = cb.checked = g.storage.others.container_limit === 0;
						break;
					}
					case 'overlapping':
					case 'direction': {
						const val = parseInt(cb.value);
						cb.checked = g.storage.others[cb.name] & 1 << val ? true : false;
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
			const elem = /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */ (e.target);
			this.updateStorage(elem);
		}, { passive: true });

		const closeBtn = document.createElement('button');
		closeBtn.className = 'ytp-sfn-close ytp-button';
		closeBtn.title = $msg('close');
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
	/** @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} elem */
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
				const replacement = /** @type {HTMLInputElement} */ (this.form.elements['muted_words_replacement']);
				replacement.title = mode === g.index.mutedWords.char ? $msg('tooltip_mutedWordsReplacement') : '';
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
					case 'max_width': g.layer?.updateCurrentItemStyle();
				}
				le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-'), g.storage.styles[name]);
			}
		} else if (name.startsWith('stroke_')) {
			g.storage.styles[name] = elem.value + (elem.dataset.unit || '');
			le?.style.setProperty(name.replace('stroke_', '--yt-lcf-stroke-'), g.storage.styles[name]);
		} else if (name.endsWith('_display') && elem instanceof HTMLInputElement) {
			const match = name.match(/^(.+)_display$/);
			if (match) {
				const [_, type] = match;
				if (type in g.storage.parts && le) {
					if (elem.value !== 'color') {
						g.storage.parts[type][elem.value] = elem.checked;
						le.style.setProperty('--yt-lcf-' + name.replace(/_/g, '-') + '-' + elem.value, elem.checked ? 'inherit' : 'none');
					} else {
						if (elem.checked) {
							g.storage.parts[type].color = /** @type {HTMLInputElement?} */ (this.form.elements[type + '_color'])?.value;
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
					g.storage.parts[type].color = /** @type {HTMLInputElement?} */ (this.form.elements[type + '_color'])?.value;
					le?.style.setProperty('--yt-lcf-' + type.replace('_', '-') + '-color', g.storage.parts[type].color || 'inherit');
				} else {
					g.storage.parts[type].color = null;
					le?.style.removeProperty('--yt-lcf-' + type.replace('_', '-') + '-color');
				}
			}
		} else if (name === 'layer_css') {
			const newCss = /** @type {HTMLInputElement?} */ (this.form.elements[name])?.value || '';
			g.storage.styles.layer_css = newCss;
			const le = g.layer?.element;
			if (le) le.style.cssText = le.style.cssText.replace(/\-\-yt\-lcf\-layer\-css: below;.*$/, '--yt-lcf-layer-css: below; ' + newCss);
		} else if (name.endsWith('_css')) {
			const match = name.match(/^(.*)_css$/);
			if (match) {
				const [_, type] = match;
				const selector = type && type !== 'user_defined' ? '.' + type : '';
				g.storage.cssTexts[selector] = /** @type {HTMLInputElement?} */ (this.form.elements[type + '_css'])?.value || '';
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
					g.storage.mutedWords.regexp = /** @type {HTMLInputElement} */ (this.form.elements['muted_words_regexp']).checked;
					g.storage.mutedWords.plainList = /** @type {HTMLTextAreaElement} */ (this.form.elements['muted_words_list']).value.split(/\n+/).filter(s => s.length > 0);
					updateMutedWordsList();
				}
			}
		} else if (name === 'user_defined_css') {
			g.storage.cssTexts[''] = elem.value;
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
		} else if (['container_unlimited', 'container_limit_number'].includes(name)) {
			const checked = this.form.container_unlimited.checked;
			this.form.container_limit_number.disabled = checked;
			g.storage.others.container_limit = checked ? 0 : this.form.container_limit_number.valueAsNumber;
		}
		browser.storage.local.set(g.storage);
	}
	/** @type {(x: number, y: number) => void} */
	move(x, y) {
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}
}