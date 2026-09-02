<script>
	import { bs } from '$lib/state/bookshelf.svelte.js';
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
		if (!book || book.locked) return;

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
	<!-- svelte-ignore a11y_missing_attribute -->
	<img src={faviconUrl(page.url)} style="margin-right: 10px;" alt="" />
	<a
		class="pageLink"
		href={page.url}
		target="_blank"
		title={page.url}
		onclick={handleLinkClick}
	>
		{page.title}
	</a>
	<button class="movePageHandler" title="Move this page, click to multi-select">
		<svg viewBox="0 -0.125 0.8 0.8" width="20px" height="20px">
			<path d="M.75.45a.05.05 0 0 1 0 .1h-.7a.05.05 0 0 1 0-.1zm0-.225a.05.05 0 0 1 0 .1h-.7a.05.05 0 0 1 0-.1zM.75 0a.05.05 0 0 1 0 .1h-.7a.05.05 0 0 1 0-.1z" />
		</svg>
	</button>
</li>
