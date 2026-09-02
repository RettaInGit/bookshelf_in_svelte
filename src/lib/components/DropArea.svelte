<script>
	import Sortable from 'sortablejs/modular/sortable.complete.esm.js';  // 'complete' mounts the MultiDrag plugin
	import PageItem from './PageItem.svelte';
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { generateUUID } from '$lib/utils/uuid.js';

	let listEl = $state(null);
	let dropAreaCheckboxEl = $state(null);

	function updateDropAreaCheckbox() {
		if (!dropAreaCheckboxEl) return;
		const checkboxes = Array.from(listEl?.querySelectorAll('.pageCheckbox') ?? []);
		const allChecked = checkboxes.length > 0 && checkboxes.every((c) => c.checked);
		const anyChecked = checkboxes.some((c) => c.checked);
		dropAreaCheckboxEl.checked = allChecked;
		dropAreaCheckboxEl.indeterminate = !allChecked && anyChecked;
	}

	function handleDropAreaCheckboxChange() {
		listEl?.querySelectorAll('.pageCheckbox').forEach((cb) => {
			cb.checked = dropAreaCheckboxEl?.checked ?? false;
		});
	}

	function removeSelectedPages() {
		const checkboxes = Array.from(listEl?.querySelectorAll('.pageCheckbox') ?? []);
		const indexes = checkboxes.map((cb, i) => cb.checked ? i : -1).filter((i) => i !== -1);
		if (indexes.length === 0) { alert('Please select at least one page to remove.'); return; }
		if (!confirm(`Are you sure you want to remove the selected page${indexes.length !== 1 ? 's' : ''}?`)) return;
		indexes.sort((a, b) => b - a).forEach((idx) => bs.pagesToMove.splice(idx, 1));
		if (dropAreaCheckboxEl) { dropAreaCheckboxEl.checked = false; dropAreaCheckboxEl.indeterminate = false; }
	}

	$effect(() => {
		if (!listEl) return;
		const bookListEl = document.getElementById('bookList');

		const sortable = Sortable.create(listEl, {
			group: { name: 'movePages' },
			multiDrag: true,
			selectedClass: 'pageSelected',
			handle: '.movePageHandler',
			animation: 150,

			onEnd(evt) {
				const shelf = bs.bookshelfData.find((s) => s.id === bs.selectedShelfId);
				if (!shelf) return;

				const itemsDragged = evt.items.length > 0 ? evt.items : [evt.item];
				const itemIndexes =
					evt.oldIndicies.length > 0 ? evt.oldIndicies.map((i) => i.index) : [evt.oldIndex];

				let pagesDragged = Array.from(itemIndexes, (idx) => bs.pagesToMove[idx]);
				const draggedSet = new Set(pagesDragged);
				const remaining = bs.pagesToMove.filter((p) => !draggedSet.has(p));
				bs.pagesToMove.length = 0;
				bs.pagesToMove.push(...remaining);

				let newIndex = evt.newIndicies.length > 0 ? evt.newIndicies[0].index : evt.newIndex;

				if (evt.from === evt.to) {
					// ── Reorder within drop area ──────────────────────────────────
					bs.pagesToMove.splice(newIndex, 0, ...pagesDragged);
					bs.markDirty();
				} else if (evt.to === bookListEl) {
					// ── Drop area → bookList (create new book) ────────────────────
					let newBookId;
					do { newBookId = generateUUID(); } while (shelf.books.some((b) => b.id === newBookId));

					const newBook = {
						id: newBookId,
						title: `Book ${shelf.books.length + 1}`,
						pages: $state.snapshot(pagesDragged.map(({ bookId: _b, shelfId: _s, ...rest }) => rest)),
						collapsed: false,
						locked: false
					};

					shelf.books.splice(newIndex, 0, newBook);
					itemsDragged.forEach((item) => bookListEl?.removeChild(item));

					pagesDragged.forEach((page) => {
						const startShelf = bs.bookshelfData.find((s) => s.id === page.shelfId);
						const startBook = startShelf?.books.find((b) => b.id === page.bookId);
						if (!startBook) return;
						startBook.pages = startBook.pages.filter((p) => p.id !== page.id);
						if (startBook.pages.length === 0) {
							startShelf.books = startShelf.books.filter((b) => b.id !== startBook.id);
						}
					});
					bs.markDirty();
				} else {
					// ── Drop area → existing book ─────────────────────────────────
					const endBookId = evt.to.closest('.bookListItem')?.dataset.bookId;
					const endBook = shelf.books.find((b) => b.id === endBookId);
					if (!endBook) return;

					const pagesIds = endBook.pages.map((p) => p.id);
					pagesDragged.forEach((page) => {
						const startShelf = bs.bookshelfData.find((s) => s.id === page.shelfId);
						const startBook = startShelf?.books.find((b) => b.id === page.bookId);
						if (!startBook) return;

						const pageIdx = startBook.pages.findIndex((p) => p.id === page.id);
						if (pageIdx !== -1) startBook.pages.splice(pageIdx, 1);

						if (page.bookId !== endBookId) {
							if (startBook.pages.length === 0) {
								startShelf.books = startShelf.books.filter((b) => b.id !== startBook.id);
							}
							while (pagesIds.includes(page.id)) page.id = generateUUID();
						} else {
							if (newIndex > pageIdx) newIndex--;
						}
					});

					const cleanPages = $state.snapshot(pagesDragged.map(({ bookId: _b, shelfId: _s, ...rest }) => rest));
					endBook.pages.splice(newIndex, 0, ...cleanPages);

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

<div id="dropArea" class:hidden={bs.dropAreaHidden} class:active={bs.dropAreaOpen}>
	<div id="dropAreaHeader">
		<input
			type="checkbox"
			id="dropAreaCheckbox"
			name="dropAreaCheckbox"
			title="Select/Deselect all pages in this area"
			bind:this={dropAreaCheckboxEl}
			onchange={handleDropAreaCheckboxChange}
		/>
		<button id="dropAreaRemoveSelectedPagesButton" class="removeSelectedPagesButton" onclick={removeSelectedPages}>
			Remove Selected Pages
		</button>
	</div>
	<ul id="dropAreaList" bind:this={listEl}>
		{#each bs.pagesToMove as page (page.id + page.bookId)}
			<PageItem
				{page}
				bookId={page.bookId}
				shelfId={page.shelfId}
				inDropArea={true}
				onCheckboxChange={updateDropAreaCheckbox}
			/>
		{/each}
	</ul>
</div>
