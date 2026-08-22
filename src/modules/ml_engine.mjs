import { logger } from './logging.mjs';

export class MLEngineManager {
	/** @type {Partial<MLEngineManagerOptions.PipelineOptions>} */
	#req;
	/** @type {?Promise<void>} */
	#loading = null;
	/** @type {?Error} */
	#disabledError = null;

	/**
	 * @param {Partial<MLEngineManagerOptions.PipelineOptions>} req
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
			const errMsg = Error.isError(cause) ? cause.message : null;
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
	 * @param {unknown} req.args
	 * @param {Record<string, unknown>} [req.options]
	 * @param {Record<string, unknown>} [req.streamerOptions]
	 */
	async run(req) {
		await this.ensureReady();
		if (!this.isReady) throw this.#disabledError;
		return browser.trial.ml.runEngine(req);
	}
}
