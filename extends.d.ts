type FontData = {
	family: string;
	fullName: string;
	postscriptName: string;
	style: string;
	blob(): Promise<Blob>;
}
interface Window {
	queryLocalFonts?(options?: { postscriptNames: string[] }): Promise<FontData[]>;
}
interface Node {
	cloneNode<T extends Node>(this: T, deep?: boolean): T;
}
interface MouseEvent {
	originalTarget?: EventTarget;
	explicitOriginalTarget?: EventTarget;
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