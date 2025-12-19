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
interface DocumentPictureInPicture {
	window?: Window;
	requestWindow: (options?: DocumentPictureInPictureOptions) => Promise<Window>;
}
interface Window {
	queryLocalFonts?(options?: { postscriptNames: string[] }): Promise<FontData[]>;
	documentPictureInPicture?: DocumentPictureInPicture;
}
interface Node {
	cloneNode<T extends Node>(this: T, deep?: boolean): T;
}
interface MouseEvent {
	originalTarget?: EventTarget;
	explicitOriginalTarget?: EventTarget;
}
interface WindowEventMap {
	[K: string]: CustomEvent;
}
interface DocumentEventMap {
	[K: string]: CustomEvent;
}
interface HTMLElementEventMap {
	[K: string]: CustomEvent;
}
interface HTMLFormControlsCollection {
	[K: string]: RadioNodeList | HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLFieldSetElement | HTMLElement | undefined;
}