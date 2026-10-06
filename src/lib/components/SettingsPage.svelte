<script>
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { settings, SORT_OPTIONS } from '$lib/state/settings.svelte.js';
	import { saveToStorage, openTab, getVersion } from '$lib/chrome/storage.js';

	const SOURCE_URL = 'https://github.com/RettaInGit/bookshelf_in_svelte';
	const STORE_URL = 'https://chromewebstore.google.com/detail/bookshelf/bmgphchchbdajdapnomkmbhiolapbple';

	const version = getVersion();

	// One effect covers every control: reading the whole object subscribes to all of them,
	// so no toggle can be added without its value being saved.
	$effect(() => {
		const snapshot = $state.snapshot(settings);
		if (bs.loadingBookshelfData) return;  // don't write back what was just read
		saveToStorage({ settings: snapshot });
	});

	function setTheme(preference) {
		bs.themePreference = preference;
		saveToStorage({ themeSelected: preference });
	}

	// The three housekeeping options act on the data the moment they are switched on, so
	// they set their value and sweep in the same handler rather than through a binding:
	// sharing the change event with bind:checked would leave the order to chance. tidy()
	// must not live in an $effect either, since it both reads and mutates bookshelfData.
	function tidyWith(key) {
		return (e) => {
			settings[key] = e.currentTarget.checked;
			bs.tidy();
		};
	}

	// Same story for the sort options: the value has to be in place before the pass runs.
	function sortWith(key) {
		return (e) => {
			settings[key] = e.currentTarget.value;
			bs.sortAll();
		};
	}
</script>

<div id="settingsPage" class:open={bs.settingsOpen} style="z-index: 102">
	<div id="settingsHeader">
		<h2>Settings</h2>
		<button id="settingsCloseButton" title="Close settings" onclick={() => { bs.settingsOpen = false; }}>
			<svg viewBox="0 0 30 30" width="18px" height="18px" fill="currentColor">
				<path d="M 7 4 C 6.744125 4 6.4879687 4.0974687 6.2929688 4.2929688 L 4.2929688 6.2929688 C 3.9019687 6.6839688 3.9019687 7.3170313 4.2929688 7.7070312 L 11.585938 15 L 4.2929688 22.292969 C 3.9019687 22.683969 3.9019687 23.317031 4.2929688 23.707031 L 6.2929688 25.707031 C 6.6839688 26.098031 7.3170313 26.098031 7.7070312 25.707031 L 15 18.414062 L 22.292969 25.707031 C 22.682969 26.098031 23.317031 26.098031 23.707031 25.707031 L 25.707031 23.707031 C 26.098031 23.316031 26.098031 22.682969 25.707031 22.292969 L 18.414062 15 L 25.707031 7.7070312 C 26.098031 7.3170312 26.098031 6.6829688 25.707031 6.2929688 L 23.707031 4.2929688 C 23.316031 3.9019687 22.682969 3.9019687 22.292969 4.2929688 L 15 11.585938 L 7.7070312 4.2929688 C 7.5115312 4.0974687 7.255875 4 7 4 z"/>
			</svg>
		</button>
	</div>

	<section class="settingsSection">
		<h3>Appearance</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Theme</span>
			</div>
			<div class="settingsChoice">
				{#each [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']] as [value, label] (value)}
					<button
						class:selected={bs.themePreference === value}
						onclick={() => setTheme(value)}
					>{label}</button>
				{/each}
			</div>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Show page URLs</span>
				<small>Adds the URL under each page title, instead of only in its tooltip.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.showPageUrls} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Show website icons</span>
				<small>Add the page icon next to each page title.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.remoteFavicons} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Full width layout</span>
				<small>Lets the books use the whole window.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.fullWidthLayout} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Hide the drop area button</span>
				<small>Removes the button in the bottom-right corner. The drop area closes with it.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.hideDropAreaButton} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Ask before removing</span>
				<small>Removing a shelf, a book or the selected pages asks for a confirmation first.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.confirmDestructive} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Reduce animations</span>
				<small>Drops the transitions and the drag animations.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.reduceAnimations} />
				<span class="slider"></span>
			</label>
		</div>
	</section>

	<section class="settingsSection">
		<h3>Search</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Search URLs too</span>
				<small>The search box matches page URLs as well as titles.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.searchUrls} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Search other shelves too</span>
				<small>When nothing here matches, name the shelves that do.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.searchOtherShelves} />
				<span class="slider"></span>
			</label>
		</div>
	</section>

	<section class="settingsSection">
		<h3>Saving pages</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Keep the tabs open</span>
				<small>Saved pages stay open in the browser instead of being closed.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.keepTabsOpen} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Save pinned tabs too</span>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.savePinnedTabs} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Save tab groups too</span>
				<small>Tabs in a group are saved too, each group as a book of its own.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.saveTabGroups} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Add new books at the bottom</span>
				<small>Applies to saved tabs and to an import into the current shelf.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.newBooksAtBottom} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Create new books collapsed</span>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.newBooksCollapsed} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Create new books locked</span>
				<small>A locked book keeps its pages when you open them.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.newBooksLocked} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Remove duplicates in book</span>
				<small>One page per URL inside each book.</small>
			</div>
			<label class="switch">
				<input type="checkbox" checked={settings.removeDuplicatesInBook} onchange={tidyWith('removeDuplicatesInBook')} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Remove duplicates in shelf</span>
				<small>One page per URL, even across different books.</small>
			</div>
			<label class="switch">
				<input type="checkbox" checked={settings.removeDuplicatesInShelf} onchange={tidyWith('removeDuplicatesInShelf')} />
				<span class="slider"></span>
			</label>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Remove empty books</span>
				<small>Drops any book left without pages.</small>
			</div>
			<label class="switch">
				<input type="checkbox" checked={settings.removeEmptyBooks} onchange={tidyWith('removeEmptyBooks')} />
				<span class="slider"></span>
			</label>
		</div>
	</section>

	<section class="settingsSection">
		<h3>Sorting</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Sort pages</span>
				<small>How the pages inside each book are ordered.</small>
			</div>
			<select class="settingsSelect" value={settings.sortPages} onchange={sortWith('sortPages')}>
				{#each SORT_OPTIONS.sortPages as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Sort books</span>
				<small>Pinned books are ordered among themselves, ahead of the others.</small>
			</div>
			<select class="settingsSelect" value={settings.sortBooks} onchange={sortWith('sortBooks')}>
				{#each SORT_OPTIONS.sortBooks as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Sort shelves</span>
			</div>
			<select class="settingsSelect" value={settings.sortShelves} onchange={sortWith('sortShelves')}>
				{#each SORT_OPTIONS.sortShelves as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>
	</section>

	<section class="settingsSection">
		<h3>Shelves</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Close the shelf list after choosing</span>
				<small>Picking a shelf also folds the list away.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.closeShelvesOnSelect} />
				<span class="slider"></span>
			</label>
		</div>
	</section>

	<section class="settingsSection">
		<h3>Pinned books</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Add new pins at the bottom</span>
				<small>Each new pin goes last among the pinned books.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.newPinsAtBottom} />
				<span class="slider"></span>
			</label>
		</div>
	</section>

	<section class="settingsSection">
		<h3>Restoring pages</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Open pages in the background</span>
				<small>Restored pages do not steal the focus from this one.</small>
			</div>
			<label class="switch">
				<input type="checkbox" bind:checked={settings.openInBackground} />
				<span class="slider"></span>
			</label>
		</div>
	</section>

	<section class="settingsSection">
		<h3>About</h3>

		<div class="settingsRow">
			<div class="settingsRowText">
				<span>Bookshelf{version ? ` ${version}` : ''}</span>
				<small>Store and manage your open pages in a well-arranged bookshelf to save memory.</small>
			</div>
		</div>

		<div class="settingsLinks">
			<button onclick={() => openTab(SOURCE_URL)}>Source code</button>
			<button onclick={() => openTab(STORE_URL)}>Chrome Web Store</button>
		</div>
	</section>
</div>
