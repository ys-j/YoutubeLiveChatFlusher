import { fetchInnerTube } from './innertube.mjs';
import { store as s } from './store.mjs';
import { filterMessage, getColorRGB, getText, loadTemplateDocument } from './utils.mjs';

import { TranslationController } from './chat_translator.mjs';

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

const RENDERING_SKIP_KEYS = Object.freeze([
	'liveChatPlaceholderItemRenderer',
	'liveChatSponsorshipsGiftRedemptionAnnouncementRenderer',
]);

/** @type {RegExp[]} */
const mutedWordsList = [];

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
 * @prop {Node} months
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
	async new(options) {
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
				months?.append(options.months);
			} else if ('amount' in options) {
				const amount = header?.querySelector('.amount');
				if (amount) amount.textContent = options.amount;
			} else if ('gifts' in options) {
				const gifts = header?.querySelector('.gifts');
				if (gifts) gifts.textContent = `\u{1f381}\ufe0e ${options.gifts}`;
			}
		}
		if ('sticker' in options) {
			const sticker = /** @type {HTMLImageElement?} */ (el.querySelector('.sticker'));
			if (sticker) sticker.src = options.sticker;
		} else if ('body' in options && body) {
			await options.body.connectTo(body);
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
	if (RENDERING_SKIP_KEYS.includes(key)) throw 'Skipped rendering.';

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
			element = await factory.new({
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
			element = await factory.new({
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
			element = await factory.new({
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
			element = await factory.new({
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
			element = await factory.new({
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
					element = await factory.new({ type: 'poll', body });
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

const translator = new TranslationController(await s.load());
const RESOLVED_NULL = Promise.resolve(null);

/**
 * Detects each node language async.
 * @param {ArrayLike<Node>} nodes 
 */
export function detectLanguageAsync(nodes) {
	if (!translator.detector.isReady) translator.detector.ready();
	const len = nodes.length;

	/** @type {Promise<import("./chat_translator.mjs").LanguageDetection?>[]} */
	const promises = new Array(len);
	for (let i = 0; i < len; i++) {
		const text = nodes[i].textContent;
		promises[i] = text ? translator.check(text) : RESOLVED_NULL;
	}
	return Promise.all(promises);
}


export class ChatMessageContainer {
	/** @type {DocumentFragment | Text} */ #original;
	/** @type {HTMLElement} */ #suffix;
	/** @type {Promise<DocumentFragment?>} */ translating = RESOLVED_NULL;
	lazy = false;

	/**
	 * @param {LiveChat.RendererContent["message"]} message 
	 */
	constructor(message) {
		this.#original = getChatMessage(message);
		this.#original.normalize();
		this.#suffix = document.createElement('small');
		this.#suffix.classList.add('original');
	}

	/**
	 * @param {"eager" | "lazy"} mode translation mode
	 * @param {string} target target language
	 * @param {boolean} suffix whether suffixes original message
	 */
	async translate(mode, target, suffix = false) {
		this.lazy = mode === 'lazy';
		const sourceNodes = this.#original.childNodes;
		const detections = await detectLanguageAsync(sourceNodes);
		this.translating = Promise.all(detections.map((d, i) => {
			const node = sourceNodes[i]//.cloneNode(true);
			return d ? translator.translate(node, d, target) : node;
		})).then(nodes => {
			const eq = this.#original.textContent === nodes.map(n => n.textContent).join('');
			if (!eq) {
				if (suffix) this.#suffix.textContent = this.#getOriginalText();
				const fragment = document.createDocumentFragment();
				if (suffix) {
					this.#suffix.textContent = this.#getOriginalText();
					fragment.append(...nodes, this.#suffix);
				} else {
					fragment.append(...nodes);
				}
				return fragment;
			}
			return null;
		});
		return this.lazy ? RESOLVED_NULL : this.translating;
	}

	#getOriginalText() {
		if (this.#original.nodeType === Node.TEXT_NODE) {
			return this.#original.textContent;
		}
		let text = '';
		const nodes = this.#original.childNodes;
		for (let i = 0, l = nodes.length; i < l; i++) {
			const cn = nodes[i];
			const isEmoji = cn.nodeType === Node.ELEMENT_NODE && /** @type {Element} */ (cn).classList.contains('emoji');
			if (!isEmoji) text += cn.textContent;
		}
		return text;
	}
	
	/**
	 * @param {HTMLElement} element 
	 */
	async connectTo(element) {
		const translated = await this.translating;
		element.append(translated || this.#original);
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
 * @returns {DocumentFragment | Text} nodes of chat message
 */
function getChatMessage(message, options = {}) {
	if (!message) return new Text();
	
	const { start, end, filterMode } = options;
	const filterOptions = {
		mode: filterMode || s.mutedWords.mode,
		rules: mutedWordsList,
		replacement: s.mutedWords.replacement,
	};
	if ('simpleText' in message) {
		const str = filterMessage(message.simpleText, filterOptions).value;
		return new Text(start || end ? str.slice(start, end) : str);
	}
	const rslt = document.createDocumentFragment();
	const runs = start || end ? message.runs.slice(start, end) : message.runs;
	for (const r of runs) {
		if ('text' in r) {
			const filtered = filterMessage(r.text, filterOptions);
			if (filtered.done && filterMode === MutedWordModeEnum.ALL) return new Text();
			if (r.navigationEndpoint || r.bold || r.italics) {
				let node;
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
						if (iconref) svg.append(iconref.cloneNode(true));
						node.append(svg);
					}
				} else {
					node = document.createElement('span');
				}
				if (r.bold) node.classList.add('b');
				if (r.italics) node.classList.add('i');
				rslt.append(node);
			} else {
				rslt.append(filtered.value);
			}
		} else {
			const emoji = options.emoji ?? s.others.emoji;
			if (emoji < 0) {
				rslt.append(r.emoji.shortcuts?.at(0) || r.emoji.emojiId || '');
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
								return new Text();
							case MutedWordModeEnum.WORD:
								rslt.append(replacement);
								break;
							case MutedWordModeEnum.CHAR:
								rslt.append([...replacement][0] || '');
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
						img = r.emoji.emojiId;
					}
					const span = document.createElement('span');
					span.classList.add('emoji');
					span.setAttribute('data-label', label);
					span.setAttribute('data-shortcut', r.emoji.shortcuts?.at(0) || '');
					span.append(img);
					rslt.append(span);
				}
			}
		}
	}
	return rslt;
}
