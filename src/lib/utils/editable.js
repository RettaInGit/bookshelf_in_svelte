// Move the caret to the end of a contenteditable element, as the browser would after a click
export function focusAtEnd(el) {
	focusWithSelection(el, true);
}

// Select the whole text of a contenteditable element, so typing replaces it
export function focusAndSelectAll(el) {
	focusWithSelection(el, false);
}

function focusWithSelection(el, collapseToEnd) {
	if (!el) return;

	el.focus();
	if (typeof window.getSelection === 'undefined' || typeof document.createRange === 'undefined') return;

	const range = document.createRange();
	range.selectNodeContents(el);
	if (collapseToEnd) range.collapse(false);

	const selection = window.getSelection();
	selection.removeAllRanges();
	selection.addRange(range);
}
