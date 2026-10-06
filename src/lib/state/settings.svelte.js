// Every option lives in one 'settings' object under a single storage key: adding one means
// adding a default here, nothing in the storage layer. Keys used by background.js are
// mirrored there, which cannot import this module.
export const DEFAULT_SETTINGS = {
	// ── Appearance ────────────────────────────────────────────────────────────────
	showPageUrls: false,
	searchUrls: false,
	searchOtherShelves: false,
	remoteFavicons: true,      // page icons come from an external service, so they are opt-out
	fullWidthLayout: false,
	hideDropAreaButton: false,
	confirmDestructive: true,
	reduceAnimations: false,

	// ── Saving pages ──────────────────────────────────────────────────────────────
	keepTabsOpen: false,
	savePinnedTabs: false,
	saveTabGroups: false,
	newBooksAtBottom: false,
	newBooksCollapsed: false,
	newBooksLocked: false,
	removeDuplicatesInBook: false,   // these three are what BookshelfStore.tidy() applies
	removeDuplicatesInShelf: false,
	removeEmptyBooks: false,

	// ── Pinned books ──────────────────────────────────────────────────────────────
	newPinsAtBottom: false,

	// ── Sorting ───────────────────────────────────────────────────────────────────
	sortPages: 'manual',    // SORT_OPTIONS lists the values these three accept
	sortBooks: 'manual',
	sortShelves: 'manual',

	// ── Shelves ───────────────────────────────────────────────────────────────────
	closeShelvesOnSelect: true,

	// ── Restoring pages ───────────────────────────────────────────────────────────
	openInBackground: false
};

// The only settings that are not booleans: each lists the values it accepts, paired with
// the label the settings panel shows. 'manual' means the list keeps the order it is given.
export const SORT_OPTIONS = {
	sortPages: [
		['manual', 'Manually'],
		['titleAsc', 'By name A..Z'],
		['titleDesc', 'By name Z..A'],
		['urlAsc', 'By URL A..Z'],
		['urlDesc', 'By URL Z..A']
	],
	sortBooks: [
		['manual', 'Manually'],
		['titleAsc', 'By name A..Z'],
		['titleDesc', 'By name Z..A']
	],
	sortShelves: [
		['manual', 'Manually'],
		['titleAsc', 'By name A..Z'],
		['titleDesc', 'By name Z..A']
	]
};

export const settings = $state({ ...DEFAULT_SETTINGS });

// Unknown keys are dropped and missing ones fall back to their default, so a settings
// object written by another version of the extension stays readable.
export function applySettings(stored) {
	for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
		const value = stored?.[key];
		const known = SORT_OPTIONS[key]?.some(([option]) => option === value) ?? true;
		settings[key] = typeof value === typeof fallback && known ? value : fallback;
	}
}

// Every destructive path asks through here, so one flag covers them all.
export function confirmAction(message) {
	return !settings.confirmDestructive || confirm(message);
}

// Sortable's animation duration, shared by every list.
export function dragAnimation() {
	return settings.reduceAnimations ? 0 : 150;
}

// The shape every new book starts with, wherever it is created.
export function newBookFlags() {
	return { collapsed: settings.newBooksCollapsed, locked: settings.newBooksLocked };
}

// Case and accents are ignored and embedded numbers compare as numbers, so 'Book 2' comes
// before 'Book 10'.
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

// How to order a list, or null when it keeps the order the user gave it. Array.sort is
// stable, so equal keys leave the manual order between them untouched.
export function comparator(option) {
	switch (option) {
		case 'titleAsc': return (a, b) => collator.compare(a.title, b.title);
		case 'titleDesc': return (a, b) => collator.compare(b.title, a.title);
		case 'urlAsc': return (a, b) => collator.compare(a.url, b.url);
		case 'urlDesc': return (a, b) => collator.compare(b.url, a.url);
		default: return null;
	}
}
