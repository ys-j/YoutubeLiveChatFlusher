/**
 * Gets string from a message object.
 * @param { LiveChat.Runs | LiveChat.SimpleText | LiveChat.RichTextContent | undefined } message message object: Runs or SimpleText
 * @returns {string} message string
 */
export function getText(message) {
	if (!message) return '';
	if ('simpleText' in message) return message.simpleText;
	if ('content' in message) return message.content;
	const rslt = [];
	for (const r of message.runs) {
		if ('text' in r) {
			rslt.push(r.text);
		} else {
			rslt.push(r.emoji.shortcuts?.[0] || r.emoji.emojiId || '');
		}
	}
	return rslt.join('');
}

/**
 * Converts a plain text to PascalCase.
 * @param {string} str plain text
 * @returns {string} PascalCase text
 */
export const toPascalCase = str => str.toLowerCase().replace(/(?:^|_+|-+)(\w)/g, (_, m) => m.toUpperCase());

/**
 * Converts color from long integer to array of integer.
 * @param {number} long integer of color `0xAARRGGBB`
 * @returns {number[]} array of integer `[RR, GG, BB]`
 */
export function getColorRGB(long) {
	/** @type {string[]} */
	const separated = long.toString(16).match(/[0-9a-f]{2}/g) || [];
	return separated.map(hex => Number.parseInt(hex, 16)).slice(1);
}

/**
 * Formats milliseconds number to "h:mm:ss.fff"-style.
 * @param {number} ms milliseconds
 * @returns {string} formatted string
 */
export function formatMilliseconds(ms) {
	const SECOND = 1000;
	const MINUTE = 60 * SECOND;
	const HOUR = 60 * MINUTE;
	/** @type {(f: number, digits?: number) => string} */
	const zfill = (f, digits = 2) => `${Math.floor(f)}`.padStart(digits, '0');
	const h = Math.floor(ms / HOUR);
	const mm = zfill((ms % HOUR) / MINUTE);
	const ss = zfill((ms % MINUTE) / SECOND);
	const fff = zfill(ms % SECOND, 3);
	return (h > 0 ? `${h}:` : '') + `${mm}:${ss}.${fff}`;
}

/**
 * Resolves a JSON Pointer against a JSON object.
 * @param {any} obj the target JSON object or array
 * @param {string} pointer the JSON Pointer string
 * @returns {any} the resolved value, or `undefined` if not found
 * @throws if the pointer is non-empty and does not start with "/"
 */
export function getValueByJSONPointer(obj, pointer) {
	if (pointer === '') return obj;
	if (!pointer.startsWith('/')) {
		throw new Error('Pointer must start with "/"');
	}
	const tokens = pointer.split('/').slice(1);
	let cur = obj;
	for (const token of tokens) {
		if (typeof cur !== 'object' || cur === null) return undefined;
		const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
		if (Object.hasOwn(cur, key)) cur = cur[key];
		else return undefined;
	}
	return cur;
}

/**
 * Waits for the given number of milliseconds.
 * @param {number} ms milliseconds
 * @param {object} [options] options
 * @param {AbortSignal} [options.signal] signal for aborting sleep
 * @returns {Promise<void>} void promise
 */
export function sleep(ms, { signal } = {}) {
	/** @type {PromiseWithResolvers<void>} */
	const { promise, resolve } = Promise.withResolvers();
	if (signal?.aborted) {
		resolve();
		return promise;
	}
	/** @type {number | undefined} */
	let timer = undefined;
	const onDone = () => {
		clearTimeout(timer);
		signal?.removeEventListener('abort', onDone);
		resolve();
	};
	if (ms > 0 && Number.isFinite(ms)) timer = setTimeout(onDone, ms);
	signal?.addEventListener('abort', onDone, { once: true });
	return promise;
}
