<script>
	import Sortable from 'sortablejs/modular/sortable.esm.js';  // mounts AutoScroll, not MultiDrag  ('complete' mounts the MultiDrag plugin)
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { focusAtEnd } from '$lib/utils/editable.js';
	import { dragBehaviour, restoreRow } from '$lib/utils/dragSelection.js';
	import { settings, confirmAction, dragAnimation } from '$lib/state/settings.svelte.js';

	let shelfListEl = $state(null);
	let editingShelfId = $state(null);
	let titleEls = {};

	function handleSelectShelf(shelfId) {
		if (editingShelfId === shelfId) return;
		bs.selectShelf(shelfId);
		if (settings.closeShelvesOnSelect) bs.shelvesOpen = false;
	}

	function startEditShelf(shelfId, e) {
		e.stopPropagation();
		editingShelfId = shelfId;
	}

	function saveShelfTitle(shelfId, e) {
		e?.stopPropagation();
		const el = titleEls[shelfId];
		const newTitle = el?.textContent?.trim();
		if (!newTitle) { alert('Shelf title cannot be empty.'); el?.focus(); return; }
		bs.renameShelf(shelfId, newTitle);
		editingShelfId = null;
	}

	// Blur must not validate: alert() takes focus off the page, which would re-enter here
	function handleShelfTitleBlur(shelfId) {
		if (titleEls[shelfId]?.textContent?.trim()) saveShelfTitle(shelfId);
	}

	function handleShelfTitleKeypress(shelfId, e) {
		if (e.key === 'Enter') { e.preventDefault(); saveShelfTitle(shelfId, e); }
	}

	function handleRemoveShelf(shelfId, e) {
		e.stopPropagation();
		if (shelfId === bs.selectedShelfId) {
			if (!confirmAction('Are you sure you want to reset this shelf?')) return;
		} else {
			if (!confirmAction('Are you sure you want to remove this shelf?')) return;
		}
		bs.removeShelf(shelfId);
	}

	let editedShelfEl = null;

	$effect(() => {
		if (editingShelfId) {
			editedShelfEl = titleEls[editingShelfId];
			focusAtEnd(editedShelfEl);
		} else if (editedShelfEl) {
			// the trimmed text is what was just saved, so it also drops markup a paste left behind
			if (editedShelfEl.childElementCount > 0) editedShelfEl.textContent = editedShelfEl.textContent.trim();
			editedShelfEl.scrollLeft = 0;
			editedShelfEl = null;
		}
	});

	$effect(() => {
		if (!shelfListEl) return;
		const sortable = Sortable.create(shelfListEl, {
			group: { name: 'moveShelf' },
			animation: dragAnimation(),
			...dragBehaviour('button'),
			onEnd(evt) {
				if (evt.oldIndex >= bs.bookshelfData.length || evt.newIndex >= bs.bookshelfData.length) return;
				// Under a sort the drop does not get to choose the order, so Sortable's move is
				// undone and sortAll() below is what redraws the list.
				if (settings.sortShelves !== 'manual') {
					restoreRow(shelfListEl, evt.item, evt.oldIndex);
				} else if (evt.newIndex !== evt.oldIndex) {
					bs.bookshelfData.splice(evt.newIndex, 0, bs.bookshelfData.splice(evt.oldIndex, 1)[0]);
				}
				bs.markDirty();
				bs.sortAll();
			}
		});
		return () => sortable.destroy();
	});
</script>

<div id="bookShelves" class:close={!bs.shelvesOpen}>
	<ul id="shelfList" bind:this={shelfListEl} style="z-index: 50;">
		{#each bs.bookshelfData as shelf (shelf.id)}
			<li class="shelfListItem" data-shelf-id={shelf.id}>
				<button
					class="editShelfTitleButton"
					title={editingShelfId === shelf.id ? 'Save shelf title' : 'Edit shelf title'}
					onmousedown={(e) => e.preventDefault()}
					onclick={(e) => editingShelfId === shelf.id ? saveShelfTitle(shelf.id, e) : startEditShelf(shelf.id, e)}
				>
					{#if editingShelfId === shelf.id}
						<svg viewBox="0 0 24 24" width="20px" height="20px" fill="currentColor">
							<path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/>
						</svg>
					{:else}
						<svg viewBox="0 0 48 48" width="20px" height="20px" fill="currentColor">
							<path d="M38.657 18.536l2.44-2.44c2.534-2.534 2.534-6.658 0-9.193-1.227-1.226-2.858-1.9-4.597-1.9s-3.371.675-4.597 1.901l-2.439 2.439L38.657 18.536zM27.343 11.464L9.274 29.533c-.385.385-.678.86-.848 1.375L5.076 41.029c-.179.538-.038 1.131.363 1.532C5.726 42.847 6.108 43 6.5 43c.158 0 .317-.025.472-.076l10.118-3.351c.517-.17.993-.463 1.378-.849l18.068-18.068L27.343 11.464z"/>
						</svg>
					{/if}
				</button>

				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<h2
					class="shelfTitle"
					contenteditable={editingShelfId === shelf.id ? 'plaintext-only' : 'false'}
					bind:this={titleEls[shelf.id]}
					onclick={() => handleSelectShelf(shelf.id)}
					onblur={editingShelfId === shelf.id ? () => handleShelfTitleBlur(shelf.id) : undefined}
					onkeypress={(e) => handleShelfTitleKeypress(shelf.id, e)}
				>{shelf.title}</h2>

				<button class="removeShelfButton" title="Remove this shelf" onclick={(e) => handleRemoveShelf(shelf.id, e)}>
					<svg viewBox="0 0 30 30" width="20px" height="20px" fill="currentColor">
						<path d="M 7 4 C 6.744125 4 6.4879687 4.0974687 6.2929688 4.2929688 L 4.2929688 6.2929688 C 3.9019687 6.6839688 3.9019687 7.3170313 4.2929688 7.7070312 L 11.585938 15 L 4.2929688 22.292969 C 3.9019687 22.683969 3.9019687 23.317031 4.2929688 23.707031 L 6.2929688 25.707031 C 6.6839688 26.098031 7.3170313 26.098031 7.7070312 25.707031 L 15 18.414062 L 22.292969 25.707031 C 22.682969 26.098031 23.317031 26.098031 23.707031 25.707031 L 25.707031 23.707031 C 26.098031 23.316031 26.098031 22.682969 25.707031 22.292969 L 18.414062 15 L 25.707031 7.7070312 C 26.098031 7.3170312 26.098031 6.6829688 25.707031 6.2929688 L 23.707031 4.2929688 C 23.316031 3.9019687 22.682969 3.9019687 22.292969 4.2929688 L 15 11.585938 L 7.7070312 4.2929688 C 7.5115312 4.0974687 7.255875 4 7 4 z"/>
					</svg>
				</button>
			</li>
		{/each}
	</ul>

	<button id="addNewShelfButton" onclick={() => bs.addShelf()}>
		<svg viewBox="0 0 48 48" width="20px" height="20px" fill="currentColor" style="margin-right: 5px;">
			<path d="M 24 4 C 12.972066 4 4 12.972074 4 24 C 4 35.027926 12.972066 44 24 44 C 35.027934 44 44 35.027926 44 24 C 44 12.972074 35.027934 4 24 4 z M 24 7 C 33.406615 7 41 14.593391 41 24 C 41 33.406609 33.406615 41 24 41 C 14.593385 41 7 33.406609 7 24 C 7 14.593391 14.593385 7 24 7 z M 23.976562 13.978516 A 1.50015 1.50015 0 0 0 22.5 15.5 L 22.5 22.5 L 15.5 22.5 A 1.50015 1.50015 0 1 0 15.5 25.5 L 22.5 25.5 L 22.5 32.5 A 1.50015 1.50015 0 1 0 25.5 32.5 L 25.5 25.5 L 32.5 25.5 A 1.50015 1.50015 0 1 0 32.5 22.5 L 25.5 22.5 L 25.5 15.5 A 1.50015 1.50015 0 0 0 23.976562 13.978516 z"/>
		</svg>
		Add new shelf
	</button>
</div>
