namespace MLEngineManagerOptions {
	type ModelHub = "huggingface" | "mozilla";
	type ExecutionPriority = "HIGH" | "NORMAL" | "LOW";
	type QuantizationLevel = "fp32" | "fp16" | "fp8_e5m2" | "fp8_e4m3" | "q8" | "int8" | "uint8" | "q4" | "bnb4" | "q4f16";
	type KVCacheQuantizationLevel = "q8_0" | "q4_0" | "q4_1" | "q5_1" | "q5_0" | "f16" | "f32";
	type InferenceDevice = "gpu" | "wasm" | "cpu";
	type LogLevel = "Trace" | "Info" | "Debug" | "Warn" | "Error" | "Critical" | "All";
	type Backend = "onnx" | "wllama" | "onnx-native" | "llama.cpp" | "best-llama" | "best-onnx" | "openai" | "static-embeddings";
	type ServiceType = "ai" | "memories" | "agent";
	type Purpose = "chat" | "title-generation" | "convo-starters-sidebar" | "memory-generation" | "monitor";

	type StaticEmbeddingsOptions = {
		subfolder?: string;
		dtype?: "fp32" | "fp16" | "fp8_e5m2" | "fp8_e4m3";
		dimensions?: number;
		compression?: boolean;
		mockedValues?: Record<string, Iterable<number>>;
	};

	type PipelineOptions = {
		engineId?: string;
		featureId?: string;
		taskName?: string;
		modelHub?: ModelHub;
		modelHubRootUrl?: string;
		modelHubUrlTemplate?: string;
		timeoutMS?: number;
		modelId?: string;
		modelRevision?: string;
		flowId?: string;
		tokenizerId?: string;
		tokenizerRevision?: string;
		processorId?: string;
		processorRevision?: string;
		logLevel?: LogLevel;
		runtimeFilename?: string;
		device?: InferenceDevice;
		dtype?: QuantizationLevel;
		numThreads?: number;
		executionPriority?: ExecutionPriority;
		useExternalDataFormat?: string;
		kvCacheDtype?: KVCacheQuantizationLevel;
		numContext?: number;
		numBatch?: number;
		numUbatch?: number;
		flashAttn?: boolean;
		useMmap?: boolean;
		useMlock?: boolean;
		numThreadsDecoding?: number;
		modelFile?: string;
		backend?: Backend;
		baseURL?: string;
		apiKey?: string;
		staticEmbeddingsOptions?: StaticEmbeddingsOptions;
		serviceType?: ServiceType;
		purpose?: Purpose;
		extraHeaders?: Record<string, string>;
	};

}
