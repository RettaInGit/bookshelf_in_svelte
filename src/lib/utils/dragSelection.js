import { tick } from 'svelte';

// The page checkboxes are the selection: a drag carries every ticked row of the list,
// or just the grabbed one when it is not ticked. Read at drag start, while the DOM
// order still matches the data order.
export function collectDragSet(listEl, item) {
	const rows = Array.from(listEl.children).filter((el) => el.classList.contains('pageListItem'));
	const ticked = (el) => el.querySelector('.pageCheckbox')?.checked;
	const picked = ticked(item) ? rows.filter(ticked) : [item];

	return { rows: picked, indexes: picked.map((el) => rows.indexOf(el)) };
}

// Fade the rows travelling with the grabbed one. Their space is kept so the drop
// targets Sortable measured do not move under the pointer.
export function markTravelling(rows, grabbed) {
	for (const el of rows) if (el !== grabbed) el.classList.add('pageTravelling');
}

export function clearTravelling() {
	for (const el of document.querySelectorAll('.pageTravelling')) el.classList.remove('pageTravelling');
}

// Puts the row Sortable carried back where it was picked up. Needed wherever the drop is
// not what decides the order: if the data then comes out unchanged Svelte redraws nothing,
// and the DOM would be left holding a move the data never took.
export function restoreRow(listEl, item, index) {
	if (!listEl) return;
	item.remove();
	listEl.insertBefore(item, listEl.children[index] ?? null);
}

// Sortable animates the row it carried; the others only reappear once Svelte has
// redrawn the lists, so they get their own arrival animation.
export async function animateArrival(scopeEl, pageIds) {
	if (!scopeEl || pageIds.length === 0) return;
	await tick();

	for (const id of pageIds) {
		const el = scopeEl.querySelector(`.pageListItem[data-page-id="${id}"]`);
		if (!el) continue;
		el.classList.add('pageArriving');
		setTimeout(() => el.classList.remove('pageArriving'), 200);
	}
}

// Sortable options shared by every list: no handle, the controls left alone, and
// Sortable's own drag instead of the browser's. That last part is what keeps clicks
// working: below fallbackTolerance no drag starts, so a press that drifts a few pixels
// still opens the page. The native path cannot do this - it forces touchStartThreshold
// to 1 (sortable.complete.esm.js:1129) and swallows the click as soon as it drags.
// fallbackOnBody keeps the dragged row visible outside .bookListItem, which clips.
export function dragBehaviour(filter) {
	return {
		filter,
		preventOnFilter: false,
		forceFallback: true,
		fallbackTolerance: 5,
		fallbackOnBody: true
	};
}
