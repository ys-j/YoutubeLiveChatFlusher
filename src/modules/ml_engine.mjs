import { logger } from "./logging.mjs";

/**
 * @typedef {"huggingface" | "mozilla"} ModelHub
 * @typedef {"HIGH" | "NORMAL" | "LOW"} ExecutionPriority
 * @typedef {"fp32" | "fp16" | "fp8_e5m2" | "fp8_e4m3" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16"} QuantizationLevel
 * @typedef {"q8_0" | "q4_0" | "q4_1" | "q5_1" | "q5_0" | "f16" | "f32"} KVCacheQuantizationLevel
 * @typedef {"gpu" | "wasm" | "cpu"} InferenceDevice
 * @typedef {"Trace" | "Info" | "Debug" | "Warn" | "Error" | "Critical" | "All"} LogLevel
 * @typedef {"onnx" | "wllama" | "onnx-native" | "llama.cpp" | "best-llama" | "best-onnx" | "openai" | "static-embeddings"} Backend
 * @typedef {"ai" | "memories" | "agent"} ServiceType
 * @typedef {"chat" | "title-generation" | "convo-starters-sidebar" | "memory-generation" | "monitor"} Purpose
 */
/**
 * @typedef StaticEmbeddingsOptions
 * @prop {string} subfolder
 * @prop {"fp32" | "fp16" | "fp8_e5m2" | "fp8_e4m3"} dtype
 * @prop {number} dimensions
 * @prop {boolean} compression
 * @prop {Record<string, Iterable<number>>} [mockedValues]
 */

/**
 * @typedef PipelineOptions
 * @prop {?string} engineId
 * @prop {?string} featureId
 * @prop {?string} taskName
 * @prop {?ModelHub} modelHub
 * @prop {?string} modelHubRootUrl
 * @prop {?string} modelHubUrlTemplate
 * @prop {?number} timeoutMS
 * @prop {?string} modelId
 * @prop {?string} modelRevision
 * @prop {?string} flowId
 * @prop {?string} tokenizerId
 * @prop {?string} tokenizerRevision
 * @prop {?string} processorId
 * @prop {?string} processorRevision
 * @prop {?LogLevel} logLevel
 * @prop {?string} runtimeFilename
 * @prop {?InferenceDevice} device
 * @prop {?QuantizationLevel} dtype
 * @prop {?number} numThreads
 * @prop {?ExecutionPriority} executionPriority
 * @prop {?string} useExternalDataFormat
 * @prop {?KVCacheQuantizationLevel} kvCacheDtype
 * @prop {?number} numContext
 * @prop {?number} numBatch
 * @prop {?number} numUbatch
 * @prop {?boolean} flashAttn
 * @prop {?boolean} useMmap
 * @prop {?boolean} useMlock
 * @prop {?number} numThreadsDecoding
 * @prop {?string} modelFile
 * @prop {?Backend} backend
 * @prop {?string} baseURL
 * @prop {?string} apiKey
 * @prop {?StaticEmbeddingsOptions} staticEmbeddingsOptions
 * @prop {?ServiceType} serviceType
 * @prop {?Purpose} purpose
 * @prop {?Record<string, string>} extraHeaders
 */

export class MLEngineManager {
	/** @type {Partial<PipelineOptions>} */
	#req;
	/** @type {?Promise<void>} */
	#loading = null;
	/** @type {?Error} */
	#disabledError = null;

	/**
	 * @param {Partial<PipelineOptions>} req
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
