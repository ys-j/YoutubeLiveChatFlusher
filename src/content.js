/* Copyright 2021 _y_s */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/**
 * @type { { app: HTMLElement?, id: string, layer: HTMLElement?, panel: HTMLElement?, skip: boolean, storage: { [key:string]: * } } }
 */
const g = {
	app: null,
	id: 'youtube-livechat-flusher',
	layer: null,
	panel: null,
	skip: false,
	storage: {
		styles: {
			animation_duration: '4s',
			font_size: '36px',
			background_opacity: '0.5',
		},
		parts: {
			normal: {
				photo: false,
				name: false,
				message: true,
				color: null,
			},
			member: {
				photo: true,
				name: false,
				message: true,
				color: null,
			},
			moderator: {
				photo: true,
				name: true,
				message: true,
				color: null,
			},
			owner: {
				photo: true,
				name: true,
				message: true,
				color: null,
			},
			paid_message: {
				photo: true,
				name: true,
				amount: true,
				message: true,
				color: null,
			},
			paid_sticker: {
				photo: true,
				name: true,
				amount: true,
				sticker: true,
			},
			new_membership: {
				photo: true,
				name: false,
				message: true,
				color: null,
			},
			milestone: {
				photo: true,
				name: true,
				months: true,
				message: true,
				color: null,
			},
		},
	},
};

detectPageType();

function detectPageType() {
	if (location.pathname.startsWith('/live_chat') && top && top.location.pathname === '/watch') {
		g.app = top.document.querySelector('ytd-app');
		if (g.app) {
			startLiveChatFlusher();
			browser.storage.local.get(['styles', 'parts']).then(storage => {
				g.storage.styles = storage && storage.style || g.storage.styles;
				g.storage.parts = storage && storage.parts || g.storage.parts;
				for (const [prop, value] of Object.entries(g.storage.styles)) {
					g.layer?.style.setProperty('--yt-live-chat-flusher-' + prop.replace(/_/g, '-'), value);
				}
				for (const [key, values] of Object.entries(g.storage.parts)) {
					if (values) {
						for (const [prop, bool] of Object.entries(values)) {
							if (prop !== 'color') {
								g.layer?.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-display-${prop}`, bool ? 'inherit' : 'none');
							} else {
								if (bool) {
									g.layer?.style.setProperty(`--yt-live-chat-flusher-${key.replace(/_/g, '-')}-color`, bool);
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
					if (layer) layer.innerHTML = '';
					break;
				}
			}
		}, { passive: true });
	} else {
		window.addEventListener('yt-navigate-finish', e => {
			detectPageType();
		}, { passive: true });
	}
}

function startLiveChatFlusher() {
	if (!g.app) return;
	const video = g.app.querySelector('video');
	const videoContainer = g.app.querySelector('video')?.parentElement;
	
	if (video && videoContainer) {
		g.layer = (() => {
			const oldOne = g.app.querySelector(`#${g.id}`);
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
		})();
		videoContainer.insertAdjacentElement('afterend', g.layer);
		
		const timer = setInterval(() => {
			const renderer = document.querySelector('yt-live-chat-renderer');
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
	const checkbox = g.app.querySelector(`#${g.id}-checkbox`), popupmenu = g.app.querySelector(`#${g.id}-popupmenu`);
	if (checkbox && popupmenu) {
		checkbox.remove(), popupmenu.remove();
	}
	/** @type {HTMLElement?} */
	const ytpPanelMenu = g.app.querySelector('#ytp-id-17 .ytp-panel .ytp-panel-menu');
	if (ytpPanelMenu) {
		ytpPanelMenu.insertAdjacentHTML('beforeend', `<div id="${g.id}-checkbox" class="ytp-menuitem" aria-checked="true" role="menuitemcheckbox" tabindex="0" onclick="var c=this.getAttribute('aria-checked')==='true';this.setAttribute('aria-checked',(!c).toString());var l=document.getElementById('${g.id}');if(l){l.hidden=c;l.setAttribute('aria-hidden',c.toString())}"><div class="ytp-menuitem-icon"></div><div class="ytp-menuitem-label">チャットを流す</div><div class="ytp-menuitem-content"><div class="ytp-menuitem-toggle-checkbox"></div></div></div><div id="${g.id}-popupmenu" class="ytp-menuitem" aria-haspopup="true" role="menuitem" tabindex="0" onclick="var p=document.getElementById('${g.id}-panel');if(p){p.hidden = !p.hidden;p.style.display=p.style.display==='none'?'block':'none'}"><div class="ytp-menuitem-icon"></div><div class="ytp-menuitem-label">チャット設定</div><div class="ytp-menuitem-content"></div></div>`);
	}
	g.panel = (() => {
		const oldOne = g.app.querySelector(`#${g.id}-panel`);
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
	})();
	if (g.layer) {
		g.layer.after(g.panel);
		g.panel.onkeydown = e => {
			e.stopPropagation();
		};
	}
	const closeBtn = document.createElement('button');
	closeBtn.className = 'html5-video-info-panel-close ytp-button';
	closeBtn.title = 'close';
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
			'<div>アニメーション秒数</div>',
			`<div><label><input type="number" class="styles" name="animation_duration" min="1" max="10" step="0.1" size="5" value="${parseFloat(g.storage.styles.animation_duration)}" data-unit="s"> s</label></div>`,
		],
		[
			'<div>フォントサイズ</div>',
			`<div><label><input type="number" class="styles" name="font_size" min="12" size="5" value="${parseInt(g.storage.styles.font_size)}" data-unit="px"> px</label></div>`,
		],
		[
			'<div>背景の透過度</div>',
			`<div>透過<input type="range" class="styles" name="background_opacity" min="0" max="1" step="0.1" value="${parseFloat(g.storage.styles.background_opacity)}">不透過</div>`,
		],
		[
			'<div>通常</div>',
			`<div><label class="toggle photo" title="Author Photo"><input type="checkbox" name="normal_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="normal_display" value="name" ><span>名前</span></label><label class="toggle body" title="Chat Message"><input type="checkbox" name="normal_display" value="message"><span>本文</span></label></div>`,
			`<div><label title="Custom Color"><input type="checkbox" name="normal_display" value="color">カスタム色</label><input type="color" name="normal_color"></div>`,
		],
		[
			'<div>メンバー</div>',
			`<div><label class="toggle photo" title="Author Photo"><input type="checkbox" name="member_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="member_display" value="name"><span>名前</span></label><label class="toggle body" title="Chat Message"><input type="checkbox" name="member_display" value="message"><span>本文</span></label></div>`,
			`<div><label title="Custom Color"><input type="checkbox" name="member_display" value="color">カスタム色</label><input type="color" name="member_color"></div>`,
		],
		[
			'<div>モデレーター</div>',
			`<div><label class="toggle photo" title="Author Photo"><input type="checkbox" name="moderator_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="moderator_display" value="name"><span>名前</span></label><label class="toggle body" title="Chat Message"><input type="checkbox" name="moderator_display" value="message"><span>本文</span></label></div>`,
			`<div><label title="Custom Color"><input type="checkbox" name="moderator_display" value="color">カスタム色</label><input type="color" name="moderator_color"></div>`,
		],
		[
			'<div>チャンネル管理者</div>',
			`<div><label class="toggle photo" title="Author Photo"><input type="checkbox" name="owner_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="owner_display" value="name"><span>名前</span></label><label class="toggle body" title="Chat Message"><input type="checkbox" name="owner_display" value="message"><span>本文</span></label></div>`,
			`<div><label title="Custom Color"><input type="checkbox" name="owner_display" value="color">カスタム色</label><input type="color" name="owner_color"></div>`,
		],
		[
			'<div>スーパーチャット</div>',
			`<div class="superchat"><label class="toggle photo" title="Author Photo"><input type="checkbox" name="paid_message_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="paid_message_display" value="name"><span>名前</span></label><label class="toggle amount" title="Purchase Amount"><input type="checkbox" name="paid_message_display" value="amount"><span>金額</span></label><br><label class="toggle body" title="Chat Message"><input type="checkbox" name="paid_message_display" value="message"><span>本文</span></label></div>`,
			`<div><label title="Custom Color"><input type="checkbox" name="paid_message_display" value="color">カスタム色</label><input type="color" name="paid_message_color"></div>`,
		],
		[
			'<div>ステッカー</div>',
			`<div class="superchat"><label class="toggle photo" title="Author Photo"><input type="checkbox" name="paid_sticker_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="paid_sticker_display" value="name"><span>名前</span></label><label class="toggle amount" title="Purchase Amount"><input type="checkbox" name="paid_sticker_display" value="amount"><span>金額</span></label><br><label class="toggle body" title="Sticker"><input type="checkbox" name="paid_sticker_display" value="sticker"><span>ステッカー</span></label></div>`,
		],
		[
			'<div>新規メンバー</div>',
			`<div class="superchat"><label class="toggle photo" title="Author Photo"><input type="checkbox" name="new_membership_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="new_membership_display" value="name"><span>名前</span></label><label class="toggle body" title="Chat Message"><input type="checkbox" name="new_membership_display" value="message"><span>本文</span></label></div>`,
			`<div><label title="Custom Color"><input type="checkbox" name="new_membership_display" value="color">カスタム色</label><input type="color" name="new_membership_color"></div>`,
		],
		[
			'<div>マイルストーン</div>',
			`<div class="superchat"><label class="toggle photo" title="Author Photo"><input type="checkbox" name="milestone_display" value="photo"><svg class="photo" viewBox="-8 -8 16 16"><circle r="7"/><ellipse rx="2.5" ry="3.5" cy="-1"/><ellipse rx="4" ry="2" cy="4"/></svg></label><label class="toggle name" title="Author Name"><input type="checkbox" name="milestone_display" value="name"><span>名前</span></label><label class="toggle amount" title="Purchase Amount"><input type="checkbox" name="milestone_display" value="months"><span>月数</span></label><br><label class="toggle body" title="Milestone Message"><input type="checkbox" name="milestone_display" value="message"><span>本文</span></label></div>`,
			`<div><label title="Custom Color"><input type="checkbox" name="milestone_display" value="color">カスタム色</label><input type="color" name="milestone_color"></div>`,
		],
	].map(row => '<div>' + row.join('') + '</div>').join(''));
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
							picker.value = g.storage.parts[type].color;
						}
						break;
					}
				}
			}
		}
	});
	form.addEventListener('change', e => {
		const elem = /** @type {HTMLInputElement} */ (e.target);
		const name = elem.name;
		if (elem.classList.contains('styles')) {
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
							g.layer?.style.setProperty('--yt-live-chat-flusher-' + type.replace(/_/g, '-') + '-color', g.storage.parts[type].color);
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
				if (elem.previousElementSibling?.firstElementChild.checked) {
					g.storage.parts[type].color = form.elements[type + '_color']?.value;
					g.layer?.style.setProperty('--yt-live-chat-flusher-' + type.replace('_', '-') + '-color', g.storage.parts[type].color);
				} else {
					g.storage.parts[type].color = null;
					g.layer?.style.removeProperty('--yt-live-chat-flusher-' + type.replace('_', '-') + '-color');
				}
			}
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
			for (const action of actions) {
				const loop = handleChatAction(action);
				if (g.skip && !loop) {
					break;
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

function handleChatAction(action) {
	if (action.addChatItemAction) {
		const item = action.addChatItemAction.item;
		const fs = parseInt(g.storage.styles.font_size), lh = fs * 1.25;
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
					// elem.dataset.line = `${y}`;
					elem.style.top = `${y * 1.25}em`;
					if (!children.some(before => isCatchable(before, elem)) && !isOverflow(g.layer, elem)) {
						return false;
					}
				} else {
					// elem.dataset.line = '0';
					elem.style.top = '0px';
					return false;
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
				// elem.dataset.line = `${ln}`;
				elem.style.top = `${ln * 1.25}em`;
			} while (isOverflow(g.layer, elem) && y-- > 0);
			return false;
		}
	} else if (action.markChatItemAsDeletedAction) {
		g.layer?.querySelector('#' + action.markChatItemAsDeletedAction.targetItemId)?.remove();
	}
	return true;
}

/**
 * 
 * @param {LiveChat.TextMessageRenderer | LiveChat.MembershipItemRenderer | LiveChat.PaidMessageRenderer | LiveChat.PaidStickerRenderer} item 
 */
function parseChatItem(item) {
	if ('liveChatTextMessageRenderer' in item) {
		const renderer = item.liveChatTextMessageRenderer;
		const message = getMessage(renderer.message);
		const author = getAuthor(renderer);
		const span = document.createElement('span');
		span.id = renderer.id;
		span.className = 'text ' + (author.class ? author.class.join(' ') : 'normal');
		/*
		const type = (cl => {
			if (cl.contains('owner')) return 'owner';
			if (cl.contains('moderator')) return 'moderator';
			if (cl.contains('member')) return 'member';
			return 'normal';
		})(span.classList);
		*/
		span.dataset.author = author.name;
		span.innerHTML = `<span class="header"><img class="photo" src="${author.photo[0].url}" loading="lazy"><span class="name">${author.name}</span></span><span class="body">${message}</span>`;
		return span;
	} else if ('liveChatMembershipItemRenderer' in item) {
		const renderer = item.liveChatMembershipItemRenderer;
		const message = getMessage(renderer.message);
		const author = getAuthor(renderer);
		const div = document.createElement('div');
		div.id = renderer.id;
		div.dataset.author = author.name;
		const headerText = (() => {
			if (renderer.headerPrimaryText) {
				div.className = 'milestone';
				return getMessage(renderer.headerPrimaryText, 1);
			} else if (renderer.headerSubtext) {
				div.className = 'newmember';
				return getMessage(renderer.headerSubtext);
			}
			div.className = 'newmember';
			return '';
		})();
		div.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-live-chat-flusher-background-opacity));">\
<img class="photo" src="${author.photo[0].url}" loading="lazy">\
<span class="name">${author.name}</span>\
<span class="month">${headerText}</span>\
</div><div class="body" style="background-color:rgba(${getColorRGB(0xff0a8043).join()},var(--yt-live-chat-flusher-background-opacity));">${message}</div>`;
		return div;
	} else if ('liveChatPaidMessageRenderer' in item) {
		const renderer = item.liveChatPaidMessageRenderer;
		const message = getMessage(renderer.message);
		const author = getAuthor(renderer);
		const div = document.createElement('div');
		div.id = renderer.id;
		div.className = 'paid';
		div.dataset.author = author.name;
		div.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.headerBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">\
<img class="photo" src="${author.photo[0].url}" loading="lazy">\
<span class="name">${author.name}</span>\
<span class="amount">${renderer.purchaseAmountText.simpleText}</span>\
</div><div class="body" style="background-color:rgba(${getColorRGB(renderer.bodyBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">${message}</div>`;
		return div;
	} else if ('liveChatPaidStickerRenderer' in item) {
		const renderer = item.liveChatPaidStickerRenderer;
		const author = getAuthor(renderer);
		const sticker = renderer.sticker.thumbnails.find(t => 2 * 36 <= t.width) || renderer.sticker.thumbnails.pop();
		const div = document.createElement('div');
		div.id = renderer.id;
		div.className = 'sticker';
		div.dataset.author = author.name;
		div.innerHTML = `<div class="header" style="background-color:rgba(${getColorRGB(renderer.backgroundColor).join()},var(--yt-live-chat-flusher-background-opacity))">\
<img class="photo" src="${author.photo[0].url}" loading="lazy">\
<span class="name">${author.name}</span>\
<span class="amount">${renderer.purchaseAmountText.simpleText}</span>\
</div>` + (sticker ? `<figure class="body" style="background-color:rgba(${getColorRGB(renderer.moneyChipBackgroundColor).join()},var(--yt-live-chat-flusher-background-opacity)">\
<img src="${sticker.url}"></figure>` : '');
		return div;
	}
}

/**
 * 
 * @param {Element} before 
 * @param {Element} after 
 */
function isCatchable(before, after) {
	const sec = 4;
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
 * @param { number } long
 */
function getColorRGB(long) {
	return (long.toString(16).match(/[0-9a-f]{2}/g) || []).map(hex => parseInt(hex, 16)).slice(1);
}

/**
 * @param {LiveChat.Runs|LiveChat.SimpleText|undefined } message
 * @param {number} startIndex
 * @param {number} endIndex
 */
function getMessage(message, startIndex = 0, endIndex = 0) {
	if (message) {
		if ('runs' in message) {
			const runs = startIndex || endIndex ? message.runs.slice(startIndex, endIndex || undefined) : message.runs;
			return runs.map(r => {
				if ('text' in r) {
					return r.text;
				} else {
					const thumbnail = r.emoji.image.thumbnails.pop();
					return thumbnail ? `<img class="emoji" src="${thumbnail.url}">` : `<span class="emoji">${r.emoji.emojiId}</span>`;
				}
			}).join('');
		} else {
			const text = startIndex || endIndex ? message.simpleText.slice(startIndex, endIndex || undefined): message.simpleText;
			return text;
		}
	} else {
		return '';
	}
}

/**
 * @param {LiveChat.RendererContent} renderer
 */
function getAuthor(renderer) {
	return {
		class: renderer.authorBadges?.map(b => b.liveChatAuthorBadgeRenderer.customThumbnail ? 'member' : b.liveChatAuthorBadgeRenderer.icon?.iconType.toLowerCase()),
		name: renderer.authorName.simpleText,
		photo: renderer.authorPhoto.thumbnails,
	};
}