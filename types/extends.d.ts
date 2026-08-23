declare global {
	const browser: import("npm:@types/webextension-polyfill").Browser;

	interface ObjectConstructor {
		keys<T extends object>(o: T): Array<keyof T>;
		entries<T extends object>(o: T): Array<[keyof T, T[keyof T]]>;
	}

	interface Window {
		documentPictureInPicture?: DocumentPictureInPicture;
		queryLocalFonts?(options?: { postscriptNames: string[] }): Promise<FontData[]>;
	}

	interface Node {
		cloneNode<T extends Node>(this: T, deep?: boolean): T;
	}

	interface HTMLFormControlsCollection {
		[K: string]: RadioNodeList | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLFieldSetElement | HTMLElement | undefined;
	}

	interface MouseEvent {
		originalTarget?: EventTarget;
		explicitOriginalTarget?: EventTarget;
	}

	interface GlobalEventHandlersEventMap {
		[K: string]: CustomEvent;
	}
	interface AbortSignalEventMap {
		[K: string]: CustomEvent;
	}

	type TypedArray = Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float16Array | Float32Array | Float64Array;
}

export type FontData = {
	family: string;
	fullName: string;
	postscriptName: string;
	style: string;
	blob(): Promise<Blob>;
}

export type DocumentPictureInPictureOptions = {
	width?: number;
	height?: number;
	disallowReturnToOpener?: boolean;
	preferInitialWindowPlacement?: boolean;
}

export type DocumentPictureInPictureEvent = Event & {
	window: Window;
}
export type DocumentPictureInPicture = EventTarget & {
	window?: Window;
	requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
	addEventListener(type: "enter", callback: (evt: DocumentPictureInPictureEvent) => void | null, options?: AddEventListenerOptions | boolean): void;
}
