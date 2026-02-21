/// <reference path="../../types/browser.d.ts" />

/**
 * @typedef PartStyle
 * @prop {boolean} photo
 * @prop {boolean} name
 * @prop {boolean} [message]
 * @prop {boolean} [amount]
 * @prop {boolean} [sticker]
 * @prop {boolean} [months]
 * @prop {string?} [color]
 */

/**
 * @typedef StorageSchema
 * @prop {Record<string, string>} styles
 * @prop {Record<string, number>} others
 * @prop {Record<string, PartStyle>} parts
 * @prop {Record<string, string>} cssTexts
 * @prop {Record<string, string>} hotkeys
 * @prop {object} mutedWords
 * @prop {number} mutedWords.mode
 * @prop {string} mutedWords.replacement
 * @prop {boolean} mutedWords.regexp
 * @prop {string[]} mutedWords.plainList
 * @prop {object} translation
 * @prop {string} translation.translator
 * @prop {string} translation.url
 * @prop {boolean} translation.regexp
 * @prop {string[]} translation.plainList
 */

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
		overlapping: 0,
		direction: 0,
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
		translator: 'google',
		url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&dt=bd&dj=1&q=$q',
		regexp: false,
		/** @type {string[]} */
		plainList: [],
	},
});

/**
 * @class
 * @param {string} name storage name
 */
function ConfigHandler(name) {
	/**
	 * @param {Record<string, any>} target 
	 * @param {string} prop 
	 * @param {any} val 
	 * @param {any} recv 
	 * @returns {boolean}
	 */
	this.set = function (target, prop, val, recv) {
		if (prop in target) {
			target[prop] = val;
			browser.storage.local.set({
				[name]: target
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

export class ConfigStore {
	constructor() {
		this.isLoaded = false;
		/** @type {UnwrapReadonly<typeof DEFAULT_CONFIG>} */
		this.data = structuredClone(DEFAULT_CONFIG);

		/** @type {UnwrapReadonly<typeof this.data>} */ // @ts-ignore
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
	async load(json) {
		/** @type {Partial<UnwrapReadonly<typeof this.data>>} */
		const stored = json ?? await browser.storage.local.get();
		Object.assign(this.data.styles, stored.styles);
		Object.assign(this.data.others, stored.others);
		Object.assign(this.data.parts, stored.parts);
		Object.assign(this.data.cssTexts, stored.cssTexts);
		Object.assign(this.data.hotkeys, stored.hotkeys);
		Object.assign(this.data.mutedWords, stored.mutedWords);
		Object.assign(this.data.translation, stored.translation);
		this.isLoaded = true;
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
	
	/**
	 * @param {HTMLAnchorElement} [a] `<a>` element for download
	 */
	async export(a = document.createElement('a')) {
		const blob = new Blob([ JSON.stringify(this.data) ], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		a.download = `ytlcf-config-${Date.now()}.json`;
		a.href = url;
		a.click();
	}

	/**
	 * @param {HTMLInputElement} input `<input>` element for file picker
	 */
	async import(input = document.createElement('input')) {
		input.type = 'file';
		input.accept = 'application/json';
		input.addEventListener('cancel', () => {
			console.log('Config file import is canceled.');
		}, { passive: true });
		input.addEventListener('change', e => {
			const files = input.files;
			if (files && files.length > 0) {
				console.log('Config file selected: ' + files[0].name);
				const reader = new FileReader();
				reader.onload = async e => {
					/** @type {Partial<UnwrapReadonly<typeof this.data>>} */
					const json = JSON.parse(/** @type {string} */ (e.target?.result));
					await this.load(json);
					await browser.storage.local.set(this.data);
				};
				reader.readAsText(files[0]);
			}
		}, { passive: true });
		input.click();
	}
}

export const store = new ConfigStore();


/**
 * Sends a signal to refresh all tabs running this extension.
 * @returns {Promise<void>}
 */
async function refreshPage() {
	await browser.runtime.sendMessage({ fire: 'reload' });
}