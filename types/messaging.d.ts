import "webextension-polyfill";

declare module "webextension-polyfill" {
	namespace Runtime {
		interface Static {
			onMessage: Events.Event<YTLCFMessage.Request.Any>;
			sendMessage(message: { nonce: Any }): Promise<{ nonce: string | null } | void>;
			sendMessage(message: YTLCFMessage.Request.LanguageDetection): Promise<YTLCFMessage.Response.LanguageDetection | void>;
			sendMessage(message: YTLCFMessage.Request.Translation): Promise<YTLCFMessage.Response.Translation | void>;
			sendMessage(message: YTLCFMessage.Request.PersonDetection): Promise<YTLCFMessage.Response.PersonDetection | void>;
			sendMessage(message: YTLCFMessage.Request.EventFire): Promise<YTLCFMessage.Response.EventFire | void>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"arrayBuffer">): Promise<YTLCFMessage.Response.BackgroundFetch<ArrayBuffer> | YTLCFMessage.Response.Error | void>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"blob">): Promise<YTLCFMessage.Response.BackgroundFetch<Blob> | YTLCFMessage.Response.Error | void>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"bytes">): Promise<YTLCFMessage.Response.BackgroundFetch<Uint8Array> | YTLCFMessage.Response.Error | void>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"json">): Promise<YTLCFMessage.Response.BackgroundFetch<Record<string, any> | any[]> | YTLCFMessage.Response.Error | void>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"text">): Promise<YTLCFMessage.Response.BackgroundFetch<string> | YTLCFMessage.Response.Error | void>;
			sendMessage(message: any): Promise<unknown>;
		}
	}
}

namespace YTLCFMessage {
	namespace Request {
		type Any = LanguageDetection | Translation | PersonDetection | EventFire | BackgroundFetch<AcceptableFetchType>;
		type AcceptableFetchType = "arrayBuffer" | "blob" | "bytes" | "json" | "text";

		type LanguageDetection = {
			detection: {
				text: string;
			};
		};
		type Translation = {
			translation: {
				text: string;
				source: string;
				target: string;
			};
		};
		type PersonDetection = {
			mask: Blob
			width?: number;
			height?: number;
		};
		type EventFire = {
			fire: "reload" | "reloadTabs" | "openOptions";
		};
		type BackgroundFetch<T extends AcceptableFetchType> = {
			request: {
				url: string;
				options?: RequestInit;
			};
			contentType: T;
		};
	}

	namespace Response {
		type LanguageDetection = {
			source: string;
			isReliable: boolean;
		};
		type Translation = {
			sentence: string;
			src: string;
		};
		type PersonDetection = SegmentationResult[];
		type BackgroundFetch<T> = {
			data: T;
		};
		type Error = {
			error: string;
		};
	}

	type Callback = (
		message: Request.Any,
		sender: import("webextension-polyfill").Runtime.MessageSender,
		respond: (response: unknown) => void,
	) => true;
}

interface SegmentationResult {
	label: string | null;
	score: number | null;
	mask: {
		data: Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float16Array | Float32Array | Float64Array;
		width: number;
		height: number;
		channel: number;
	};
}
