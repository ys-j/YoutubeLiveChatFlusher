import { logger } from "./logging.mjs";

/**
 * @typedef MLEngingCreateEngineRequest
 * @prop {string} taskName
 * @prop {"huggingface" | "mozilla"} [modelHub]
 * @prop {string} [modelId]
 * @prop {string} [modelRevision]
 * @prop {string} [tokenizerId]
 * @prop {string} [tokenizerRevision]
 * @prop {string} [processorId]
 * @prop {string} [processorRevision]
 * @prop {string} [dtype]
 * @prop {"wasm" | "gpu"} [device]
 */

export class MLEngineManager {
	/** @type {MLEngingCreateEngineRequest} */
	#req;
	/** @type {?Promise<void>} */
	#loading = null;
	/** @type {?Error} */
	#disabledError = null;

	/**
	 * @param {MLEngingCreateEngineRequest} req
	 */
	constructor(req) {
		this.#req = req;
		this.isReady = false;
	}

	async ensureReady() {
		if (this.#disabledError) throw this.#disabledError;
		if (this.isReady) return;
		this.#loading ??= this.#initialize();
		return this.#loading;
	}

	async #initialize() {
		try {
			if (!browser.trial?.ml) throw new Error('WebExtensions AI API is not supported yet.');
			await browser.trial.ml.createEngine(this.#req);
			logger.info(`Successfully created the MLEngine[${this.#req.taskName}]:`, this.#req);
			this.isReady = true;
		} catch (cause) {
			const errMsg = cause instanceof Error ? cause.message : null;
			if (errMsg?.includes('already created')) {
				logger.warn(errMsg.replace('Engine', `MLEngine[${this.#req.taskName}]`));
				this.isReady = true;
			} else {
				this.#disabledError = new Error(`MLEngine [${this.#req.taskName}] has been disabled due to previous failure.`, { cause });
				logger.error(`An error occurred while initilizing MLEngine [${this.#req.taskName}].\nCaused by:`, cause);
				this.isReady = false;
			}
		} finally {
			this.#loading = null;
		}
	}

	/**
	 * @param {object} req
	 * @param {any[]} req.args
	 */
	async run(req) {
		await this.ensureReady();
		if (!this.isReady) throw this.#disabledError;
		return browser.trial.ml.runEngine(req);
	}
}
