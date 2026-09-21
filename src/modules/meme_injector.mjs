/**
 * @module meme_injector
 * @description Injects meme comments into the danmaku layer at random intervals.
 */

import { getEnabledMemes } from './meme_manager.mjs';
import { layoutChatItem } from './chat_layout.mjs';
import { store as s } from './store.mjs';

/**
 * Creates a meme comment element.
 * @param {import('./meme_manager.mjs').MemeEntry} meme meme data
 * @returns {HTMLDivElement} meme element
 */
function createMemeElement(meme) {
	const el = document.createElement('div');
	el.classList.add('text', 'normal', 'meme');
	el.id = `meme_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
	el.dataset.memeId = meme.id;
	el.dataset.audioUrl = meme.audioDataUrl;
	el.dataset.text = meme.text;
	if (meme.color) {
		el.dataset.customColor = meme.color;
	}

	// Build the inner structure similar to 'text' template
	const header = document.createElement('span');
	header.classList.add('header');

	const body = document.createElement('span');
	body.classList.add('body');
	body.textContent = meme.text;

	el.append(header, body);

	return el;
}

export class MemeInjector {
	/** @type {number} */
	#intervalId = 0;

	/** @type {import('./chat_layer.mjs').LiveChatLayer} */
	#layer;

	/** @type {import('./chat_layout.mjs').LiveChatLayoutCache} */
	#layoutCache;

	/** @type {number} interval in ms between meme injections */
	#intervalMs;

	/** @type {import('./meme_manager.mjs').MemeEntry[]} cached enabled memes */
	#memes = [];

	/**
	 * @param {import('./chat_layer.mjs').LiveChatLayer} layer danmaku layer
	 * @param {import('./chat_layout.mjs').LiveChatLayoutCache} layoutCache layout cache
	 * @param {number} [intervalMs=8000] interval between meme injections in ms
	 */
	constructor(layer, layoutCache, intervalMs = 8000) {
		this.#layer = layer;
		this.#layoutCache = layoutCache;
		this.#intervalMs = intervalMs;
	}

	/**
	 * Starts injecting memes at regular intervals.
	 */
	async start() {
		this.stop();
		await this.#refreshMemes();

		if (this.#memes.length === 0) return;

		this.#intervalId = setInterval(() => {
			this.#injectRandomMeme();
		}, this.#intervalMs);
	}

	/**
	 * Stops meme injection.
	 */
	stop() {
		if (this.#intervalId) {
			clearInterval(this.#intervalId);
			this.#intervalId = 0;
		}
	}

	/**
	 * Refreshes the cached list of enabled memes from storage.
	 */
	async #refreshMemes() {
		this.#memes = await getEnabledMemes();
	}

	/**
	 * Injects a random meme into the layer.
	 */
	#injectRandomMeme() {
		if (this.#memes.length === 0) return;
		if (this.#layer.element.hidden) return;

		const meme = this.#memes[Math.floor(Math.random() * this.#memes.length)];
		const el = createMemeElement(meme);

		/** @type {["dense", "random"]} */
		const modeOptions = ['dense', 'random'];
		layoutChatItem(el, this.#layoutCache, modeOptions[s.others.density]);
	}

	/**
	 * Sets the injection interval.
	 * @param {number} ms interval in milliseconds
	 */
	setInterval(ms) {
		this.#intervalMs = ms;
		if (this.#intervalId) {
			this.start(); // restart with new interval
		}
	}

	/**
	 * Plays the audio associated with a meme element.
	 * @param {HTMLElement} memeElement the meme element that was clicked
	 * @param {HTMLVideoElement|null} videoElement the main video element to duck volume
	 */
	static playAudio(memeElement, videoElement) {
		const audioUrl = memeElement.dataset.audioUrl;
		if (!audioUrl) return;

		memeElement.classList.add('played');
		if (memeElement.dataset.customColor) {
			memeElement.style.color = memeElement.dataset.customColor;
		}

		const audio = new Audio(audioUrl);
		audio.volume = 1.0; // Play meme loudly
		
		let originalVolume = 1.0;
		if (videoElement) {
			originalVolume = videoElement.volume;
			// Lower the video volume to 20% of its original volume
			videoElement.volume = originalVolume * 0.2;
		}

		const cleanup = () => {
			if (videoElement && videoElement.volume < originalVolume) {
				videoElement.volume = originalVolume;
			}
		};

		audio.onended = cleanup;
		audio.onpause = audio.onerror = cleanup;

		audio.play().catch(err => {
			console.warn('Failed to play meme audio:', err);
			cleanup();
		});
	}
}
