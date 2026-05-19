import { loadTemplateDocument } from './utils.mjs';

const menuFns = {
	/**
	 * @param {HTMLElement} target target message element
	 */
	resume_animation(target) {
		target.classList.remove('paused');
	},

	/**
	 * @param {HTMLElement} target target message element
	 */
	move_message(target) {
		target.style.cursor = 'move';
		target.addEventListener('mousedown', e => {
			const [_, y] = (target.style.translate || '0 0').split(' ').map(v => Number.parseInt(v, 10));
			const computedStyle = getComputedStyle(target);
			const speed = Number.parseInt(target.style.getPropertyValue('--yt-lcf-translate-x'), 10) / Number.parseFloat(computedStyle.animationDuration);
			const x = speed * Number.parseFloat(computedStyle.animationDelay);
			const startX = e.x + x, startY = e.y - y;
			/** @type {(e: MouseEvent) => void} */
			const onmousemove = e => {
				target.style.translate = [0, e.y - startY].map(i => i + 'px').join(' ');
				target.style.animationDelay = ((startX - e.x) / speed).toFixed(3) + 's';
			};
			document.addEventListener('mousemove', onmousemove, { passive: true });
			document.addEventListener('mouseup', () => {
				target.style.cursor = '';
				document.removeEventListener('mousemove', onmousemove);
			}, { once: true, passive: true });
		}, { once: true });
	},

	/**
	 * @param {Element} target target message element
	 */
	copy_user_id(target) {
		const authorId = target.getAttribute('data-author-id');
		if (authorId) {
			navigator.clipboard.writeText(authorId);
		}
	},

	/**
	 * @param {Element} target target message element
	 * @param {import("./chat_panel.mjs").LiveChatPanel} panel config panel
	 */
	hide_user(target, panel) {
		const authorId = target.getAttribute('data-author-id');
		const textarea = /** @type {HTMLTextAreaElement | undefined} */ (panel.form?.elements.user_defined_css);
		if (authorId && textarea) {
			textarea.value += `\ndiv[data-author-id="${authorId}"] { display: none !important }`;
			panel.updateStorage(textarea);
		}
		target.remove();
	},
};

export class LiveChatContextMenu {
	/** @type {HTMLElement} */
	#element;

	constructor() {
		this.#element = document.createElement('div');
		this.#element.id = 'yt-lcf-contextmenu';
		this.#element.classList.add('ytp-popup', 'ytp-contextmenu', 'ytp-delhi-modern-contextmenu');
		this.#element.style.opacity = '0';
		document.body.appendChild(this.#element);
		document.addEventListener('click', e => {
			const path = e.composedPath();
			if (this.#element && !path.includes(this.#element)) {
				this.#element.style.opacity = '0';
			}
		}, { passive: true });
		this.#element.addEventListener('transitionend', e => {
			if (e.propertyName === 'opacity' && this.#element.style.opacity === '0') {
				this.#element.style.display = 'none';
			}
		}, { passive: true });
	}

	/**
	 * Displays the context menu for the given message element.
	 * @param {MouseEvent} event mouse event object
	 * @param {HTMLElement} target target message element
	 * @param {import("./chat_panel.mjs").LiveChatPanel} panel config panel
	 */
	async show(event, target, panel) {
		this.#element.replaceChildren();
		const doc = await loadTemplateDocument('../templates/panel_contextmenu.html');
		this.#element.append(...doc.body.childNodes);
		this.#element.style.display = '';
		this.#element.style.opacity = '1';
		let width = 0, height = 0;
		for (const c of this.#element.children) {
			const rect = c.getBoundingClientRect();
			if (width < rect.width) width = rect.width;
			height += rect.height;
		}
		this.#element.style.width = width ? width + 'px' : '';
		this.#element.style.height = height ? height + 'px' : '';
		this.#element.style.left = `${event.x}px`;
		this.#element.style.top = `${event.y}px`;
		this.#element.onclick = e => {
			for (const el of e.composedPath()) {
				/** @type {keyof typeof menuFns | null} */ // @ts-expect-error
				const name = el.getAttribute('data-menu');
				if (name && name in menuFns) {
					menuFns[name](target, panel);
					this.hide();
					return;
				}
			}
		};
	}

	hide() {
		this.#element.style.opacity = '0';
	}
}
