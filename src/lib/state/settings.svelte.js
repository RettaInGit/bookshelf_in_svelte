// Every option lives in one 'settings' object under a single storage key: adding one means
// adding a default here, nothing in the storage layer. Keys used by background.js are
// mirrored there, which cannot import this module.
export const DEFAULT_SETTINGS = {
	// ── Appearance ────────────────────────────────────────────────────────────────
	showPageUrls: false,
	searchUrls: false,
	remoteFavicons: true,      // page icons come from an external service, so they are opt-out
	fullWidthLayout: false,
	hideDropAreaButton: false,
	confirmDestructive: true,
	reduceAnimations: false,

	// ── Saving pages ──────────────────────────────────────────────────────────────
	keepTabsOpen: false,
	savePinnedTabs: false,
	newBooksAtBottom: false,
	newBooksCollapsed: false,
	newBooksLocked: false,
	removeDuplicatesInBook: false,   // these three are what BookshelfStore.tidy() applies
	removeDuplicatesInShelf: false,
	removeEmptyBooks: false,

	// ── Pinned books ──────────────────────────────────────────────────────────────
	newPinsAtBottom: false,

	// ── Restoring pages ───────────────────────────────────────────────────────────
	keepPagesOnRestore: false,
	openInBackground: false
};

export const settings = $state({ ...DEFAULT_SETTINGS });

// Unknown keys are dropped and missing ones fall back to their default, so a settings
// object written by another version of the extension stays readable.
export function applySettings(stored) {
	for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
		const value = stored?.[key];
		settings[key] = typeof value === typeof fallback ? value : fallback;
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
