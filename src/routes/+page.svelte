<script>
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import BookList from '$lib/components/BookList.svelte';
	import DropArea from '$lib/components/DropArea.svelte';
	import ImportExportPopup from '$lib/components/ImportExportPopup.svelte';
	import SettingsPage from '$lib/components/SettingsPage.svelte';
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { loadFromStorage, saveToStorage, onExternalUpdate } from '$lib/chrome/storage.js';
	import { generateUUID } from '$lib/utils/uuid.js';

	async function loadData() {
		bs.loadingBookshelfData = true;
		const data = await loadFromStorage();

		bs.bookshelfData.length = 0;
		if (!data.bookshelfData || data.bookshelfData.length === 0) {
			const newId = generateUUID();
			bs.bookshelfData.push({ id: newId, title: 'Shelf 1', books: [] });
			bs.selectedShelfId = newId;
		} else {
			bs.bookshelfData.push(...data.bookshelfData);
			bs.selectedShelfId = data.selectedShelfId || bs.bookshelfData[0].id;

			// The saved shelf may not exist anymore
			if (!bs.currentShelf) {
				bs.selectedShelfId = bs.bookshelfData[0].id;
				bs.markDirty();
			}
		}

		bs.theme = data.themeSelected ?? 'light';
		bs.loadingBookshelfData = false;
	}

	function toggleDropArea() {
		if (bs.dropAreaOpen) {
			// Close the drop area
			bs.dropAreaOpen = false;
			setTimeout(() => { bs.dropAreaHidden = true; }, 300);  // Wait for the transition to finish
		} else {
			// Open the drop area
			bs.dropAreaHidden = false;
			setTimeout(() => { bs.dropAreaOpen = true; }, 10);  // Small delay to ensure the removal of 'hidden' is processed
		}
	}

	function closeOverlays() {
		bs.importExportOpen = false;
		bs.settingsOpen = false;
	}

	onMount(() => {
		loadData();

		// Get new bookshelf data when background.js saves some pages
		onExternalUpdate(loadData);

		// Save the bookshelf data only when it has changed
		const intervalId = setInterval(() => {
			if (bs.bookshelfDataUpdated && !bs.loadingBookshelfData) {
				bs.bookshelfDataUpdated = false;
				saveToStorage({
					selectedShelfId: bs.selectedShelfId,
					bookshelfData: $state.snapshot(bs.bookshelfData)
				});
			}
		}, 1000);

		function handleKeydown(event) {
			if (event.key === 'Escape') closeOverlays();
		}
		document.addEventListener('keydown', handleKeydown);

		return () => {
			clearInterval(intervalId);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<svelte:head>
	<title>Bookshelf</title>
</svelte:head>

<Header />

<div id="mainBody">
	<div id="mainPage" style:width={bs.dropAreaOpen ? '50%' : '100%'}>
		<BookList />
	</div>
	<div id="dropAreaSpace" style:width={bs.dropAreaOpen ? '50%' : '0%'}></div>
</div>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id="viewOverlay"
	class:open={bs.importExportOpen || bs.settingsOpen}
	style="z-index: 100"
	onclick={closeOverlays}
	onkeydown={(e) => e.key === 'Enter' && closeOverlays()}
></div>

<ImportExportPopup />
<SettingsPage />
<DropArea />

<button
	id="dropAreaButton"
	title="Place pages here to move them more easily between books and shelves"
	style="z-index: 0"
	onclick={toggleDropArea}
>
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="400.387 -96.923 569.641 612.001" width="100" height="107.4">
		<path d="M737.076 12.895h-25.75v54.711c0 5.691-4.613 10.305-10.304 10.305h-30.914c-5.691 0-10.305-4.614-10.305-10.305V12.895h-25.748c-7.932 0-12.89-8.587-8.924-15.457l51.506-89.208c3.966-6.87 13.88-6.87 17.847-.001l51.515 89.208c3.967 6.87-.99 15.458-8.923 15.458" style="transform-origin:685.565px -9.50581px" transform="rotate(180 0 0)"/>
		<path d="m961.099 300.431-44.439-3.545v169.847l-217.008 46.665c-10.142 2.227-20.694 2.227-30.835.083L460.548 469.7c-3.71-.824-6.432-4.04-6.514-7.832l-3.627-138.847c-.082-4.37 3.215-8.08 7.503-8.492l176.937-15.5c3.051-.247 5.689-2.227 6.844-5.112l42.544-103.227v283.216l192.271-36.525V293.588l-113.264-7.183a24.74 24.74 0 0 1-20.994-14.541l-58.673-130.479-58.952 132.826a8.38 8.38 0 0 1-6.678 4.864L409.429 300.1c-6.349.66-10.966-5.854-8.245-11.707l55.489-118.645c1.154-2.391 3.38-4.123 5.936-4.617l213.875-39.246 7.091-1.319 6.924 1.236 218.492 39.329c2.639.495 4.864 2.226 6.019 4.699l54.252 118.975c2.639 5.772-1.896 12.121-8.163 11.626"/>
	</svg>
</button>
