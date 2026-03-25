/// <reference lib="esnext" />

import { fetchInnerTube } from './innertube.mjs';
import { store as s } from './store.mjs';
import { filterMessage, getColorRGB, getText, loadTemplateDocument } from './utils.mjs';

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

const RENDERING_SKIP_KEYS = [
	'liveChatPlaceholderItemRenderer',
	'liveChatSponsorshipsGiftRedemptionAnnouncementRenderer',
];

/** @type {RegExp[]} */
const mutedWordsList = [];

export class LiveChatLayoutCache {
	/**
	 * @param {ShadowRoot} root shadow root
	 * @param {number} [numOfLanes] number of lanes
	 */
	constructor(root, numOfLanes = 20) {
		this.dom = root;
		/** @type {Map<string, ChatLayoutInfo>[]} */
		this.maps = Array.from({ length: numOfLanes }, () => new Map());
	}

	get size() {
		return this.maps.reduce((a, c) => a.union(c), new Set()).size;
	}

	/**
	 * @param {number} numOfLanes 
	 */
	resize(numOfLanes) {
		const len = this.maps.length;
		this.maps.length = numOfLanes;
		for (let i = len; i < numOfLanes; i++) {
			this.maps[i] = new Map();
		}
	}

	/**
	 * @param {string} id renderer id
	 * @returns {ChatLayoutInfo[] | undefined} list of layout info or undefined
	 */
	get(id) {
		const rslt = this.maps.map(m => m.get(id)).filter(v => v !== undefined);
		return rslt.length ? rslt : undefined;
	}

	/**
	 * @param {string} id renderer id
	 * @param {ChatLayoutInfo} layout layout info 
	 */
	set(id, layout) {
		for (let i = layout.lineStart; i < layout.lineEnd; i++) {
			this.maps[i].set(id, layout);
		}
	}

	/**
	 * @param {string} id renderer id
	 * @returns {boolean[]} if succeeded
	 */
	delete(id) {
		return this.maps.map(m => m.delete(id));
	}

	clear() {
		for (const m of this.maps) m.clear();
	}

	/**
	 * @param {ChatLayoutInfo} target 
	 * @param {boolean} [reversed=false] 
	 * @returns {boolean} if this message collides against any preceding layout
	 */
	anyCollides(target, reversed = false) {
		for (let i = target.lineStart; i < target.lineEnd; i++) {
			for (const preceding of this.maps[i].values()) {
				const collides = target.isCollidable(preceding, reversed);
				if (collides) return true;
			}
		}
		return false;
	}
}

/**
 * @typedef AuthorInfo
 * @prop {string} id
 * @prop {string} name
 * @prop {string} thumbnail
 */

/**
 * @typedef TextItemFactoryOptions
 * @prop {"text"} type
 * @prop {typeof AuthorType[keyof typeof AuthorType]} subtype
 * @prop {AuthorInfo} author
 * @prop {ChatMessageContainer} body
 * @prop {string} text
 */

/**
 * @typedef MembershipItemFactoryOptions
 * @prop {"membership"} type
 * @prop {"membership" | "milestone"} subtype
 * @prop {AuthorInfo} author
 * @prop {Node[]} months
 * @prop {ChatMessageContainer} body
 * @prop { { header: number, body: number } } background
 */

/**
 * @typedef PaidMessageItemFactoryOptions
 * @prop {"paid_message"} type
 * @prop {AuthorInfo} author
 * @prop {string} amount
 * @prop {ChatMessageContainer} body
 * @prop { { header: number, body: number } } background
 */

/**
 * @typedef PaidStickerItemFactoryOptions
 * @prop {"paid_sticker"} type
 * @prop {AuthorInfo} author
 * @prop {string} amount
 * @prop {string} sticker
 * @prop { { header: number, body: number } } background
 */

/**
 * @typedef GiftItemFactoryOptions
 * @prop {"gift"} type
 * @prop {AuthorInfo} author
 * @prop {string} gifts
 * @prop { { header: number } } background
 */

/**
 * @typedef PollItemFactoryOptions
 * @prop {"poll"} type
 * @prop {ChatMessageContainer} body
 */

export class LiveChatItemFactory {
	/** @type {Map<string, HTMLElement>} */
	#templates = new Map();

	async load() {
		const doc = await loadTemplateDocument('../templates/template_chat_message.html');
		const elems = doc.getElementsByTagName('template');
		for (const t of elems) {
			const el = t.content.firstElementChild;
			if (el) this.#templates.set(t.id, /** @type {HTMLElement} */ (el));
		}
	}

	/**
	 * Creates new chat message element.
	 * @param {TextItemFactoryOptions | MembershipItemFactoryOptions | PaidMessageItemFactoryOptions | PaidStickerItemFactoryOptions | GiftItemFactoryOptions | PollItemFactoryOptions} options
	 */
	new(options) {
		const type = options.type;
		const el = this.#templates.get(type)?.cloneNode(true);
		if (!el) return null;

		const header = /** @type {HTMLElement?} */ (el.querySelector('.header'));
		const body = /** @type {HTMLElement?} */ (el.querySelector('.body'));
		if ('author' in options) {
			if ('subtype' in options) el.classList.add(options.subtype);
			el.dataset.authorId = options.author.id;
			el.dataset.authorName = options.author.name;

			const a = header?.querySelector('a');
			if (a) {
				a.href = `/channel/${options.author.id}`;
				a.title = options.author.name;
				const photo = a?.querySelector('img');
				if (photo) photo.src = options.author.thumbnail;
			}
			const name = header?.querySelector('.name');
			if (name) name.textContent = options.author.name;

			if ('months' in options) {
				const months = header?.querySelector('.months');
				months?.append(...options.months);
			} else if ('amount' in options) {
				const amount = header?.querySelector('.amount');
				if (amount) amount.textContent = options.amount;
			} else if ('gifts' in options) {
				const gifts = header?.querySelector('.gifts');
				if (gifts) gifts.textContent = `\u{1f381}\ufe0e ${options.gifts}`;
			}
		}
		if ('body' in options) {
			body?.append(...options.body);
		} else if ('sticker' in options) {
			const sticker = /** @type {HTMLImageElement?} */ (el.querySelector('.sticker'));
			if (sticker) sticker.src = options.sticker;
		}
		if ('background' in options) {
			if ('header' in options.background && header) {
				const rgb = getColorRGB(options.background.header);
				header.style.backgroundColor = `rgba(${rgb.join()},var(--yt-lcf-background-opacity))`;
			}
			if ('body' in options.background && body) {
				const rgb = getColorRGB(options.background.body);
				body.style.backgroundColor = `rgba(${rgb.join()},var(--yt-lcf-background-opacity))`;
			} 
		} else if ('text' in options) {
			el.dataset.text = options.text;
		}
		return el;
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

/**
 * Fetches author info: id, name and thumbnail.
 * @param {LiveChat.RendererContent} renderer renderer content
 * @param {keyof typeof s.parts} type message type
 * @returns author info
 */
async function fetchAuthorInfo(renderer, type) {
	const id = renderer.authorExternalChannelId;

	/** @type {string} */
	let name;
	if (s.others.show_username && id) {
		const cachedName = authorNameCache.get(id);
		if (cachedName) {
			name = cachedName;
		} else if (type && s.parts[type].name) {
			const url = new URL('/youtubei/v1/browse', location.origin);
			try {
				const json = await fetchInnerTube(url, { browseId: id });
				const pageTitle = json?.header?.pageHeaderRenderer?.pageTitle;
				if (pageTitle) {
					authorNameCache.set(id, pageTitle);
					name = pageTitle;
				}
			} catch (reason) {
				console.error(reason);
			}
		}
	}
	name ||= getText(renderer.authorName);

	const thumbnail = renderer.authorPhoto.thumbnails[0].url;
	return { id, name, thumbnail };
}

/**
 * Renders chat item renderer.
 * @param {LiveChat.AnyRenderer} item message renderer
 * @param {LiveChatItemFactory} factory chat item factory
 */
export async function renderChatItem(item, factory) {
	const key = Object.keys(item)[0];
	if (RENDERING_SKIP_KEYS.includes(key)) throw null;

	/** @type {LiveChat.RendererContent} */
	const renderer = item[key];
	const body = new ChatMessageContainer(renderer.message);

	const langIndex = s.others.translation;
	if (langIndex) {
		const langSuffix = s.others.suffix_original;
		const tl = navigator.languages[Math.abs(langIndex) - 1];
		const lazy = s.others.translation_timing ?? 0;
		await body.translate(lazy ? 'lazy' : 'eager', tl, !!langSuffix);
	}

	/** @type {(type: keyof typeof s.parts) => boolean} */
	const allHidden = type => !Object.values(s.parts[type]).includes(true);

	/** @type {HTMLElement?} */
	let element = null;
	switch (key) {
		case 'liveChatTextMessageRenderer': {
			const subtype = getAuthorType(renderer);
			if (allHidden(subtype)) break;
			element = factory.new({
				type: 'text',
				subtype,
				author: await fetchAuthorInfo(renderer, subtype),
				body,
				text: getText(renderer.message),
			});
			break;
		}
		case 'liveChatMembershipItemRenderer': {
			const subtype = 'headerPrimaryText' in renderer ? 'milestone': 'membership';
			if (allHidden(subtype)) break;
			const {
				headerPrimaryText: primary,
				headerSubtext: sub,
			} = /** @type {LiveChat.MembershipItemRenderer["liveChatMembershipItemRenderer"]} */ (renderer);
			element = factory.new({
				type: 'membership',
				subtype,
				author: await fetchAuthorInfo(renderer, subtype),
				months: getChatMessage(primary || sub, { start: primary ? 1 : 0, filterMode: 0 }),
				body,
				background: { header: 0xff0f9d58, body: 0xff0a8043 },
			});
			break;
		}
		case 'liveChatPaidMessageRenderer': {
			const type = 'paid_message';
			if (allHidden(type)) break;
			const {
				headerBackgroundColor,
				purchaseAmountText,
				bodyBackgroundColor,
			} = /** @type {LiveChat.PaidMessageRenderer["liveChatPaidMessageRenderer"]} */ (renderer);
			element = factory.new({
				type,
				author: await fetchAuthorInfo(renderer, type),
				amount: getText(purchaseAmountText),
				body,
				background: { header: headerBackgroundColor, body: bodyBackgroundColor },
			});
			break;
		}
		case 'liveChatPaidStickerRenderer': {
			const type = 'paid_sticker';
			if (allHidden(type)) break;
			const {
				backgroundColor,
				purchaseAmountText,
				moneyChipBackgroundColor,
				sticker,
			} = /** @type {LiveChat.PaidStickerRenderer["liveChatPaidStickerRenderer"]} */ (renderer);
			element = factory.new({
				type,
				author: await fetchAuthorInfo(renderer, type),
				amount: getText(purchaseAmountText),
				sticker: (sticker.thumbnails.find(t => 2 * 36 <= (t.width || 36)) || sticker.thumbnails[0]).url,
				background: { header: backgroundColor, body: moneyChipBackgroundColor },
			});
			break;
		}
		case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer': {
			const subtype = 'membership';
			if (allHidden(subtype)) break;
			// @ts-expect-error
			const headerRenderer = /** @type {LiveChat.SponsorshipsHeaderRenderer} */(renderer.header).liveChatSponsorshipsHeaderRenderer;
			const count = headerRenderer.primaryText?.runs?.filter(r => !Number.isNaN(Number.parseInt(r.text, 10)))[0]?.text;
			if (!count) break;
			element = factory.new({
				type: 'gift',
				author: await fetchAuthorInfo(renderer, subtype),
				gifts: count,
				background: { header: 0xff0f9d58 },
			});
			break;
		}
		case 'liveChatViewerEngagementMessageRenderer': {
			// @ts-expect-error
			switch (renderer.icon.iconType) {
				case 'POLL':
					element = factory.new({ type: 'poll', body });
					break;
				case 'YOUTUBE_ROUND':
					break;
				default:
					console.debug(renderer);
			}
		}
	}
	if (element) {
		element.id = renderer.id;
		return element;
	} else {
		throw 'Failed to render a chat item element.';
	}
}

/**
 * 
 * @param {HTMLElement} el rendered element
 * @param {LiveChatLayoutCache} cache layout cache container
 * @param {"dense" | "random"} [mode] layout mode
 * @return renderer/element id
 */
export function layoutChatItem(el, cache, mode = 'dense') {
	el.style.visibility = 'hidden';
	cache.dom.appendChild(el);

	const hh = cache.dom.host.clientHeight, hw = cache.dom.host.clientWidth;
	const ch = el.clientHeight, cw = el.clientWidth;
	if (cw >= hw * (Number.parseInt(s.styles.max_width, 10) / 100 || 1)) {
		el.classList.add('wrap');
	}
	
	el.style.setProperty('--yt-lcf-translate-x', `-${hw + cw}px`);

	const body = /** @type {HTMLElement?} */ (el.lastElementChild);
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

	const lhf = Number.parseFloat(s.styles.line_height) || 1.4;

	let y = 0;
	/** @type {ChatLayoutInfo} */
	let layout;
	
	const dir = s.others.direction & 1 ? 'bottom' : 'top';
	if (ch >= hh) {
		el.style[dir] = '0px';
		el.setAttribute('data-line', '0');
		el.style.visibility = '';
		layout = new ChatLayoutInfo(el, y);
		cache.set(el.id, layout);
		return el.id;
	}
	const overline = cache.maps.length;
	const reversed = (s.others.direction & 2) > 0;
	const parentRect = cache.dom.host.getBoundingClientRect();

	switch (mode) {
		case 'dense': {
			do {
				el.style[dir] = `${y * lhf}em`;
				el.setAttribute('data-line', `${y}`);
				layout = new ChatLayoutInfo(el, y);
				const overflow = layout.isOverflow(parentRect);
				if (overflow) continue;
				const collidable = cache.anyCollides(layout, reversed);
				if (collidable) continue;
				el.style.visibility = '';
				cache.set(el.id, layout);
				return el.id;
			} while (++y <= overline);

			el.classList.add('overlap');
			const st = s.others.overlapping;
			const o = st & 0b01 ? .8 : 1;
			const dy = st & 0b10 ? .5 : 0;

			y = cache.maps.reduce((pi, cv, ci, arr) => cv.size < arr[pi].size ? ci : pi, 0);
			el.setAttribute('data-line', `${y}`);
			layout = new ChatLayoutInfo(el, y);
			const len = [...cache.maps[y].values().filter(layout => layout.isCollidable(layout))].length || 1;
			el.style.top = `${(y + dy) * lhf}em`;
			el.style.opacity = `${Math.max(.5, o ** len)}`;
			el.style.zIndex = `-${len}`;
			el.style.visibility = '';
			cache.set(el.id, layout);
			return el.id;
		}
		
		case 'random': {
			const calculatedLine = new Set(Array(overline).keys());
			do {
				y = (overline * Math.random()) | 0;
				el.style[dir] = `${y * lhf}em`;
				el.setAttribute('data-line', `${y}`);
				layout = new ChatLayoutInfo(el, y);
				const overflow = layout.isOverflow(parentRect);
				if (overflow) {
					for (let i = y; i < overline; i++) {
						calculatedLine.delete(i);
					}
					continue;
				}
				const collidable = cache.anyCollides(layout, reversed);
				if (collidable) {
					calculatedLine.delete(y);
					continue;
				}
				break;
			} while (calculatedLine.size > 0);
			el.style.visibility = '';
			cache.set(el.id, layout);
			return el.id;
		}
	}
}

class ChatLayoutInfo {
	/** @type {DOMRect} */ #rect;
	/** @type {number} */ #line;
	/** @type {number} */ #range;

	/**
	 * @param {HTMLElement} elem 
	 * @param {number} [line] 
	 */
	constructor(elem, line = undefined) {
		this.#rect = elem.getBoundingClientRect();

		this.#line = line ?? Number.parseInt(elem.getAttribute('data-line') || '0', 10);

		const computedStyle = getComputedStyle(elem);
		const lh = Number.parseFloat(computedStyle.lineHeight); // px
		this.#range = Math.ceil(this.height / lh);

		const [_durMatch, durNum, durUnit] = computedStyle.animationDuration.match(/^([\d.]+)(\D+)/) || [];
		const durFactor = durNum && durUnit && { 's': 1000, 'ms': 1 }[durUnit] || 0;
		this.duration = durFactor ? Number.parseFloat(durNum) * durFactor : Number.parseFloat(s.styles.animation_duration) * 1000;

		const [_translateMatch, translateX] = elem.style.getPropertyValue('--yt-lcf-translate-x').match(/^-?([\d.]+)px/) || [];
		this.speed = Number.parseFloat(translateX) / this.duration;
		this.createdOn = Date.now();
	}

	get lineStart() {
		return this.#line;
	}
	get lineEnd() {
		return this.#line + this.#range;
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

export class ChatMessageContainer {
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
