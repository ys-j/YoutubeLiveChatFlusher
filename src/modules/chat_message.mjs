/// <reference lib="esnext" />

import { fetchInnerTube } from './innertube.mjs';
import { store as s } from './store.mjs';
import { filterMessage, getColorRGB, getText } from './utils.mjs';

/** @enum {string} */
const AuthorType = Object.freeze({
	NORMAL: 'normal',
	MEMBER: 'member',
	MODERATOR: 'moderator',
	OWNER: 'owner',
	VERIFIED: 'verified',
});

/** @enum {number} */
export const EmojiModeEnum = Object.freeze({
	NONE: 0,
	ALL: 1,
	LABEL: 2,
	SHORTCUT: 3,
});

/** @enum {number} */
export const MutedWordModeEnum = Object.freeze({
	NONE: 0,
	ALL: 1,
	WORD: 2,
	CHAR: 3,
});

/** @type {RegExp[]} */
const mutedWordsList = [];

export class LiveChatLayoutCache {
	/** @type {Map<string, ChatLayoutInfo>} */
	#map;
	/**
	 * @param {ShadowRoot} root 
	 */
	constructor(root) {
		this.dom = root;
		this.#map = new Map();
	}

	get size() {
		return this.#map.size;
	}

	/**
	 * @param {string} id 
	 * @returns {ChatLayoutInfo | undefined}
	 */
	get(id) {
		return this.#map.get(id);
	}

	/**
	 * @param {string} id 
	 * @param {ChatLayoutInfo} layout 
	 * @returns {Map<string, ChatLayoutInfo>}
	 */
	set(id, layout) {
		return this.#map.set(id, layout);
	}

	/**
	 * @param {string} id 
	 */
	delete(id) {
		return this.#map.delete(id);
	}

	clear() {
		this.#map.clear();
	}

	/**
	 * @param {number} overline 
	 * @returns {ChatLayoutInfo[][]}
	 */
	groupByLine(overline) {
		/** @type {ChatLayoutInfo[][]} */
		const grouped = Array.from({ length: overline }, () => []);
		for (const v of this.#map.values()) {
			grouped[v.line]?.push(v);
		}
		return grouped;
	}

	/**
	 * @param {ChatLayoutInfo} target 
	 * @param {boolean} [reversed=false] 
	 * @returns {boolean} if this message collides against any preceding layout
	 */
	anyCollides(target, reversed = false) {
		/** @param {ChatLayoutInfo} b */
		const judge = b => b.line <= target.line && target.isCollidable(b, reversed);
		return this.#map.values().some(judge);
	}
}

/**
 * Gets the author type of the message.
 * @param {LiveChat.RendererContent} renderer message renderer
 * @returns author type
 */
function getAuthorType(renderer) {
	const authorTypes = Object.values(AuthorType);
	const classes = renderer.authorBadges?.map(b => {
		const bb = b.liveChatAuthorBadgeRenderer;
		return bb.customThumbnail ? AuthorType.MEMBER : bb.icon?.iconType.toLocaleLowerCase() || '';
	}) || [];
	for (const s of authorTypes) if (classes.includes(s)) return s;
	return AuthorType.NORMAL;
}

/** @type {Map<string, string>} */
const authorNameCache = new Map();

export class LiveChatItemLayout {
	/** @type {string} */ #key;
	/** @type {LiveChat.RendererContent} */ #renderer;
	/** @type {DocumentFragment} */ #authorFragment;
	/** @type {HTMLElement} */ element;
	/** @type {string} */ id;
	/** @type {ChatMessageContainer} */ message;

	/**
	 * @param {LiveChat.AnyRenderer} item message renderer
	 */
	constructor(item) {
		this.#key = Object.keys(item)[0];
		// @ts-ignore
		this.#renderer = item[this.#key];

		this.element = document.createElement('div');
		this.id = this.element.id = this.#renderer.id || '';
		
		this.#authorFragment = document.createDocumentFragment();
		this.message = new ChatMessageContainer(this.#renderer.message);
	}

	/**
	 * Renders a chat item element from the message renderer.
	 * @returns {Promise<HTMLElement?>} promise of chat item element or null
	 */
	async render() {
		const messageType = this.messageType;
		/** @type {Promise<any>[]} */
		const promises = [ this.getAuthorName(messageType) ];

		const langIndex = s.others.translation;
		const langSuffix = s.others.suffix_original;
		const nl = navigator.languages;
		const tl = ['', ...nl][Math.abs(langIndex)];
		if (tl) {
			const lazy = s.others.translation_timing ?? 0;
			const translating = this.message.translate(lazy ? 'lazy' : 'eager', tl, !!langSuffix);
			promises.push(translating);
		}
		await Promise.all(promises);

		switch (this.#key) {
			case 'liveChatTextMessageRenderer': {
				const allHidden = !Object.values(s.parts[messageType ?? 'normal']).includes(true);
				if (allHidden) return null;
				this.element.className = 'text ' + (messageType ?? 'normal');
				const header = document.createElement('span');
				header.className = 'header';
				header.appendChild(this.#authorFragment);
				const body = document.createElement('span');
				body.part = 'message';
				body.className = 'body';
				body.append(...this.message);
				this.element.append(header, body);
				this.element.setAttribute('data-text', getText(this.#renderer.message));
				return this.element;
			}
			case 'liveChatMembershipItemRenderer': {
				const {
					headerPrimaryText: primary,
					headerSubtext: sub,
				} = /** @type {LiveChat.MembershipItemRenderer["liveChatMembershipItemRenderer"]} */ (this.#renderer);
				this.element.className = messageType ?? 'membership';
				const allHidden = !Object.values(s.parts[messageType ?? 'membership']).includes(true);
				if (allHidden) return null;
				const header = document.createElement('div');
				header.className = 'header';
				header.style.backgroundColor = `rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))`;
				const months = document.createElement('span');
				months.part = months.className = 'months';
				months.append(...getChatMessage(primary || sub, { start: primary ? 1 : 0, filterMode: 0 }));
				header.append(this.#authorFragment, months);
				const body = document.createElement('div');
				body.part = 'message';
				body.className = 'body';
				body.style.backgroundColor = `rgba(${getColorRGB(0xff0a8043).join()},var(--yt-lcf-background-opacity))`;
				body.append(...this.message);
				this.element.append(header, body);
				return this.element;
			}
			case 'liveChatPaidMessageRenderer': {
				const allHidden = !Object.values(s.parts.paid_message).includes(true);
				if (allHidden) return null;
				const {
					headerBackgroundColor,
					purchaseAmountText,
					bodyBackgroundColor,
				} = /** @type {LiveChat.PaidMessageRenderer["liveChatPaidMessageRenderer"]} */ (this.#renderer);
				this.element.className = 'superchat';
				const header = document.createElement('div');
				header.className = 'header';
				header.style.backgroundColor = `rgba(${getColorRGB(headerBackgroundColor).join()},var(--yt-lcf-background-opacity))`;
				const amount = document.createElement('span');
				amount.part = amount.className = 'amount';
				amount.append(getText(purchaseAmountText));
				header.append(this.#authorFragment, amount);
				const body = document.createElement('div');
				body.part = 'message';
				body.className = 'body';
				body.style.backgroundColor = `rgba(${getColorRGB(bodyBackgroundColor).join()},var(--yt-lcf-background-opacity))`;
				body.append(...this.message);
				this.element.append(header, body);
				return this.element;
			}
			case 'liveChatPaidStickerRenderer': {
				const allHidden = !Object.values(s.parts.paid_sticker).includes(true);
				if (allHidden) return null;
				const { backgroundColor, purchaseAmountText, moneyChipBackgroundColor, sticker }
					= /** @type {LiveChat.PaidStickerRenderer["liveChatPaidStickerRenderer"]} */ (this.#renderer);
				this.element.className = 'supersticker';
				const header = document.createElement('div');
				header.className = 'header';
				header.style.backgroundColor = `rgba(${getColorRGB(backgroundColor).join()},var(--yt-lcf-background-opacity))`;
				const amount = document.createElement('span');
				amount.part = amount.className = 'amount';
				amount.append(getText(purchaseAmountText));
				header.append(this.#authorFragment, amount);
				const body = document.createElement('figure');
				body.part = 'sticker';
				body.className = 'body';
				body.style.backgroundColor = `rgba(${getColorRGB(moneyChipBackgroundColor).join()},var(--yt-lcf-background-opacity)`;
				const image = new Image();
				image.className = 'sticker';
				image.src = (sticker.thumbnails.find(t => 2 * 36 <= (t.width || 36)) || sticker.thumbnails[0]).url;
				image.loading = 'lazy';
				body.appendChild(image);
				this.element.append(header, body);
				return this.element;
			}
			case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer': {
				const allHidden = !Object.values(s.parts.membership).includes(true);
				if (allHidden) return null;
				this.element.className = 'membership gift';
				const {
					header, // @ts-ignore
				} = /** @type {LiveChat.SponsorshipsGiftPurchaseAnnouncementRenderer["liveChatSponsorshipsGiftPurchaseAnnouncementRenderer"]} */ (this.#renderer);
				const headerRenderer = header.liveChatSponsorshipsHeaderRenderer;
				const count = headerRenderer.primaryText?.runs?.filter(r => !Number.isNaN(parseInt(r.text)))[0]?.text;
				if (!count) break;
				const div = document.createElement('div');
				div.className = 'header';
				div.style.backgroundColor = `rgba(${getColorRGB(0xff0f9d58).join()},var(--yt-lcf-background-opacity))`;
				const gifts = document.createElement('span');
				gifts.part = gifts.className = 'gifts';
				gifts.textContent = `\u{1f381}\ufe0e ${count}`;
				div.append(this.#authorFragment, gifts);
				this.element.appendChild(div);
				return this.element;
			}
			case 'liveChatViewerEngagementMessageRenderer': {
				const {
					icon, // @ts-ignore
				} = /** @type {LiveChat.ViewerEngagementMessageRenderer["liveChatViewerEngagementMessageRenderer"]} */ (this.#renderer);
				switch (icon.iconType) {
					case 'POLL': {
						this.element.className = 'engagement-poll';
						const div = document.createElement('div');
						div.part = 'message';
						div.className = 'body';
						this.element.append(...this.message);
						break;
					}
					case 'YOUTUBE_ROUND': break;
					default: console.log(this.#renderer);
				}
				break;
			}
			case 'liveChatPlaceholderItemRenderer':
			case 'liveChatSponsorshipsGiftRedemptionAnnouncementRenderer':
				break;
			// liveChatModeChangeMessageRenderer
			default: console.log({ [this.#key]: this.#renderer });
		}
		return null;
	}

	get messageType() {
		switch (this.#key) {
			case 'liveChatTextMessageRenderer':
				return getAuthorType(this.#renderer);
			case 'liveChatMembershipItemRenderer':
				return 'headerPrimaryText' in this.#renderer ? 'milestone': 'membership';
			case 'liveChatPaidMessageRenderer':
				return 'paid_message';
			case 'liveChatPaidStickerRenderer':
				return 'paid_sticker';
			case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer':
				return 'membership';
			default:
				return null;
		}
	}

	/**
	 * Fetches author name, and then renders the name and thumbnail.
	 * @param {keyof typeof s.parts | null} messageType 
	 * @returns {Promise<string?>}
	 */
	async getAuthorName(messageType) {
		const authorId = this.#renderer.authorExternalChannelId;
		this.element.setAttribute('data-author-id', authorId);

		/** @type {string | undefined} */
		let authorName;
		if (s.others.show_username && authorId) {
			if (authorNameCache.has(authorId)) {
				authorName = authorNameCache.get(authorId);
			} else if (messageType && s.parts[messageType].name) {
				const url = new URL('/youtubei/v1/browse', location.origin);
				try {
					const json = await fetchInnerTube(url, { browseId: authorId });
					authorName = json?.header?.pageHeaderRenderer?.pageTitle;
					if (authorName) authorNameCache.set(authorId, authorName);
				} catch (reason) {
					console.error(reason);
				}
			}
		}
		authorName ||= getText(this.#renderer.authorName);
		if (!authorName) return null;
		this.element.setAttribute('data-author-name', authorName);

		const a = document.createElement('a');
		a.href = `/channel/${authorId}`;
		a.target = '_blank';
		a.title = authorName;
		
		const img = new Image();
		img.part = img.className = 'photo';
		img.src = this.#renderer.authorPhoto.thumbnails[0].url;
		img.loading = 'lazy';
		a.appendChild(img);
		
		const span = document.createElement('span');
		span.part = span.className = 'name';
		span.textContent = authorName;
		
		this.#authorFragment.append(a, span);
		return authorName;
	}

	/**
	 * Appends this element to the shadow root.
	 * @param {LiveChatLayoutCache} cache layout cache object
	 * @param {"dense" | "random"} [mode="dense"] layout mode
	 * @returns {string} renderer id
	 */
	appendTo(cache, mode = 'dense') {
		this.element.style.visibility = 'hidden';
		cache.dom.appendChild(this.element);

		const hh = cache.dom.host.clientHeight, hw = cache.dom.host.clientWidth;
		const ch = this.element.clientHeight, cw = this.element.clientWidth;
		if (cw >= hw * (parseInt(s.styles.max_width) / 100 || 1)) {
			this.element.classList.add('wrap');
		}
		
		this.element.style.setProperty('--yt-lcf-translate-x', `-${hw + cw}px`);

		const body = /** @type {HTMLElement?} */ (this.element.lastElementChild);
		if (body) {
			const content = body.textContent;
			if (content) {
				browser.i18n.detectLanguage(content).then(result => {
					if (result.isReliable) {
						body.lang = result.languages[0].language;
					}
				});
			}
		}

		const fs = Number.parseInt(s.styles.font_size) || 36;
		const lhf = Number.parseFloat(s.styles.line_height) || 1.4;

		let y = 0;
		/** @type {ChatLayoutInfo} */
		let layout;
		
		const dir = s.others.direction & 1 ? 'bottom' : 'top';
		if (ch >= hh) {
			this.element.style[dir] = '0px';
			this.element.setAttribute('data-line', '0');
			this.element.style.visibility = '';
			layout = new ChatLayoutInfo(this.element, y);
			cache.set(this.id, layout);
			return this.id;
		}
		const overline = Math.floor(hh / fs * lhf);
		const reversed = (s.others.direction & 2) > 0;
		const parentRect = {
			top: cache.dom.host.clientTop,
			height: hh,
		};
		
		switch (mode) {
			case 'dense': {
				if (cache.size === 0) {
					this.element.style[dir] = '0px';
					this.element.setAttribute('data-line', '0');
					layout = new ChatLayoutInfo(this.element, y);
					this.element.style.visibility = '';
					cache.set(this.id, layout);
					return this.id;
				}
				do {
					this.element.style[dir] = `${y * lhf}em`;
					this.element.setAttribute('data-line', `${y}`);
					layout = new ChatLayoutInfo(this.element, y);
					const overflow = layout.isOverflow(parentRect);
					if (overflow) continue;
					const collidable = cache.anyCollides(layout, reversed);
					if (collidable) continue;
					this.element.style.visibility = '';
					cache.set(this.id, layout);
					return this.id;
				} while (++y <= overline);

				this.element.classList.add('overlap');
				const st = s.others.overlapping;
				const o = st & 0b01 ? .8 : 1;
				const dy = st & 0b10 ? .5 : 0;

				const grouped = cache.groupByLine(overline);
				y = grouped.reduce((pi, cv, ci, arr) => cv.length < arr[pi].length ? ci : pi, 0);
				this.element.setAttribute('data-line', `${y}`);
				layout = new ChatLayoutInfo(this.element, y);
				const len = grouped[y].filter(layout => layout.isCollidable(layout)).length || 1;
				this.element.style.top = `${(y + dy) * lhf}em`;
				this.element.style.opacity = `${Math.max(.5, Math.pow(o, len))}`;
				this.element.style.zIndex = `-${len}`;
				this.element.style.visibility = '';
				cache.set(this.id, layout);
				return this.id;
			}
			
			case 'random': {
				if (cache.size === 0) {
					y = Math.floor(overline * Math.random());
					this.element.style[dir] = `${y * lhf}em`;
					this.element.setAttribute('data-line', `${y}`);
					layout = new ChatLayoutInfo(this.element, y);
					this.element.style.visibility = '';
					cache.set(this.id, layout);
					return this.id;
				}
				const calculatedLine = new Set(Array(overline).keys());
				do {
					y = Math.floor(overline * Math.random());
					this.element.style[dir] = `${y * lhf}em`;
					this.element.setAttribute('data-line', `${y}`);
					layout = new ChatLayoutInfo(this.element, y);
					const overflow = layout.isOverflow(parentRect);
					if (overflow) {
						for (let i = y; i < overline; i++) calculatedLine.delete(i);
						continue;
					}
					const collidable = cache.anyCollides(layout, reversed);
					if (collidable) {
						calculatedLine.delete(y);
						continue;
					}
					break;
				} while (calculatedLine.size > 0);
				this.element.style.visibility = '';
				cache.set(this.id, layout);
				return this.id;
			}
		}
	}
}


class ChatLayoutInfo {
	/** @type {DOMRect} */ #rect;
	/**
	 * @param {HTMLElement} elem 
	 * @param {number} [line] 
	 */
	constructor(elem, line = undefined) {
		this.#rect = elem.getBoundingClientRect();
		this.line = line ?? Number.parseInt(elem.getAttribute('data-line') || '0');

		const computedStyle = getComputedStyle(elem);
		const [_durMatch, durNum, durUnit] = computedStyle.animationDuration.match(/^([\d\.]+)(\D+)/) || [];
		const durFactor = durNum && durUnit && { 's': 1000, 'ms': 1 }[durUnit] || 0;
		this.duration = durFactor ? Number.parseFloat(durNum) * durFactor : Number.parseFloat(s.styles.animation_duration) * 1000;

		const [_translateMatch, translateX] = elem.style.getPropertyValue('--yt-lcf-translate-x').match(/^-?([\d\.]+)px/) || [];
		this.speed = Number.parseFloat(translateX) / this.duration;
		this.createdOn = Date.now();
	}

	get width() {
		return this.#rect.width;
	}
	get height() {
		return this.#rect.height;
	}
	get top() {
		return this.#rect.top;
	}
	get bottom() {
		return this.#rect.bottom;
	}
	get left() {
		const elapsed = Date.now() - this.createdOn;
		return this.#rect.left - this.speed * elapsed;
	}
	get right() {
		const elapsed = Date.now() - this.createdOn;
		return this.#rect.right - this.speed * elapsed;
	}

	/**
	 * Checks whether two flowing messages collide.
	 * @param {ChatLayoutInfo} before other preceding layout
	 * @param {boolean} [reversed=false] if direction is reversed
	 * @returns {boolean} whether this message collides against the preceding message
	 */
	isCollidable(before, reversed = false) {
		if (before.top <= this.top && this.top < before.bottom) {
			if (reversed ? before.left <= this.right : this.left <= before.right) {
				return true;
			} else if (before.duration <= this.duration && before.width >= this.width) {
				return false;
			} else {
				const speedDiff = this.width / this.duration - before.width / before.duration;
				const posDiff = reversed ? before.left - this.right : this.left - before.right;
				return posDiff < speedDiff * Math.min(before.duration, this.duration);
			}
		} else {
			return false;
		}
	}

	/**
	 * Checks whether this element's position exceeds the size of parent.
	 * @param { { top: number, height: number } } parent parent bounding box
	 * @returns {boolean} whether child element is overflowing the parent
	 */
	isOverflow(parent) {
		return this.bottom > parent.top + parent.height;
	}
}


/**
 * @typedef LanguageDetection
 * @prop {string} source
 * @prop {boolean} isReliable
 */

/**
 * @typedef TranslationControllerOptions
 * @prop {object} translation
 * @prop {string} translation.translator
 * @prop {string} translation.url
 * @prop {boolean} translation.regexp
 * @prop {string[]} translation.plainList
 * @prop {object} others
 * @prop {number} others.except_lang
 */

class TranslationController {
	/**
	 * @param {TranslationControllerOptions} options
	 */
	constructor(options) {
		this.mode = options.translation.translator;
		this.templateUrl = options.translation.url;

		this.exceptedLanguages = navigator.languages.filter((_, i) => options.others.except_lang & 1 << i);

		const re = options.translation.regexp;
		const list = options.translation.plainList;
		this.exceptionRules = re ? {
			rules: list.map(r => new RegExp(r)),
			/** @param {string} s text */
			match(s) {
				for (const r of this.rules) if (r.test(s)) return true;
				return false;
			},
		}: {
			rules: list,
			/** @param {string} s text */
			match(s) {
				for (const r of this.rules) if (s.includes(r)) return true;
				return false;
			}
		};
	}

	/**
	 * Checks if the message will be translated.
	 * @param {string} text original message
	 * @returns {Promise<LanguageDetection>} detection result
	 */
	async check(text) {
		if (!text) throw 'Empty text was passed.';
		const detection = await browser.i18n.detectLanguage(text);
		const source = detection.languages.at(0)?.language;
		if (!source) throw 'Failed to detect the source language.';
		if (this.exceptedLanguages.includes(source)) {
			throw `Source language (${source}) is set as exceptions: ` + this.exceptedLanguages.join();
		}
		if (this.exceptionRules.match(text)) {
			throw 'Text contains an exception word.';
		}
		return { source, isReliable: detection.isReliable };
	}

	/**
	 * 
	 * @param {Record<string, string>} replacer 
	 */
	getReadyUrl(replacer) {
		let url = this.templateUrl;
		for (const [k, v] of Object.entries(replacer)) {
			url = url.replace(k, v);
		}
		return url;
	}

	/**
	 * @param {Node} node `<span>` element or text node
	 * @param {LanguageDetection} detection source launguage detection
	 * @param {string} target target launguage
	 * @returns {Promise<Node>} translated node
	 */
	async translateNode(node, detection, target) {
		const text = node.textContent;
		if (!text) return node;

		const span = document.createElement('span');
		const { source, isReliable } = detection;
		if (isReliable) {
			span.setAttribute('data-srclang', source);
		}
		
		const url = this.getReadyUrl({
			$sl: isReliable ? source : 'auto',
			$tl: target,
			$q: encodeURIComponent(text),
		});
		/** @type { { sentences: { trans: string }[], src: string }? } */
		const json = await fetch(url).then(res => res.json());
		if (json && !this.exceptedLanguages.includes(json.src)) {
			if (!span.hasAttribute('data-srclang')) {
				span.setAttribute('data-srclang', json.src);
			}
			span.textContent = json.sentences.map(s => s.trans).join('') || '';
		} else {
			span.removeAttribute('data-srclang');
			span.textContent = text;
		}
		return span;
	}
}

const translationCtl = new TranslationController(s);

class ChatMessageContainer {
	/** @type {Array<HTMLSpanElement | Text>} */ original;
	/** @type {HTMLElement} */ suffix;
	/** @type {Node[]} */ translated = [];
	/** @type {boolean} */ hasTranslated = false;

	/**
	 * @param {LiveChat.RendererContent["message"]} message 
	 */
	constructor(message) {
		this.original = getChatMessage(message);
		this.suffix = document.createElement('small');
		this.suffix.classList.add('original');
	}

	detectAsync() {
		return Promise.allSettled(this.original.map(node => {
			const text = node.textContent;
			return translationCtl.check(text);
		}));
	}

	/**
	 * @param {"eager" | "lazy"} mode translation mode
	 * @param {string} target target language
	 * @param {boolean} suffix whether suffixes original message
	 */
	async translate(mode, target, suffix = false) {
		const detectionResults = await this.detectAsync();
		this.hasTranslated = detectionResults.some(p => p.status === 'fulfilled');
		switch (mode) {
			case 'eager':
				return this.#translateEager(detectionResults, target, suffix);
			case 'lazy':
				return this.#translateLazy(detectionResults, target, suffix);
		}
	}

	/**
	 * @param {PromiseSettledResult<LanguageDetection>[]} detectionResults results of detection promise
	 * @param {string} target target language
	 * @param {boolean} suffix whether suffixes original message
	 */
	async #translateEager(detectionResults, target, suffix) {
		this.translated = await Promise.all(detectionResults.map(async (p, i) => {
			const node = this.original[i];
			if (p.status === 'fulfilled') {
				return await translationCtl.translateNode(node, p.value, target);
			} else {
				return node;
			}
		}));
		if (suffix && !this.equals()) {
			this.suffix.append(...this.original);
		}
	}

	/**
	 * @param {PromiseSettledResult<LanguageDetection>[]} detectionResults results of detection promise
	 * @param {string} target target language
	 * @param {boolean} suffix whether suffixes original message
	 */
	async #translateLazy(detectionResults, target, suffix) {
		this.translated = this.original.map(node => node.cloneNode(true));
		this.translated = await Promise.all(detectionResults.map(async (p, i) => {
			const node = this.original[i];
			if (p.status === 'fulfilled') {
				const translated = await translationCtl.translateNode(node, p.value, target);
				const child = this.translated[i];
				child?.parentNode?.replaceChild(translated, child);
				return translated;
			} else {
				return node;
			}
		}));
		if (suffix && !this.equals()) {
			/** @param {Node} node */
			const cloneText = node => node instanceof Element && node.classList.contains('emoji') ? new Text() : node.cloneNode();
			this.suffix.append(...this.original.map(cloneText));
		}
	}

	equals() {
		const originalText = this.original.map(n => n.textContent).join('');
		const translatedText = this.translated.map(n => n.textContent).join('');
		return originalText === translatedText;
	}

	*[Symbol.iterator]() {
		if (this.hasTranslated) {
			for (const node of this.translated) {
				yield node;
			}
			yield this.suffix;
		} else {
			for (const node of this.original) {
				yield node;
			}
		}
	}
}

/**
 * Updates muted word list.
 */
export function updateMutedWordsList() {
	/** @type { (str: string) => string } */
	const escapeRegExp = str => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
	const { regexp, plainList } = s.mutedWords;
	// clear list
	mutedWordsList.length = 0;
	if (regexp) {
		for (const s of plainList) {
			mutedWordsList.push(new RegExp(s, 'g'));
		}
	} else if (plainList.length > 0) {
		const re = new RegExp(plainList.map(escapeRegExp).join('|'), 'g');
		mutedWordsList.push(re);
	}
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
		mode: filterMode || s.mutedWords.mode,
		rules: mutedWordsList,
		replacement: s.mutedWords.replacement,
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
			if (filtered.done && filterMode === MutedWordModeEnum.ALL) return [];
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
			const emoji = options.emoji ?? s.others.emoji;
			if (emoji < 0) {
				rslt.push(new Text(r.emoji.shortcuts?.at(0) || r.emoji.emojiId || ''));
			} else if (emoji) {
				let skip = false;
				if (filterMode) {
					const shortcuts = [...(r.emoji.shortcuts || [r.emoji.emojiId])];
					const plainList = s.mutedWords.plainList;
					for (const rule of plainList) {
						const b = shortcuts.includes(rule);
						if (!b) continue;
						skip = true;
						const replacement = s.mutedWords.replacement;
						switch (filterMode) {
							case MutedWordModeEnum.ALL:
								return [];
							case MutedWordModeEnum.WORD:
								rslt.push(new Text(replacement));
								break;
							case MutedWordModeEnum.CHAR:
								rslt.push(new Text([...replacement][0] || ''));
								break;
						}
						break;
					}
				}
				if (!skip) {
					const thumbnail = r.emoji.image.thumbnails.at(-1);
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
					span.setAttribute('data-label', label);
					span.setAttribute('data-shortcut', r.emoji.shortcuts?.at(0) || '');
					span.appendChild(img);
					rslt.push(span);
				}
			}
		}
	}
	return rslt;
}