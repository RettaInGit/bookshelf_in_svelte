import { generateUUID } from '$lib/utils/uuid.js';
import { settings, newBookFlags, comparator } from '$lib/state/settings.svelte.js';

// Pinned books hold the head of the list, so this is the first slot an unpinned one can
// take. Read from the order itself: inserting here is right even if the two ever mix.
export function firstUnpinnedIndex(books) {
	const idx = books.findIndex((b) => !b.pinned);
	return idx === -1 ? books.length : idx;
}

// Orders one slice of a list in place, so the pinned head and the unpinned tail of a book
// list can be sorted on their own. Reports whether anything actually moved: an order that
// is already right must not mark the data dirty.
function sortRange(list, from, to, cmp) {
	const slice = list.slice(from, to).sort(cmp);
	if (slice.every((item, i) => item === list[from + i])) return false;
	list.splice(from, slice.length, ...slice);
	return true;
}

class BookshelfStore {
	// ── Core data ───────────────────────────────────────────────────────────────
	bookshelfData = $state([]);
	selectedShelfId = $state('');
	pagesToMove = $state([]); // { id, title, url, shelfId, bookId }

	// ── UI state ─────────────────────────────────────────────────────────────────
	themePreference = $state('system');  // 'light' | 'dark' | 'system'
	systemDark = $state(false);         // kept in sync with prefers-color-scheme by Header
	searchQuery = $state('');
	shelvesOpen = $state(false);
	dropAreaOpen = $state(false);
	dropAreaHidden = $state(true);  // kept apart from 'dropAreaOpen' to let the closing transition run
	importExportOpen = $state(false);
	settingsOpen = $state(false);

	// ── Persistence flags ─────────────────────────────────────────────────────────
	bookshelfDataUpdated = $state(false);
	loadingBookshelfData = $state(true);  // true until the first read from storage completes

	// ── Derived ───────────────────────────────────────────────────────────────────
	get currentShelf() {
		return this.bookshelfData.find((s) => s.id === this.selectedShelfId);
	}

	// The theme actually painted: 'system' resolves against the OS preference
	get theme() {
		if (this.themePreference === 'system') return this.systemDark ? 'dark' : 'light';
		return this.themePreference;
	}

	markDirty() {
		this.bookshelfDataUpdated = true;
	}

	// searchQuery arrives already trimmed and lowercased from the header
	matches(page) {
		if (!this.searchQuery) return true;
		if (page.title.toLowerCase().includes(this.searchQuery)) return true;
		return settings.searchUrls && page.url.toLowerCase().includes(this.searchQuery);
	}

	// The housekeeping the settings ask for, in one entry point every caller that adds
	// pages can use. Duplicates keep their first occurrence; the shelf-wide scope subsumes
	// the per-book one, so having both on behaves like the shelf alone.
	tidy(shelfId = this.selectedShelfId) {
		const perBook = settings.removeDuplicatesInBook;
		const perShelf = settings.removeDuplicatesInShelf;
		if (!perBook && !perShelf && !settings.removeEmptyBooks) return;

		const shelf = this.bookshelfData.find((s) => s.id === shelfId);
		if (!shelf) return;
		let changed = false;

		if (perBook || perShelf) {
			const seen = new Set();
			for (const book of shelf.books) {
				if (!perShelf) seen.clear();
				const doomed = [];
				book.pages.forEach((page, i) => {
					if (seen.has(page.url)) doomed.push(i);
					else seen.add(page.url);
				});
				for (let i = doomed.length - 1; i >= 0; i--) {
					const [dropped] = book.pages.splice(doomed[i], 1);
					const moveIdx = this.pagesToMove.findIndex(
						(item) => item.shelfId === shelfId && item.bookId === book.id && item.id === dropped.id
					);
					if (moveIdx !== -1) this.pagesToMove.splice(moveIdx, 1);
					changed = true;
				}
			}
		}

		// Opting in covers the books that were already empty, not only the ones just emptied
		if (settings.removeEmptyBooks) {
			for (let i = shelf.books.length - 1; i >= 0; i--) {
				if (shelf.books[i].pages.length === 0) { shelf.books.splice(i, 1); changed = true; }
			}
		}

		if (changed) this.markDirty();
	}

	// The order the settings ask for, in one entry point every caller that changes a list
	// can use. Pinned books hold the head of their shelf, so a book list is two ranges each
	// sorted on its own. The drop area stays out of it: it only stages pages.
	sortAll() {
		const shelfCmp = comparator(settings.sortShelves);
		const bookCmp = comparator(settings.sortBooks);
		const pageCmp = comparator(settings.sortPages);
		if (!shelfCmp && !bookCmp && !pageCmp) return;

		let changed = false;
		if (shelfCmp) {
			changed = sortRange(this.bookshelfData, 0, this.bookshelfData.length, shelfCmp) || changed;
		}

		for (const shelf of this.bookshelfData) {
			if (bookCmp) {
				const pinnedEnd = firstUnpinnedIndex(shelf.books);
				changed = sortRange(shelf.books, 0, pinnedEnd, bookCmp) || changed;
				changed = sortRange(shelf.books, pinnedEnd, shelf.books.length, bookCmp) || changed;
			}
			if (pageCmp) {
				for (const book of shelf.books) {
					changed = sortRange(book.pages, 0, book.pages.length, pageCmp) || changed;
				}
			}
		}

		if (changed) this.markDirty();
	}

	// ── Shelf mutations ───────────────────────────────────────────────────────────
	addShelf() {
		let newId;
		do {
			newId = generateUUID();
		} while (this.bookshelfData.some((s) => s.id === newId));
		this.bookshelfData.push({ id: newId, title: `Shelf ${this.bookshelfData.length + 1}`, books: [] });
		this.markDirty();
		this.sortAll();
		return newId;
	}

	removeShelf(shelfId) {
		const idx = this.bookshelfData.findIndex((s) => s.id === shelfId);
		if (idx === -1) return;

		if (shelfId === this.selectedShelfId) {
			this.bookshelfData[idx].books = [];
		} else {
			this.bookshelfData.splice(idx, 1);
		}

		for (let i = this.pagesToMove.length - 1; i >= 0; i--) {
			if (this.pagesToMove[i].shelfId === shelfId) this.pagesToMove.splice(i, 1);
		}
		this.markDirty();
	}

	selectShelf(shelfId) {
		this.selectedShelfId = shelfId;
		this.markDirty();
	}

	renameShelf(shelfId, newTitle) {
		const shelf = this.bookshelfData.find((s) => s.id === shelfId);
		if (shelf) { shelf.title = newTitle; this.markDirty(); this.sortAll(); }
	}

	// ── Book mutations ────────────────────────────────────────────────────────────
	removeBook(shelfId, bookId) {
		const shelf = this.bookshelfData.find((s) => s.id === shelfId);
		if (!shelf) return;
		const idx = shelf.books.findIndex((b) => b.id === bookId);
		if (idx !== -1) { shelf.books.splice(idx, 1); this.markDirty(); }
	}

	renameBook(shelfId, bookId, newTitle) {
		const shelf = this.bookshelfData.find((s) => s.id === shelfId);
		const book = shelf?.books.find((b) => b.id === bookId);
		if (book) { book.title = newTitle; this.markDirty(); this.sortAll(); }
	}

	toggleBookCollapsed(shelfId, bookId) {
		const shelf = this.bookshelfData.find((s) => s.id === shelfId);
		const book = shelf?.books.find((b) => b.id === bookId);
		if (book) { book.collapsed ^= true; this.markDirty(); }
	}

	toggleBookLocked(shelfId, bookId) {
		const shelf = this.bookshelfData.find((s) => s.id === shelfId);
		const book = shelf?.books.find((b) => b.id === bookId);
		if (book) { book.locked = !book.locked; this.markDirty(); }
	}

	// Pinning lifts the book into the pinned head of the list, unpinning drops it right
	// below it: the two blocks never interleave, whichever way the flag goes.
	toggleBookPinned(shelfId, bookId) {
		const shelf = this.bookshelfData.find((s) => s.id === shelfId);
		const idx = shelf?.books.findIndex((b) => b.id === bookId) ?? -1;
		if (idx === -1) return;

		const [book] = shelf.books.splice(idx, 1);
		book.pinned = !book.pinned;
		const atBottomOfBlock = !book.pinned || settings.newPinsAtBottom;
		shelf.books.splice(atBottomOfBlock ? firstUnpinnedIndex(shelf.books) : 0, 0, book);
		this.markDirty();
		this.sortAll();
	}

	// ── Import/export helpers ─────────────────────────────────────────────────────
	importText(text, importAsNewShelf) {
		if (!text.trim()) return false;

		const lines = text.split('\n');
		const newData = [];
		let currentShelf = null;
		let currentBook = null;

		// A book or a page with nothing named above it opens a placeholder parent, whose title
		// stays null until it is known where it lands
		const openShelf = () => {
			if (!currentShelf) {
				currentShelf = { id: generateUUID(), title: null, books: [] };
				newData.push(currentShelf);
			}
			return currentShelf;
		};
		const openBook = () => {
			if (!currentBook) {
				currentBook = { id: generateUUID(), title: null, pages: [], ...newBookFlags() };
				openShelf().books.push(currentBook);
			}
			return currentBook;
		};

		try {
			lines.forEach((line) => {
				// a blank line ends the book, as the export writes one after each
				if (!line.trim()) { currentBook = null; return; }

				const startSpaces = line.length - line.trimStart().length;

				switch (startSpaces) {
					case 8: {
						const pageText = line.trim();
						const pipeIndex = pageText.indexOf('|');
						if (pipeIndex !== -1) {
							openBook().pages.push({
								id: generateUUID(),
								url: pageText.substring(0, pipeIndex).trim(),
								title: pageText.substring(pipeIndex + 1).trim()
							});
						}
					} break;
					case 4: {
						currentBook = { id: generateUUID(), title: line.trim(), pages: [], ...newBookFlags() };
						openShelf().books.push(currentBook);
					} break;
					case 0: {
						currentShelf = { id: generateUUID(), title: line.trim(), books: [] };
						newData.push(currentShelf);
						currentBook = null;
					} break;
					default: {
						// Ignore lines with unexpected indentation
					} break;
				}
			});
		} catch (err) {
			console.error('Import error:', err);
		}

		if (newData.length === 0) return false;

		// Placeholders are numbered as the list they land in grows, like the books saved from tabs
		if (!importAsNewShelf) {
			const shelf = this.bookshelfData.find((s) => s.id === this.selectedShelfId);
			const imported = newData.flatMap((s) => s.books);
			if (shelf) {
				imported.forEach((book, i) => { book.title ??= `Book ${shelf.books.length + i + 1}`; });
				if (settings.newBooksAtBottom) shelf.books.push(...imported);
				else shelf.books.splice(firstUnpinnedIndex(shelf.books), 0, ...imported);
			}
		} else {
			newData.forEach((shelf, i) => {
				shelf.title ??= `Shelf ${this.bookshelfData.length + i + 1}`;
				shelf.books.forEach((book, j) => { book.title ??= `Book ${j + 1}`; });
			});
			this.bookshelfData.push(...newData);
			this.selectedShelfId = newData[0].id;
		}

		this.markDirty();
		this.tidy();
		this.sortAll();
		return true;
	}

	exportText(exportAllShelves) {
		const shelves = exportAllShelves ? this.bookshelfData : [this.currentShelf].filter(Boolean);
		let out = '';
		shelves.forEach((shelf) => {
			out += `${shelf.title}\n`;
			shelf.books.forEach((book) => {
				out += `    ${book.title}\n`;
				book.pages.forEach((page) => { out += `        ${page.url} | ${page.title}\n`; });
				out += '\n';
			});
			out += '\n';
		});
		return out;
	}
}

export const bs = new BookshelfStore();
