<script>
	import ShelfDropdown from './ShelfDropdown.svelte';
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { settings } from '$lib/state/settings.svelte.js';

	const arrowDeg = $derived(bs.shelvesOpen ? '180deg' : '0deg');

	function toggleShelves() {
		bs.shelvesOpen = !bs.shelvesOpen;
	}

	$effect(() => {
		const dark = bs.theme === 'dark';
		document.documentElement.classList.toggle('darkTheme', dark);
		document.body.classList.toggle('darkTheme', dark);
	});

	$effect(() => {
		document.documentElement.classList.toggle('reducedMotion', settings.reduceAnimations);
	});

	// Watched even when the preference is not 'system', so switching to it paints at once
	$effect(() => {
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		const sync = () => { bs.systemDark = query.matches; };
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	let searchTimeout;
	function handleSearch(e) {
		clearTimeout(searchTimeout);
		const value = e.target.value;
		searchTimeout = setTimeout(() => { bs.searchQuery = value.trim().toLowerCase(); }, 250);
	}
</script>

<header id="mainHeader" style="z-index: 50;">
	<div id="mainHeaderLeft">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
		<h2 id="selectedShelfTitle"
			onclick={toggleShelves}
			onkeydown={(e) => e.key === 'Enter' && toggleShelves()}
			role="button"
			tabindex="0"
		>
			<svg id="arrowIcon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 10 10"
				style:transform="rotate({arrowDeg})">
				<path d="M3 1 L7 5 L3 9" />
			</svg>
			<span id="selectedShelfTitleText">{bs.currentShelf?.title ?? 'Bookshelf'}</span>
		</h2>
		<ShelfDropdown />
	</div>

	<div id="mainHeaderCenter">
		<input type="text" id="searchBar" placeholder="Search pages..." oninput={handleSearch} />
	</div>

	<div id="mainHeaderRight">
		<button id="importExportButton" title="Import/export" onclick={() => { bs.importExportOpen = !bs.importExportOpen; }}>
			<svg width="36" height="36" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path fill-rule="evenodd" fill="currentColor" d="M7.5 15.5 L10.5 11.5 H8.75 V2.5 H6.25 V11.5 H4.5 Z M16.5 2.5 L19.5 6.5 H17.75 V15.5 H15.25 V6.5 H13.5 Z M1 12.5 H3.5 V19.5 H20.5 V12.5 H23 V22 H1 Z"/>
			</svg>
		</button>

		<button id="settingsPageButton" title="Open settings page" onclick={() => { bs.settingsOpen = !bs.settingsOpen; }}>
			<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 50 50" fill="currentColor">
				<path d="M47.16,21.221l-5.91-0.966c-0.346-1.186-0.819-2.326-1.411-3.405l3.45-4.917c0.279-0.397,0.231-0.938-0.112-1.282 l-3.889-3.887c-0.347-0.346-0.893-0.391-1.291-0.104l-4.843,3.481c-1.089-0.602-2.239-1.08-3.432-1.427l-1.031-5.886 C28.607,2.35,28.192,2,27.706,2h-5.5c-0.49,0-0.908,0.355-0.987,0.839l-0.956,5.854c-1.2,0.345-2.352,0.818-3.437,1.412l-4.83-3.45 c-0.399-0.285-0.942-0.239-1.289,0.106L6.82,10.648c-0.343,0.343-0.391,0.883-0.112,1.28l3.399,4.863 c-0.605,1.095-1.087,2.254-1.438,3.46l-5.831,0.971c-0.482,0.08-0.836,0.498-0.836,0.986v5.5c0,0.485,0.348,0.9,0.825,0.985 l5.831,1.034c0.349,1.203,0.831,2.362,1.438,3.46l-3.441,4.813c-0.284,0.397-0.239,0.942,0.106,1.289l3.888,3.891 c0.343,0.343,0.884,0.391,1.281,0.112l4.87-3.411c1.093,0.601,2.248,1.078,3.445,1.424l0.976,5.861C21.3,47.647,21.717,48,22.206,48 h5.5c0.485,0,0.9-0.348,0.984-0.825l1.045-5.89c1.199-0.353,2.348-0.833,3.43-1.435l4.905,3.441 c0.398,0.281,0.938,0.232,1.282-0.111l3.888-3.891c0.346-0.347,0.391-0.894,0.104-1.292l-3.498-4.857 c0.593-1.08,1.064-2.222,1.407-3.408l5.918-1.039c0.479-0.084,0.827-0.5,0.827-0.985v-5.5C47.999,21.718,47.644,21.3,47.16,21.221z M25,32c-3.866,0-7-3.134-7-7c0-3.866,3.134-7,7-7s7,3.134,7,7C32,28.866,28.866,32,25,32z"/>
			</svg>
		</button>
	</div>
</header>
