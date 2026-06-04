import { store as s } from './store.mjs';

export class LiveChatLayer {
	/** @type {import("./chat_controller.mjs").LiveChatController} */
	#controller;

	/** @type {number} */
	#initialElemCount;

	/**
	 * Container element of the layer
	 * @type {HTMLDivElement}
	 */
	element;

	/**
	 * Shadow root containing all messages
	 * @type {ShadowRoot}
	 */
	root;

	/**
	 * Maximum number of messages to display
	 * @type {number}
	 */
	limit = 0;

	/**
	 * Creates new layer.
	 * @param {import("./chat_controller.mjs").LiveChatController} controller controller
	 * @param {HTMLDivElement | undefined} div container element
	 */
	constructor(controller, div = undefined) {
		this.#controller = controller;
		this.element = div || document.createElement('div');
		this.element.id = 'yt-lcf-layer';
		this.element.setAttribute('data-layer', '1');
		this.element.setAttribute('role', 'marquee');
		this.element.setAttribute('aria-live', 'off');
		this.element.tabIndex = -1;
		const resizeObserver = new ResizeObserver(() => {
			this.clear();
			const inputElem = /** @type {HTMLInputElement | undefined} */ (this.#controller.panel.form?.elements.namedItem('animation_duration'));
			this.resetAnimationDuration(inputElem);
			this.resetFontSize();

			const video = this.element.parentElement?.querySelector('video');
			if (video) {
				this.element.style.maskPosition = `0px 0px, ${video.style.left} ${video.style.top}`;
				this.element.style.maskSize = `100% 100%, ${video.style.width} ${video.style.height}`;
			}
		});
		resizeObserver.observe(this.element);
		this.root = this.element.attachShadow({ mode: 'closed' });
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = browser.runtime.getURL('../styles/layer.css');
		const styles = ['customcss', 'yourcss', 'userdefinedcss'].map(id => {
			const element = document.createElement('style');
			element.id = id;
			return element;
		});
		this.root.append(link, ...styles);
		this.#initialElemCount = this.root.childElementCount;
		
		const mutationObserver = new MutationObserver(() => {
			const over = this.root.childElementCount - (this.limit || Infinity);
			let i = this.#initialElemCount;
			while (i++ < over) {
				this.root.children[this.#initialElemCount]?.remove();
			}
		});
		mutationObserver.observe(this.root, { childList: true });
		this.clear();
	}

	get count() {
		return this.root.childElementCount - this.#initialElemCount;
	}

	/**
	 * Removes all messages.
	 * @returns {LiveChatLayer} layer
	 */
	clear() {
		const styles = this.root.querySelectorAll('link,style');
		this.root.replaceChildren(...styles);
		return this;
	}

	/**
	 * Hides the layer.
	 */
	hide() {
		this.element.hidden = true;
		this.element.ariaHidden = 'true';
		this.element.style.display = 'none';
		this.clear();
	}

	/**
	 * Shows the layer.
	 */
	show() {
		this.element.hidden = false;
		this.element.ariaHidden = 'false';
		this.element.style.display = 'block';
	}

	/**
	 * Resets the animation duration.
	 * @param {HTMLInputElement} [inputElem] element of `<input name="animation_duration">`
	 * @param {number} [pxPerSec] pixels to move per second
	 */
	resetAnimationDuration(inputElem, pxPerSec = s.others.px_per_sec) {
		if (pxPerSec > 0) {
			const durationBySpeed = (this.element.getBoundingClientRect().width / pxPerSec) || 8;
			s.data.styles.animation_duration = durationBySpeed.toFixed(1) + 's';
			if (inputElem) inputElem.value = durationBySpeed.toFixed(1);
		} else {
			if (inputElem) s.data.styles.animation_duration = inputElem.value + 's';
		}
		this.element.style.setProperty('--yt-lcf-animation-duration', s.styles.animation_duration);
	}

	/**
	 * Resets the font size.
	 * @param {number} numOfLines number of lines
	 */
	resetFontSize(numOfLines = s.others.number_of_lines) {
		const rect = this.element.getBoundingClientRect();
		if (!rect.height) return;
		const lh = Number.parseFloat(s.styles.line_height) || 1.4;
		if (numOfLines > 0) {
			const sizeByLines = (rect.height / lh / numOfLines) | 0;
			this.element.style.setProperty('--yt-lcf-font-size', [
				`${sizeByLines}px`,
				`max(${s.styles.font_size}, ${sizeByLines}px)`,
				`min(${s.styles.font_size}, ${sizeByLines}px)`,
			][s.others.type_of_lines]);
			this.#controller.layoutCache.resize(numOfLines);
		} else {
			const fs = Number.parseFloat(s.styles.font_size);
			const linesBySize = (rect.height / lh / fs) | 0;
			this.element.style.setProperty('--yt-lcf-font-size', s.styles.font_size);
			this.#controller.layoutCache.resize(linesBySize);
		}
	}

	/**
	 * Updates style of current items.
	 * @param {string} [type] name of type to filter
	 */
	updateCurrentItemStyle(type = undefined) {
		const items = Array.from(this.root.children).filter(type ? c => c.classList.contains(type) : c => c.tagName === 'DIV');
		for (const item of items) {
			this.#controller.updateCurrentItem(/** @type {HTMLElement} */ (item));
		}
	}

	/**
	 * Moves the layer to the given coordinates.
	 * @param {number} x x-coordinate
	 * @param {number} y y-coordinate
	 */
	move(x, y) {
		this.element.style.left = `${x}px`;
		this.element.style.top = `${y}px`;
	}
}

/**
 * @typedef MLEngineResult
 * @prop {object} metrics
 * @prop {number} metrics.decodingTime
 * @prop {number} metrics.inferenceTime
 * @prop {number} metrics.inputTokens
 * @prop {number} metrics.outputTokens
 * @prop {number} metrics.preprocessingTime
 * @prop {Array<{ name: string, when: number }>} metrics.runTimestamps
 * @prop {number} metrics.timePerOutputToken
 * @prop {?number} metrics.timeToFirstToken
 * @prop {number} metrics.tokenizingTime
 * @prop {number} metrics.tokensPerSecond
 * @prop { { cpuTime: number, memory: number } } resourcesAfter
 * @prop { { cpuTime: number, memory: number } } resourcesBefore
 */

/**
 * @typedef SegmentInfo
 * @prop {?string} label
 * @prop {?number} score
 * @prop {object} mask
 * @prop {Uint8ClampedArray} mask.data
 * @prop {number} mask.width
 * @prop {number} mask.height
 * @prop {number} mask.channel
 */

/**
 * @typedef {(result: SegmentInfo[] | undefined) => void} SegmentationCallback
 */

export class VideoSegmentationExecutor {
	/** @type {[number, number]} */
	static TARGET_SIZE = [256, 256];

	/** @type {SegmentationCallback} */ #callback;
	/** @type {AbortController} */ #abortController;
	/** @type {number} */ #callbackId = 0;

	/**
	 * @param {SegmentationCallback} callback
	 */
	constructor(callback) {
		this.#callback = callback;
		this.#abortController = new AbortController();
		this.offscreen = new OffscreenCanvas(...VideoSegmentationExecutor.TARGET_SIZE);
		this.context = this.offscreen.getContext('2d');
		this.frameInterval = 4;
	}

	/**
	 * @param {HTMLVideoElement} video
	 */
	async #sendFrame(video) {
		const [width, height] = VideoSegmentationExecutor.TARGET_SIZE;
		try {
			this.context?.drawImage(video, 0, 0, width, height);
			const mask = await this.offscreen.convertToBlob({ type: 'image/webp', quality: .3 });
			return await browser.runtime.sendMessage({ mask });
		} catch (reason) {
			console.warn('Failed to send a video frame to the person detector:', reason);
		}
	}

	/**
	 * @param {HTMLVideoElement} video
	 * @param {LiveChatLayer} layer
	 */
	observe(video, layer) {
		let inProgress = false;
		/** @type {VideoFrameRequestCallback} */
		const frame = (now, metadata) => {
			if (this.#abortController.signal.aborted) {
				this.#abortController = new AbortController();
				return;
			} else if (
				!inProgress
				&& document.visibilityState === 'visible'
				&& layer.count > 0
				&& !video.paused
				&& !video.ended
				&& metadata.presentedFrames % this.frameInterval === 0
				&& !video.closest('#movie_player')?.classList.contains('ad-showing')
			) {
				inProgress = true;
				this.#sendFrame(video).then(r => {
					// @ts-expect-error
					this.#callback(r);
					inProgress = false;
				});
			}
			this.#callbackId = video.requestVideoFrameCallback(frame);
		};
		this.#callbackId = video.requestVideoFrameCallback(frame);
	}

	/**
	 * @param {HTMLVideoElement} [video] 
	 */
	disconnect(video = undefined) {
		this.#abortController.abort();
		if (this.#callbackId) video?.cancelVideoFrameCallback(this.#callbackId);
	}
}
