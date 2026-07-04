import { logger } from './logging.mjs';

export const DEFAULT_CONFIG = Object.freeze({
	styles: {
		animation_duration: '8s',
		font_size: '32px',
		line_height: '1.4',
		font_family: 'sans-serif',
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
		/** @type {import("./chat_message.mjs").EmojiModeEnum} */
		emoji: 1,
		density: 0,
		overlapping: 0,
		direction: 0,
		show_username: 0,
		translation: 0,
		except_lang: 0,
		translation_timing: 0,
		suffix_original: 0,
		time_shift: 0,
		/** @type {import("./main.mjs").FetchingModeEnum} */
		mode_livestream: 0,
		/** @type {import("./main.mjs").FetchingModeEnum} */
		mode_replay: 1,
		autostart: 0,
		message_pause: 1,
		person_detection: 0,
	},
	parts: {
		normal: { photo: false, name: false, message: true, color: '', strokeColor: '' },
		verified: { photo: true, name: true, message: true, color: '', strokeColor: '' },
		member: { photo: false, name: false, message: true, color: '', strokeColor: '' },
		moderator: { photo: true, name: true, message: true, color: '', strokeColor: '' },
		owner: { photo: true, name: true, message: true, color: '', strokeColor: '' },
		you: { photo: false, name: false, message: true, color: '', strokeColor: '' },
		paid_message: { photo: true, name: true, amount: true, message: true, color: '', strokeColor: '' },
		paid_sticker: { photo: true, name: true, amount: true, sticker: true },
		membership: { photo: true, name: false, message: true, color: '', strokeColor: '' },
		milestone: { photo: true, name: true, months: true, message: true, color: '', strokeColor: '' },
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
		layer: { key: '', alt: false },
		panel: { key: '', alt: false },
		pip: { key: '', alt: false },
	},
	mutedWords: {
		/** @type {import("./chat_message.mjs").MutedWordModeEnum} */
		mode: 0,
		replacement: '',
		regexp: false,
		/** @type {string[]} */
		plainList: [],
	},
	translation: {
		regexp: false,
		/** @type {string[]} */
		plainList: [],
		/** @type {"internal" | "external"} */
		translator: 'internal',
		/** @type {"GET" | "POST"} */
		method: 'GET',
		/** @type {"Google" | "OpenAI"} */
		responseStyle: 'Google',
		url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&dt=bd&dj=1&q=$q',
		apiKey: '',
		modelName: '',
		/** @type {"OpenAI" | "custom"} */
		bodyType: 'OpenAI',
		bodyContent: '',
	},
});

class ConfigHandler {
	/** @type {string} */ #name;

	/**
	 * @param {string} name storage name
	 */
	constructor(name) {
		this.#name = name;
	}

	/**
	 * @param {Record<string, any>} target
	 * @param {string} prop
	 * @param {any} val
	 * @param {any} _recv
	 * @returns {boolean}
	 */
	set(target, prop, val, _recv) {
		if (prop in target) {
			target[prop] = val;
			browser.storage.local.set({ [this.#name]: target }).then(() => {
				const dispVal = typeof val === 'string' ? `"${val}"` : val;
				logger.info(`Successfully saved config:`, `${this.#name}["${prop}"] =`, dispVal);
			});
			return true;
		}
		return false;
	}
}

/**
 * @template T
 * @typedef { { -readonly [P in keyof T]: T[P] } } UnwrapReadonly
 */

class ConfigStore {
	constructor() {
		this.isLoaded = false;
		/** @type {UnwrapReadonly<typeof DEFAULT_CONFIG>} */
		this.data = structuredClone(DEFAULT_CONFIG);

		/** @type {UnwrapReadonly<typeof this.data>} */
		// @ts-expect-error
		this.proxies = Object.fromEntries(Object.entries(this.data).map(([k, v]) => {
			const handler = new ConfigHandler(k);
			const proxy = new Proxy(v, handler);
			return [ k, proxy ];
		}));
	}

	/**
	 * @template {typeof this.data} T
	 * @param { { -readonly [P in keyof T]?: Partial<T[P]> } } [json]
	 */
	async load(json = undefined) {
		/** @type {Partial<UnwrapReadonly<typeof this.data>>} */
		const stored = json ?? await browser.storage.local.get(null);
		Object.assign(this.data.styles, stored.styles);
		Object.assign(this.data.others, stored.others);
		for (const [k, v] of Object.entries(stored.parts ?? {})) {
			Object.assign(this.data.parts[k], v ?? {});
		}
		Object.assign(this.data.cssTexts, stored.cssTexts);
		for (const [k, v] of Object.entries(stored.hotkeys ?? {})) {
			const source = typeof v === 'string' ? { key: v, alt: false } : v ?? {};
			Object.assign(this.data.hotkeys[k], source);
		}
		Object.assign(this.data.mutedWords, stored.mutedWords);
		Object.assign(this.data.translation, stored.translation);
		this.isLoaded = true;
		return this;
	}

	get styles() { return this.proxies.styles; }
	get others() { return this.proxies.others; }
	get parts() { return this.proxies.parts; }
	get hotkeys() { return this.proxies.hotkeys; }
	get mutedWords() { return this.proxies.mutedWords; }
	get cssTexts() { return this.proxies.cssTexts; }
	get translation() { return this.proxies.translation; }

	async reset() {
		await browser.storage.local.clear();
		this.data = structuredClone(DEFAULT_CONFIG);
	}
}

export const store = new ConfigStore();
