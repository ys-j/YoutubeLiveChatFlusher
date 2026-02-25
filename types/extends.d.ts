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
}

interface Window {
	queryLocalFonts?(options?: { postscriptNames: string[] }): Promise<FontData[]>;
	documentPictureInPicture?: DocumentPictureInPicture;
	Translator: TranslatorFactory;
}

interface Node {
	cloneNode<T extends Node>(this: T, deep?: boolean): T;
}

interface MouseEvent {
	originalTarget?: EventTarget;
	explicitOriginalTarget?: EventTarget;
}

interface GlobalEventHandlersEventMap {
	[K: string]: CustomEvent;
}

interface HTMLFormControlsCollection {
	[K: string]: RadioNodeList | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLFieldSetElement | HTMLElement | undefined;
}

interface TranslatorCreateCoreOptions {
	sourceLanguage: string;
	targetLanguage: string;
}

interface TranslatorCreateOptions extends TranslatorCreateCoreOptions {
	monitor?: CreateMonitor
	signal?: AbortSignal
}

interface TranslatorSession {
	translate(text: string): Promise<string>;
	destroy(): void;
}

interface TranslatorFactory {
	availability(options: TranslatorCreateCoreOptions): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
	create(options: TranslatorCreateOptions): Promise<TranslatorSession>;
}