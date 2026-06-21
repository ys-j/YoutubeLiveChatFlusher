/**
 * @typedef LogLevelOptions
 * @prop {boolean} [debug]
 * @prop {boolean} [info]
 * @prop {boolean} [warn]
 */

class Logger {
	/**
	 * @param {string} name
	 * @param {string[]} prefix
	 * @param {LogLevelOptions} [level]
	 */
	constructor(name, prefix, { debug = false, info = true, warn = true } = {}) {
		this.name = name;

		const _void = () => {};
		this.debug = debug ? console.debug.bind(console, ...prefix) : _void;
		this.info = info ? console.info.bind(console, ...prefix) : _void;
		this.warn = warn ? console.warn.bind(console, ...prefix) : _void;
		this.error = console.error.bind(console, ...prefix);

		this.group = console.groupCollapsed.bind(console, ...prefix);
		this.groupEnd = console.groupEnd;
	}
}

export const logger = new Logger('YTLCF', [
	'[%cYTLCF%c...<%c]',
	'font-family:sans-serif;font-weight:700;padding-right:.33em',
	'border-radius:.33em;background-color:red;color:white;font-family:sans-serif;font-weight:700;padding:0 .33em',
	'',
], { debug: true });
