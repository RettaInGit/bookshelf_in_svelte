// Move the caret to the end of a contenteditable element, as the browser would after a click
export function focusAtEnd(el) {
	if (!el) return;

	el.focus();
	if (typeof window.getSelection === 'undefined' || typeof document.createRange === 'undefined') return;

	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);

	const selection = window.getSelection();
	selection.removeAllRanges();
	selection.addRange(range);
}
