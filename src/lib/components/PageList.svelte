<script>
	import Sortable from 'sortablejs/modular/sortable.esm.js';  // mounts AutoScroll, not MultiDrag
	import { collectDragSet, markTravelling, clearTravelling, animateArrival, dragBehaviour } from '$lib/utils/dragSelection.js';
	import PageItem from './PageItem.svelte';
	import { bs, firstUnpinnedIndex } from '$lib/state/bookshelf.svelte.js';
	import { generateUUID } from '$lib/utils/uuid.js';
	import { dragAnimation, newBookFlags } from '$lib/state/settings.svelte.js';

	/** @type {{ book: any, shelfId: string, bookListEl: HTMLElement | null }} */
	let { book, shelfId, bookListEl } = $props();

	let listEl = $state(null);

	function syncBookCheckbox() {
		const bookListItemEl = listEl?.closest('.bookListItem');
		if (!bookListItemEl) return;
		const bookCheckbox = bookListItemEl.querySelector('.bookCheckbox');
		const pageCheckboxes = Array.from(bookListItemEl.querySelectorAll('.pageCheckbox'));
		if (!bookCheckbox) return;
		const allChecked = pageCheckboxes.length > 0 && pageCheckboxes.every((c) => c.checked);
		const anyChecked = pageCheckboxes.some((c) => c.checked);
		bookCheckbox.checked = allChecked;
		bookCheckbox.indeterminate = !allChecked && anyChecked;
	}

	// The checkbox states live in the DOM, so a page arriving or leaving fires no change
	// event: re-sync whenever the page set itself changes, or the book checkbox keeps
	// claiming a selection that is no longer there.
	$effect(() => {
		book.pages.map((p) => p.id).join();
		syncBookCheckbox();
	});

	$effect(() => {
		if (!listEl) return;
		const startBookId = book.id;
		let dragSet = { rows: [], indexes: [] };

		const sortable = Sortable.create(listEl, {
			group: { name: 'movePages' },
			animation: dragAnimation(),
			...dragBehaviour('input'),

			onStart(evt) {
				dragSet = collectDragSet(listEl, evt.item);
				markTravelling(dragSet.rows, evt.item);
			},

			onEnd(evt) {
				clearTravelling();
				const shelf = bs.bookshelfData.find((s) => s.id === bs.selectedShelfId);
				if (!shelf) return;

				const startBook = shelf.books.find((b) => b.id === startBookId);
				if (!startBook) return;

				const { rows: itemsDragged, indexes: itemIndexes } = dragSet;
				const travelling = itemsDragged.filter((item) => item !== evt.item);

				let pagesDragged = Array.from(itemIndexes, (idx) => startBook.pages[idx]);

				// Sortable moved only the grabbed row, so evt.newIndex is measured in a DOM that
				// still holds the travelling rows, while the arrays spliced below have them
				// removed already. Count the drop slot in that same space.
				const travellingSet = new Set(travelling);
				const dropSlot = Array.from(evt.to.children).filter((el) => !travellingSet.has(el)).indexOf(evt.item);
				let newIndex = dropSlot === -1 ? evt.newIndex : dropSlot;

				const dropAreaListEl = document.getElementById('dropAreaList');

				if (evt.from === evt.to) {
					// ── Same-book reorder ─────────────────────────────────────────
					startBook.pages = startBook.pages.filter((p) => !pagesDragged.includes(p));
					startBook.pages.splice(newIndex, 0, ...pagesDragged);
					bs.markDirty();
					animateArrival(listEl, travelling.map((item) => item.dataset.pageId));
				} else if (evt.to === bookListEl) {
					// ── Dropped onto bookList → create new book ───────────────────
					let newBookId;
					do { newBookId = generateUUID(); } while (shelf.books.some((b) => b.id === newBookId));

					const newBook = {
						id: newBookId,
						title: `Book ${shelf.books.length + 1}`,
						pages: $state.snapshot(pagesDragged),
						...newBookFlags()
					};

					pagesDragged.forEach((page) => {
						const item = bs.pagesToMove.find(
							(i) => i.shelfId === shelfId && i.bookId === startBookId && i.id === page.id
						);
						if (item) item.bookId = newBookId;
					});

					// A new book is never pinned, so it cannot land inside the pinned head
					shelf.books.splice(Math.max(newIndex, firstUnpinnedIndex(shelf.books)), 0, newBook);
					itemsDragged.forEach((item) => item.remove());
					startBook.pages = startBook.pages.filter((p) => !pagesDragged.includes(p));
					if (startBook.pages.length === 0) bs.removeBook(shelfId, startBookId);
					bs.markDirty();
					animateArrival(bookListEl, newBook.pages.map((p) => p.id));
				} else if (evt.to === dropAreaListEl) {
					// ── Dropped onto drop area ────────────────────────────────────
					const filteringIndexes = [];
					const cloned = $state.snapshot(pagesDragged);  // structuredClone() cannot clone state proxies
					cloned.forEach((page, pi) => {
						if (bs.pagesToMove.some((i) => i.shelfId === shelfId && i.bookId === startBookId && i.id === page.id)) {
							filteringIndexes.push(pi);
						} else {
							page.shelfId = shelfId;
							page.bookId = startBookId;
						}
					});
					const toAdd = cloned.filter((_, pi) => !filteringIndexes.includes(pi));

					// undo Sortable's DOM move — the pages stay in their book, the drop area only stages them
					itemsDragged.forEach((item, ii) => {
						if (item.parentNode !== evt.from) {
							evt.from.insertBefore(item, evt.from.children[itemIndexes[ii]] ?? null);
						}
					});

					bs.pagesToMove.splice(newIndex, 0, ...toAdd);
					bs.markDirty();
					animateArrival(dropAreaListEl, toAdd.map((p) => p.id));
				} else {
					// ── Dropped onto a different book ─────────────────────────────
					const endBookId = evt.to.closest('.bookListItem')?.dataset.bookId;
					const endBook = shelf.books.find((b) => b.id === endBookId);
					if (!endBook) return;

					const pagesIds = endBook.pages.map((p) => p.id);
					pagesDragged.forEach((page) => {
						const item = bs.pagesToMove.find(
							(i) => i.shelfId === shelfId && i.bookId === startBookId && i.id === page.id
						);
						while (pagesIds.includes(page.id)) page.id = generateUUID();
						if (item) { item.bookId = endBookId; item.id = page.id; }
					});

					endBook.pages.splice(newIndex, 0, ...pagesDragged);
					startBook.pages = startBook.pages.filter((p) => !pagesDragged.includes(p));
					if (startBook.pages.length === 0) bs.removeBook(shelfId, startBookId);

					// Drop the elements Sortable transplanted: both lists are redrawn from the data
					itemsDragged.forEach((item) => item.remove());
					bs.markDirty();
					bs.tidy();
					animateArrival(evt.to, pagesDragged.map((p) => p.id));
				}

			}
		});

		return () => sortable.destroy();
	});
</script>

<ul class="pageList" bind:this={listEl} style:display={book.collapsed ? 'none' : 'grid'}>
	{#each book.pages as page (page.id)}
		{@const visible = bs.matches(page)}
		<PageItem
			{page}
			bookId={book.id}
			{shelfId}
			{visible}
			onCheckboxChange={syncBookCheckbox}
		/>
	{/each}
</ul>
