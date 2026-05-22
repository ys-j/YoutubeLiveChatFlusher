import type Browser from "webextension-polyfill";

declare global {
	const browser: Browser.Browser;

	interface ObjectConstructor {
		keys<T extends Record>(o: T): Array<keyof T>;
		entries<T extends Record>(o: T): Array<[keyof T, T[keyof T]]>;
	}

	interface Window {
		queryLocalFonts?(options?: { postscriptNames: string[] }): Promise<FontData[]>;
		documentPictureInPicture?: DocumentPictureInPicture;
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
}

/*
 * Type Definitions
 */
type FontData = {
	family: string;
	fullName: string;
	postscriptName: string;
	style: string;
	blob(): Promise<Blob>;
}

type DocumentPictureInPictureOptions = {
	width?: number;
	height?: number;
	disallowReturnToOpener?: boolean;
	preferInitialWindowPlacement?: boolean;
}

/*
 * Interface Definitions
 */

interface DocumentPictureInPictureEvent extends Event {
	window: Window;
}
interface DocumentPictureInPicture extends EventTarget {
	window?: Window;
	requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
	addEventListener(type: "enter", callback: (evt: DocumentPictureInPictureEvent) => void, options?: AddEventListenerOptions | boolean): void;
}