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