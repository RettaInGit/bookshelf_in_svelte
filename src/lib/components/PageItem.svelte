<script>
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { settings } from '$lib/state/settings.svelte.js';
	import { openTab } from '$lib/chrome/storage.js';

	/** @type {{ page: any, bookId: string, shelfId: string, inDropArea?: boolean, visible?: boolean, onCheckboxChange?: () => void }} */
	let { page, bookId, shelfId, inDropArea = false, visible = true, onCheckboxChange } = $props();

	const isMoved = $derived(
		bs.pagesToMove.some((item) => item.shelfId === shelfId && item.bookId === bookId && item.id === page.id)
	);

	function faviconUrl(url) {
		let base = 'https://s2.googleusercontent.com/s2/favicons?domain';
		if (url.startsWith('http')) base += '_url';
		return `${base}=${url}`;
	}

	function handleLinkClick(e) {
		if (inDropArea) return;
		e.preventDefault();
		openTab(page.url);

		const shelf = bs.bookshelfData.find((s) => s.id === shelfId);
		const book = shelf?.books.find((b) => b.id === bookId);
		if (!book || book.locked || settings.keepPagesOnRestore) return;

		// remove from drop area staging
		const moveIdx = bs.pagesToMove.findIndex(
			(item) => item.shelfId === shelfId && item.bookId === bookId && item.id === page.id
		);
		if (moveIdx !== -1) bs.pagesToMove.splice(moveIdx, 1);

		if (book.pages.length === 1) {
			bs.removeBook(shelfId, bookId);
		} else {
			const pageIdx = book.pages.findIndex((p) => p.id === page.id);
			if (pageIdx !== -1) book.pages.splice(pageIdx, 1);
			bs.markDirty();
		}
	}
</script>

<li
	class="pageListItem"
	class:pageMoved={!inDropArea && isMoved}
	data-page-id={page.id}
	style:display={visible ? 'flex' : 'none'}
>
	<input
		type="checkbox"
		class="pageCheckbox"
		name="pageCheckbox"
		onchange={onCheckboxChange}
	/>
	{#if settings.remoteFavicons}
		<!-- svelte-ignore a11y_missing_attribute -->
		<img src={faviconUrl(page.url)} style="margin-right: 10px;" alt="" />
	{:else}
		<!-- Same 16px slot, so turning the icons off does not reflow the row -->
		<svg class="pageIconPlaceholder" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3a15 15 0 0 0-1-5 8 8 0 0 1 4 5zM12 4a13 13 0 0 1 1.2 7h-2.4A13 13 0 0 1 12 4zM4.1 11a8 8 0 0 1 4-5 15 15 0 0 0-1 5zm0 2h3a15 15 0 0 0 1 5 8 8 0 0 1-4-5zm7.9 7a13 13 0 0 1-1.2-7h2.4A13 13 0 0 1 12 20zm2.9-2a15 15 0 0 0 1-5h3a8 8 0 0 1-4 5z"/>
		</svg>
	{/if}
	<!-- With the address off the anchor holds one inline span, so it clips exactly as before -->
	<a
		class="pageLink"
		class:withUrl={settings.showPageUrls}
		href={page.url}
		target="_blank"
		title={page.url}
		onclick={handleLinkClick}
	><span class="pageLinkTitle">{page.title}</span>{#if settings.showPageUrls}<span class="pageLinkUrl">{page.url}</span>{/if}</a>
</li>
