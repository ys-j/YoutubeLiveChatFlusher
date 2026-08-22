import "webextension-polyfill";
import { Scripting } from "webextension-polyfill";
import { DEFAULT_CONFIG } from "../src/modules/store.mjs";

declare module "webextension-polyfill" {
	namespace Runtime {
		interface Static {
			onMessage: Events.Event<YTLCFMessage.Request.Any>;
			sendMessage(message: YTLCFMessage.Request.Injection): Promise<Scripting.Static.InjectionResult[] | YTLCFMessage.Response.Error>;
			sendMessage(message: YTLCFMessage.Request.LanguageDetection): Promise<YTLCFMessage.Response.LanguageDetection>;
			sendMessage(message: YTLCFMessage.Request.Translation): Promise<YTLCFMessage.Response.Translation>;
			sendMessage(message: YTLCFMessage.Request.PersonDetection): Promise<YTLCFMessage.Response.PersonDetection | YTLCFMessage.Response.Error>;
			sendMessage(message: YTLCFMessage.Request.EventFire): Promise<string | YTLCFMessage.Response.Error>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"arrayBuffer">): Promise<YTLCFMessage.Response.BackgroundFetch<ArrayBuffer> | YTLCFMessage.Response.Error>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"blob">): Promise<YTLCFMessage.Response.BackgroundFetch<Blob> | YTLCFMessage.Response.Error>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"bytes">): Promise<YTLCFMessage.Response.BackgroundFetch<Uint8Array> | YTLCFMessage.Response.Error>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"json">): Promise<YTLCFMessage.Response.BackgroundFetch<Record<string, any> | any[]> | YTLCFMessage.Response.Error>;
			sendMessage(message: YTLCFMessage.Request.BackgroundFetch<"text">): Promise<YTLCFMessage.Response.BackgroundFetch<string> | YTLCFMessage.Response.Error>;
			sendMessage(message: any): Promise<unknown | YTLCFMessage.Response.Error>;
		}
	}
}

namespace YTLCFMessage {
	namespace Request {
		type Any = Injection | LanguageDetection | Translation | PersonDetection | EventFire | BackgroundFetch<AcceptableFetchType>;
		type AcceptableFetchType = "arrayBuffer" | "blob" | "bytes" | "json" | "text";

		type Injection = {
			injection: "init";
			details: {
				nonce: string;
			};
		} | {
			injection: "pip";
			details: {
				cssUrl: string;
				pipMarkerText: string;
				hotkeys: typeof DEFAULT_CONFIG.hotkeys;
			};
		};
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
		};
		type EventFire = {
			fire: "reload" | "reloadTabs" | "openOptions" | "getNonce";
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
			error: {
				name?: string;
				message: string;
			};
		};
	}
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
