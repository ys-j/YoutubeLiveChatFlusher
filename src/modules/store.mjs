/// <reference path="../../types/browser.d.ts" />

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
		mode_livestream: 0,
		mode_replay: 1,
		autostart: 0,
		message_pause: 1,
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
		translator: 'internal',
		url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&dt=bd&dj=1&q=$q',
		regexp: false,
		/** @type {string[]} */
		plainList: [],
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
			browser.storage.local.set({ [this.#name]: target });
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
		for (const k of Object.keys(stored.parts ?? {})) {
			// @ts-expect-error
			Object.assign(this.data.parts[k], stored.parts[k] || {});
		}
		Object.assign(this.data.cssTexts, stored.cssTexts);
		Object.assign(this.data.hotkeys, stored.hotkeys);
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
