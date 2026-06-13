class Logger {
	/**
	 * @param {string} name
	 * @param {string[]} prefix 
	 */
	constructor(name, prefix) {
		this.name = `[${name}]`;
		this.debug = console.debug.bind(console, ...prefix);
		this.info = console.info.bind(console, ...prefix);
		this.warn = console.warn.bind(console, ...prefix);
	}

	/**
	 * @param {string} message
	 * @param {unknown} [cause]
	 */
	error(message, cause) {
		const err = new Error(message, { cause });
		err.name = this.name;
		// @ts-expect-error
		Error?.captureStackTrace?.(err, this.error);
		console.error(err);
	}
}

export const logger = new Logger('YTLCF', [
	'[%cYTLCF%c\u2026<%c]',
	'font-weight:800;padding-right:.33em',
	'border-radius:.33em;background-color:red;color:white;padding:0 .33em',
	'',
]);
