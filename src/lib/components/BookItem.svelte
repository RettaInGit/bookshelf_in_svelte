<script>
	import PageList from './PageList.svelte';
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { settings, confirmAction } from '$lib/state/settings.svelte.js';
	import { openTab } from '$lib/chrome/storage.js';
	import { focusAtEnd } from '$lib/utils/editable.js';

	/** @type {{ book: any, shelfId: string, bookListEl: HTMLElement | null }} */
	let { book, shelfId, bookListEl } = $props();

	let editingTitle = $state(false);
	let titleEl = $state(null);

	const hasVisiblePage = $derived(
		book.pages.length === 0 || book.pages.some((p) => bs.matches(p))
	);

	$effect(() => {
		if (!titleEl) return;
		if (editingTitle) {
			focusAtEnd(titleEl);
		} else {
			if (titleEl.childElementCount > 0) titleEl.textContent = book.title;  // a paste can leave styled markup behind
			titleEl.scrollLeft = 0;
		}
	});

	function startEditTitle(e) {
		e.stopPropagation();
		editingTitle = true;
	}

	function saveTitle(e) {
		e?.stopPropagation();
		const newTitle = titleEl?.textContent?.trim();
		if (!newTitle) {
			alert('Book title cannot be empty.');
			titleEl?.focus();
			return;
		}
		bs.renameBook(shelfId, book.id, newTitle);
		editingTitle = false;
	}

	// Blur must not validate: alert() takes focus off the page, which would re-enter here
	function handleTitleBlur() {
		if (titleEl?.textContent?.trim()) saveTitle();
	}

	function handleTitleKeypress(e) {
		if (e.key === 'Enter') { e.preventDefault(); saveTitle(e); }
	}

	function handleTitleClick(e) {
		if (editingTitle) e.stopPropagation();
	}

	function handleHeaderClick() {
		if (editingTitle) return;
		bs.toggleBookCollapsed(shelfId, book.id);
	}

	function handleLockClick(e) {
		e.stopPropagation();
		bs.toggleBookLocked(shelfId, book.id);
	}

	let bookCheckboxEl = $state(null);

	function handleBookCheckboxClick(e) {
		e.stopPropagation();
		const bookListItem = bookCheckboxEl?.closest('.bookListItem');
		if (!bookListItem) return;
		bookListItem.querySelectorAll('.pageCheckbox').forEach((cb) => {
			cb.checked = bookCheckboxEl.checked;
		});
	}

	function restoreSelected(e) {
		e.stopPropagation();
		const shelf = bs.bookshelfData.find((s) => s.id === bs.selectedShelfId);
		const b = shelf?.books.find((b) => b.id === book.id);
		if (!b) return;

		const bookListItem = bookCheckboxEl?.closest('.bookListItem');
		if (!bookListItem) return;
		const pageCheckboxes = Array.from(bookListItem.querySelectorAll('.pageCheckbox'));
		const selectedIndexes = pageCheckboxes.map((cb, i) => cb.checked ? i : -1).filter((i) => i !== -1);

		if (selectedIndexes.length === 0) { alert('Please select at least one page to restore.'); return; }
		if (!confirmAction(`Are you sure you want to restore the selected page${selectedIndexes.length !== 1 ? 's' : ''}?`)) return;

		const pagesToRestore = selectedIndexes.map((i) => b.pages[i]);
		pagesToRestore.forEach((p) => openTab(p.url));

		if (!b.locked && !settings.keepPagesOnRestore) {
			if (pagesToRestore.length === b.pages.length) {
				for (let i = bs.pagesToMove.length - 1; i >= 0; i--) {
					const item = bs.pagesToMove[i];
					if (item.shelfId === shelfId && item.bookId === book.id && pagesToRestore.some((p) => p.id === item.id)) {
						bs.pagesToMove.splice(i, 1);
					}
				}
				bs.removeBook(shelfId, book.id);
			} else {
				selectedIndexes.sort((a, b) => b - a).forEach((idx) => {
					const pageId = b.pages[idx].id;
					const moveIdx = bs.pagesToMove.findIndex(
						(item) => item.shelfId === shelfId && item.bookId === book.id && item.id === pageId
					);
					if (moveIdx !== -1) bs.pagesToMove.splice(moveIdx, 1);
					b.pages.splice(idx, 1);
				});
				if (bookCheckboxEl) { bookCheckboxEl.checked = false; bookCheckboxEl.indeterminate = false; }
				bs.markDirty();
			}
		}
	}

	function removeSelected(e) {
		e.stopPropagation();
		const shelf = bs.bookshelfData.find((s) => s.id === bs.selectedShelfId);
		const b = shelf?.books.find((b) => b.id === book.id);
		if (!b) return;

		const bookListItem = bookCheckboxEl?.closest('.bookListItem');
		if (!bookListItem) return;
		const pageCheckboxes = Array.from(bookListItem.querySelectorAll('.pageCheckbox'));
		const selectedIndexes = pageCheckboxes.map((cb, i) => cb.checked ? i : -1).filter((i) => i !== -1);

		if (selectedIndexes.length === 0) { alert('Please select at least one page to remove.'); return; }
		if (!confirmAction(`Are you sure you want to remove the selected page${selectedIndexes.length !== 1 ? 's' : ''}?`)) return;

		selectedIndexes.sort((a, bb) => bb - a).forEach((idx) => {
			const pageId = b.pages[idx].id;
			const moveIdx = bs.pagesToMove.findIndex(
				(item) => item.shelfId === shelfId && item.bookId === book.id && item.id === pageId
			);
			if (moveIdx !== -1) bs.pagesToMove.splice(moveIdx, 1);
			b.pages.splice(idx, 1);
		});

		if (b.pages.length === 0) {
			bs.removeBook(shelfId, book.id);
		} else {
			if (bookCheckboxEl) { bookCheckboxEl.checked = false; bookCheckboxEl.indeterminate = false; }
			bs.markDirty();
		}
	}
</script>

<div
	class="bookListItem"
	data-book-id={book.id}
	style:display={hasVisiblePage ? 'grid' : 'none'}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="bookHeader" role="button" tabindex="0"
		onclick={handleHeaderClick}
		onkeydown={(e) => e.key === 'Enter' && handleHeaderClick()}
	>
		<!-- Header Top -->
		<div class="bookHeaderTop" style:margin-bottom={book.collapsed ? '0' : '5px'}>
			<button
				class="editBookTitleButton"
				title={editingTitle ? 'Save book title' : 'Edit book title'}
				onmousedown={(e) => e.preventDefault()}
				onclick={editingTitle ? saveTitle : startEditTitle}
			>
				{#if editingTitle}
					<svg viewBox="0 0 24 24" width="23px" height="23px" fill="currentColor">
						<path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 48 48" width="23px" height="23px" fill="currentColor">
						<path d="M38.657 18.536l2.44-2.44c2.534-2.534 2.534-6.658 0-9.193-1.227-1.226-2.858-1.9-4.597-1.9s-3.371.675-4.597 1.901l-2.439 2.439L38.657 18.536zM27.343 11.464L9.274 29.533c-.385.385-.678.86-.848 1.375L5.076 41.029c-.179.538-.038 1.131.363 1.532C5.726 42.847 6.108 43 6.5 43c.158 0 .317-.025.472-.076l10.118-3.351c.517-.17.993-.463 1.378-.849l18.068-18.068L27.343 11.464z"/>
					</svg>
				{/if}
			</button>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<h2
				class="bookTitle"
				bind:this={titleEl}
				contenteditable={editingTitle ? 'plaintext-only' : 'false'}
				onblur={editingTitle ? handleTitleBlur : undefined}
				onkeypress={handleTitleKeypress}
				onclick={handleTitleClick}
			>{book.title}</h2>

			<h2 class="pagesCount">{book.pages.length} Page{book.pages.length !== 1 ? 's' : ''}</h2>
		</div>

		<!-- Header Bottom -->
		<div class="bookHeaderBottom" style:display={book.collapsed ? 'none' : 'flex'}>
			<input
				type="checkbox"
				class="bookCheckbox"
				name="bookCheckbox"
				title="Select/Deselect all pages in this book"
				bind:this={bookCheckboxEl}
				onclick={handleBookCheckboxClick}
			/>
			<button class="restoreSelectedPagesButton" onclick={restoreSelected}>Restore Selected Pages</button>
			<button class="removeSelectedPagesButton" onclick={removeSelected}>Remove Selected Pages</button>
			<div class="bookHeaderBottomDivider"></div>
			<button class="bookLock" title={book.locked ? 'Unlock the book' : 'Lock the book'} onclick={handleLockClick}>
				{#if book.locked}
					<svg width="22px" height="28px" viewBox="393.836 323.775 22 27.999" fill="currentColor" style="paint-order:fill;fill-rule:evenodd">
						<path d="M411.836 335.774v-4.706c0-3.833-2.953-7.175-6.785-7.29a7 7 0 0 0-7.215 6.996v5h-1a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3v-10a3 3 0 0 0-3-3zm-3 0h-8v-5c0-3.079 3.334-5.004 6-3.464 1.238.714 2 2.035 2 3.464zm-2 6c.001-1.54-1.665-2.503-2.998-1.734a2 2 0 0 0-.132 3.383l-.631 3.155a1 1 0 0 0 .981 1.196h1.56a1 1 0 0 0 .981-1.196l-.631-3.155c.525-.361.87-.964.87-1.649"/>
					</svg>
				{:else}
					<svg width="22px" height="28px" viewBox="362.143 323.843 22 27.999" fill="currentColor" style="paint-order:fill;fill-rule:evenodd">
						<path d="M380.143 335.842v-4.706c0-3.833-2.953-7.175-6.785-7.29a7 7 0 0 0-7.215 6.996v5h-1a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3v-10a3 3 0 0 0-3-3zm-3 0h-8v-5c0-3.079 3.334-5.004 6-3.464 1.238.714 2 2.035 2 3.464zm4 15h-16a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2m-6-9c.001-1.54-1.665-2.503-2.998-1.734a2 2 0 0 0-.132 3.383l-.631 3.155a1 1 0 0 0 .981 1.196h1.56a1 1 0 0 0 .981-1.196l-.631-3.155c.525-.361.87-.964.87-1.649"/>
					</svg>
				{/if}
			</button>
		</div>
	</div>

	{#if book.pages.length === 0 && !book.collapsed}
		<p class="emptyBookMessage">This book is empty. Drop pages here or remove it.</p>
	{/if}

	<PageList {book} {shelfId} {bookListEl} />
</div>
