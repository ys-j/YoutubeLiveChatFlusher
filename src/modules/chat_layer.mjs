import { store as s } from './store.mjs';
import { LiveChatController } from './chat_controller.mjs';

export class LiveChatLayer {
	/**
	 * @type {LiveChatController}
	 */
	#controller;

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
	 * @param {LiveChatController} controller controller
	 * @param {HTMLDivElement | undefined} div container element
	 */
	constructor(controller, div = undefined) {
		this.#controller = controller;
		this.element = div || document.createElement('div');
		this.element.id = 'yt-lcf-layer';
		this.element.dataset.layer = '1';
		this.element.setAttribute('role', 'marquee');
		this.element.setAttribute('aria-live', 'off');
		this.element.tabIndex = -1;
		const resizeObserver = new ResizeObserver(() => {
			this.clear();
			const inputElem = /** @type {HTMLInputElement | undefined} */ (this.#controller.panel.form?.elements.namedItem('animation_duration'));
			this.resetAnimationDuration(inputElem);
			this.resetFontSize();
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
		const mutationObserver = new MutationObserver(() => {
			const over = this.root.childElementCount - (this.limit || Infinity);
			let i = 4; // link + styles(3)
			while (i++ < over) this.root.children[4]?.remove();
		});
		mutationObserver.observe(this.root, { childList: true });
		this.clear();
	}

	/**
	 * Removes all messages.
	 * @returns {LiveChatLayer} layer
	 */
	clear() {
		while (this.root.childElementCount > 4) {
			// @ts-ignore
			this.root.removeChild(this.root.lastChild);
		}
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
			s.styles.animation_duration = durationBySpeed.toFixed(1) + 's';
			if (inputElem) inputElem.value = durationBySpeed.toFixed(1);
		} else {
			if (inputElem) s.styles.animation_duration = inputElem.value + 's';
		}
		this.element.style.setProperty('--yt-lcf-animation-duration', s.styles.animation_duration);
	}

	/**
	 * Resets the font size.
	 * @param {number} numberOfLines number of lines
	 */
	resetFontSize(numberOfLines = s.others.number_of_lines) {
		if (numberOfLines) {
			const rect = this.element.getBoundingClientRect();
			const lh = Number.parseFloat(s.styles.line_height) || 1.4;
			const sizeByLines = Math.floor(rect.height / lh / numberOfLines);
			this.element.style.setProperty('--yt-lcf-font-size', [
				`${sizeByLines}px`,
				`max(${s.styles.font_size}, ${sizeByLines}px)`,
				`min(${s.styles.font_size}, ${sizeByLines}px)`,
			][s.others.type_of_lines]);
		} else {
			this.element.style.setProperty('--yt-lcf-font-size', s.styles.font_size);
		}
	}

	/**
	 * Updates style of current items.
	 * @param {string} [type] name of type to filter
	 */
	updateCurrentItemStyle(type = undefined) {
		const items = Array.from(this.root.children).filter(type ? c => c.classList.contains(type) : c => c.tagName === 'DIV');
		/** @type {HTMLElement[]} */ (items).forEach(this.#controller.updateCurrentItem);
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