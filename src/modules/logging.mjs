/**
 * @typedef LogLevelOptions
 * @prop {boolean} [debug]
 * @prop {boolean} [info]
 * @prop {boolean} [warn]
 */

class Logger {
	#prefix;

	/**
	 * @param {string} name
	 * @param {string[]} prefix
	 * @param {LogLevelOptions} [level]
	 */
	constructor(name, prefix, { debug = false, info = true, warn = true } = {}) {
		this.name = `[${name}]`;
		this.#prefix = prefix;

		const _void = () => {};
		this.debug = debug ? console.debug.bind(console, ...prefix) : _void;
		this.info = info ? console.info.bind(console, ...prefix) : _void;
		this.warn = warn ? console.warn.bind(console, ...prefix) : _void;

		this.group = console.groupCollapsed.bind(console, ...prefix);
		this.groupEnd = console.groupEnd;
	}

	/**
	 * @param {string} message
	 * @param {unknown} [cause]
	 * @param {any[]} args
	 */
	error(message, cause, ...args) {
		const err = new Error(message, { cause });
		err.name = this.name;
		// @ts-expect-error
		Error.captureStackTrace?.(err, this.error);
		console.error(...this.#prefix, err, ...args);
	}
}

export const logger = new Logger('YTLCF', [
	'[%cYTLCF%c...<%c]',
	'font-family:sans-serif;font-weight:700;padding-right:.33em',
	'border-radius:.33em;background-color:red;color:white;font-family:sans-serif;font-weight:700;padding:0 .33em',
	'',
], { debug: true });
