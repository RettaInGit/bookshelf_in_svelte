<script>
	import Sortable from 'sortablejs/modular/sortable.esm.js';  // mounts AutoScroll, not MultiDrag
	import { dragBehaviour } from '$lib/utils/dragSelection.js';
	import BookItem from './BookItem.svelte';
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { generateUUID } from '$lib/utils/uuid.js';

	let listEl = $state(null);

	const resultMessage = $derived.by(() => {
		if (bs.loadingBookshelfData) return 'Loading your bookshelf...';
		const shelf = bs.currentShelf;
		if (!shelf) return 'Error when loading the shelf. Try to reload the extension.';
		if (shelf.books.length === 0) return 'No pages saved. Try adding some.';
		const q = bs.searchQuery.toLowerCase();
		if (q && !shelf.books.some((b) => b.pages.some((p) => p.title.toLowerCase().includes(q)))) {
			return 'No pages match your search.';
		}
		return '';
	});

	$effect(() => {
		if (!listEl) return;
		const dropAreaListEl = document.getElementById('dropAreaList');

		const sortable = Sortable.create(listEl, {
			group: { name: 'movePages' },
			swapThreshold: 0.9,
			animation: 150,
			...dragBehaviour('button, input'),

			onEnd(evt) {
				const shelf = bs.bookshelfData.find((s) => s.id === bs.selectedShelfId);
				if (!shelf) return;

				const itemIndex = evt.oldIndex;
				const bookDragged = shelf.books[itemIndex];
				if (!bookDragged) return;

				let pagesDragged = $state.snapshot(bookDragged.pages);  // structuredClone() cannot clone state proxies
				let newIndex = evt.newIndex;

				if (evt.from === evt.to) {
					// ── Book reorder ──────────────────────────────────────────────
					if (newIndex !== itemIndex) {
						shelf.books.splice(newIndex, 0, shelf.books.splice(itemIndex, 1)[0]);
					}
					bs.markDirty();
				} else if (evt.to === dropAreaListEl) {
					// ── Book → drop area ──────────────────────────────────────────
					const filteringIndexes = [];
					pagesDragged.forEach((page, pi) => {
						if (bs.pagesToMove.some((i) => i.shelfId === bs.selectedShelfId && i.bookId === bookDragged.id && i.id === page.id)) {
							filteringIndexes.push(pi);
						} else {
							page.shelfId = bs.selectedShelfId;
							page.bookId = bookDragged.id;
						}
					});
					const toAdd = pagesDragged.filter((_, pi) => !filteringIndexes.includes(pi));

					// put book back in bookList
					if (itemIndex >= listEl.children.length) {
						listEl.appendChild(evt.item);
					} else {
						listEl.insertBefore(evt.item, listEl.children[itemIndex]);
					}
					if (dropAreaListEl?.contains(evt.item)) dropAreaListEl.removeChild(evt.item);

					if (toAdd.length > 0) bs.pagesToMove.splice(newIndex, 0, ...toAdd);
					bs.markDirty();
				} else {
					// ── Book → existing page list (merge) ─────────────────────────
					const endBookId = evt.to.closest('.bookListItem')?.dataset.bookId;
					const endBook = shelf.books.find((b) => b.id === endBookId);
					if (!endBook) return;

					const pagesIds = endBook.pages.map((p) => p.id);
					pagesDragged.forEach((page) => {
						const item = bs.pagesToMove.find(
							(i) => i.shelfId === bs.selectedShelfId && i.bookId === bookDragged.id && i.id === page.id
						);
						while (pagesIds.includes(page.id)) page.id = generateUUID();
						if (item) { item.bookId = endBookId; item.id = page.id; }
					});

					endBook.pages.splice(newIndex, 0, ...pagesDragged);
					shelf.books.splice(itemIndex, 1);

					// Drop the element Sortable transplanted: both lists are redrawn from the data
					evt.item.remove();
					bs.markDirty();
				}

			}
		});

		return () => sortable.destroy();
	});
</script>

{#if resultMessage}
	<p id="resultMessage">{resultMessage}</p>
{/if}

<div id="bookList" bind:this={listEl}>
	{#each bs.currentShelf?.books ?? [] as book (book.id)}
		<BookItem {book} shelfId={bs.selectedShelfId} bookListEl={listEl} />
	{/each}
</div>
