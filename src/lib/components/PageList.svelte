<script>
	import Sortable from 'sortablejs/modular/sortable.complete.esm.js';  // 'complete' mounts the MultiDrag plugin
	import PageItem from './PageItem.svelte';
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { generateUUID } from '$lib/utils/uuid.js';

	/** @type {{ book: any, shelfId: string, bookListEl: HTMLElement | null }} */
	let { book, shelfId, bookListEl } = $props();

	let listEl = $state(null);

	function handlePageCheckboxChange() {
		const bookListItemEl = listEl?.closest('.bookListItem');
		if (!bookListItemEl) return;
		const bookCheckbox = bookListItemEl.querySelector('.bookCheckbox');
		const pageCheckboxes = Array.from(bookListItemEl.querySelectorAll('.pageCheckbox'));
		if (!bookCheckbox) return;
		const allChecked = pageCheckboxes.every((c) => c.checked);
		const anyChecked = pageCheckboxes.some((c) => c.checked);
		bookCheckbox.checked = allChecked;
		bookCheckbox.indeterminate = !allChecked && anyChecked;
	}

	$effect(() => {
		if (!listEl) return;
		const startBookId = book.id;

		const sortable = Sortable.create(listEl, {
			group: { name: 'movePages' },
			multiDrag: true,
			selectedClass: 'pageSelected',
			handle: '.movePageHandler',
			animation: 150,

			onEnd(evt) {
				const shelf = bs.bookshelfData.find((s) => s.id === bs.selectedShelfId);
				if (!shelf) return;

				const startBook = shelf.books.find((b) => b.id === startBookId);
				if (!startBook) return;

				const itemsDragged = evt.items.length > 0 ? evt.items : [evt.item];
				const itemIndexes =
					evt.oldIndicies.length > 0
						? evt.oldIndicies.map((i) => i.index)
						: [evt.oldIndex];

				let pagesDragged = Array.from(itemIndexes, (idx) => startBook.pages[idx]);
				let newIndex = evt.newIndicies.length > 0 ? evt.newIndicies[0].index : evt.newIndex;

				const dropAreaListEl = document.getElementById('dropAreaList');

				if (evt.from === evt.to) {
					// ── Same-book reorder ─────────────────────────────────────────
					startBook.pages = startBook.pages.filter((p) => !pagesDragged.includes(p));
					startBook.pages.splice(newIndex, 0, ...pagesDragged);
					bs.markDirty();
				} else if (evt.to === bookListEl) {
					// ── Dropped onto bookList → create new book ───────────────────
					let newBookId;
					do { newBookId = generateUUID(); } while (shelf.books.some((b) => b.id === newBookId));

					const newBook = {
						id: newBookId,
						title: `Book ${shelf.books.length + 1}`,
						pages: $state.snapshot(pagesDragged),
						collapsed: false,
						locked: false
					};

					pagesDragged.forEach((page) => {
						const item = bs.pagesToMove.find(
							(i) => i.shelfId === shelfId && i.bookId === startBookId && i.id === page.id
						);
						if (item) item.bookId = newBookId;
					});

					shelf.books.splice(newIndex, 0, newBook);
					itemsDragged.forEach((item) => bookListEl?.removeChild(item));
					startBook.pages = startBook.pages.filter((p) => !pagesDragged.includes(p));
					if (startBook.pages.length === 0) bs.removeBook(shelfId, startBookId);
					bs.markDirty();
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

					// undo Sortable's DOM move — keep items in source list
					itemsDragged.forEach((item, ii) => {
						item.classList.remove('pageSelected');
						if (dropAreaListEl?.contains(item)) dropAreaListEl.removeChild(item);
						const origPos = itemIndexes[ii];
						evt.from.insertBefore(item, evt.from.children[origPos] ?? null);
					});

					bs.pagesToMove.splice(newIndex, 0, ...toAdd);
					bs.markDirty();
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
				}

				if (evt.from !== evt.to || newIndex !== itemIndexes[0]) bookListEl?.click();
			}
		});

		return () => sortable.destroy();
	});
</script>

<ul class="pageList" bind:this={listEl} style:display={book.collapsed ? 'none' : 'grid'}>
	{#each book.pages as page (page.id)}
		{@const visible = page.title.toLowerCase().includes(bs.searchQuery.toLowerCase())}
		<PageItem
			{page}
			bookId={book.id}
			{shelfId}
			{visible}
			onCheckboxChange={handlePageCheckboxChange}
		/>
	{/each}
</ul>
