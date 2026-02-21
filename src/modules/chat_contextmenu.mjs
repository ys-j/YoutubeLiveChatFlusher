import { loadTemplateDocument } from './utils.mjs';
import { LiveChatPanel } from './chat_panel.mjs';

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
	 * @param {LiveChatPanel} panel 
	 */
	async show(event, target, panel) {
		while (this.#element.firstChild) this.#element.firstChild.remove();
		const doc = await loadTemplateDocument('../templates/panel_contextmenu.html');
		doc.querySelectorAll('[data-i18n]').forEach(e => {
			const key = /** @type {HTMLElement} */ (e).dataset.i18n;
			if (key) e.textContent = browser.i18n.getMessage(key);
		});
		this.#element.append(...doc.body.childNodes);
		this.#element.style.display = '';
		this.#element.style.opacity = '1';
		const rects = Array.from(this.#element.children, c => c.getBoundingClientRect());
		const width = Math.max(...rects.map(r => r.width));
		const height = rects.reduce((a, c) => a + c.height, 0);
		this.#element.style.width = width ? width + 'px' : '';
		this.#element.style.height = height ? height + 'px' : '';
		this.#element.style.left = `${event.x}px`;
		this.#element.style.top = `${event.y}px`;
		this.#element.onclick = e => {
			this.#onClickMenu(e.composedPath(), target, panel);
		};
	}

	hide() {
		this.#element.style.opacity = '0';
	}

	/**
	 * @param {EventTarget[]} composedPath
	 * @param {HTMLElement} target  
	 * @param {LiveChatPanel} panel 
	 */
	#onClickMenu(composedPath, target, panel) {
		const menus = {
			resume_animation: this.#resumeAnimation,
			move_message: this.#moveMessage,
			copy_user_id: this.#copyUserId,
			hide_user: this.#hideUser,
		};
		for (const el of composedPath) {
			const name = /** @type {HTMLElement} */ (el).dataset?.menu;
			if (name && name in menus) {
				// @ts-ignore
				menus[name](target, panel);
				this.hide();
				return;
			}
		}
	}

	/**
	 * @param {HTMLElement} target  
	 */
	#resumeAnimation(target) {
		target.classList.remove('paused');
	}

	/**
	 * @param {HTMLElement} target  
	 */
	#moveMessage(target) {
		target.style.cursor = 'move';
		target.addEventListener('mousedown', e => {
			const [_, y] = (target.style.translate || '0 0').split(' ').map(v => Number.parseInt(v));
			const computedStyle = getComputedStyle(target);
			const speed = Number.parseInt(target.style.getPropertyValue('--yt-lcf-translate-x')) / Number.parseFloat(computedStyle.animationDuration);
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
			}, { passive: true, once: true });
		}, { once: true });
	}

	/**
	 * @param {HTMLElement} target  
	 */
	#copyUserId(target) {
		const authorId = target.dataset.authorId;
		if (authorId) {
			navigator.clipboard.writeText(authorId);
		}
	}

	/**
	 * @param {HTMLElement} target  
	 * @param {LiveChatPanel} panel 
	 */
	#hideUser(target, panel) {
		const authorId = target.dataset.authorId;
		const textarea = /** @type {HTMLTextAreaElement | undefined} */ (panel.form?.elements.user_defined_css);
		if (authorId && textarea) {
			textarea.value += `\ndiv[data-author-id="${authorId}"] { display: none !important }`;
			panel.updateStorage(textarea);
		}
		target.remove();
	}
}