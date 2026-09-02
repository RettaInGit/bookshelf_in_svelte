import { generateUUID } from '$lib/utils/uuid.js';

class BookshelfStore {
	// ── Core data ───────────────────────────────────────────────────────────────
	bookshelfData = $state([]);
	selectedShelfId = $state('');
	pagesToMove = $state([]); // { id, title, url, shelfId, bookId }

	// ── UI state ─────────────────────────────────────────────────────────────────
	theme = $state('light');
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

	markDirty() {
		this.bookshelfDataUpdated = true;
	}

	// ── Shelf mutations ───────────────────────────────────────────────────────────
	addShelf() {
		let newId;
		do {
			newId = generateUUID();
		} while (this.bookshelfData.some((s) => s.id === newId));
		this.bookshelfData.push({ id: newId, title: `Shelf ${this.bookshelfData.length + 1}`, books: [] });
		this.markDirty();
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
		if (shelf) { shelf.title = newTitle; this.markDirty(); }
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
		if (book) { book.title = newTitle; this.markDirty(); }
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

	// ── Import/export helpers ─────────────────────────────────────────────────────
	importText(text, importAsNewShelf) {
		if (!text.trim()) return false;

		const lines = text.split('\n');
		const newData = [];
		let currentShelf = null;
		let currentBook = null;

		try {
			lines.forEach((line) => {
				if (!line.trim()) return;
				if (line.startsWith('        ')) {
					if (currentBook) {
						const pageText = line.trim();
						const pipeIndex = pageText.indexOf('|');
						if (pipeIndex !== -1) {
							currentBook.pages.push({
								id: generateUUID(),
								url: pageText.substring(0, pipeIndex).trim(),
								title: pageText.substring(pipeIndex + 1).trim()
							});
						}
					}
				} else if (line.startsWith('    ')) {
					if (currentShelf) {
						currentBook = { id: generateUUID(), title: line.trim(), pages: [], collapsed: false, locked: false };
						currentShelf.books.push(currentBook);
					}
				} else {
					currentShelf = { id: generateUUID(), title: line.trim(), books: [] };
					newData.push(currentShelf);
					currentBook = null;
				}
			});
		} catch (err) {
			console.error('Import error:', err);
		}

		if (newData.length === 0) return false;

		if (!importAsNewShelf) {
			const shelf = this.bookshelfData.find((s) => s.id === this.selectedShelfId);
			if (shelf) shelf.books.unshift(...newData.flatMap((s) => s.books));
		} else {
			this.bookshelfData.push(...newData);
			this.selectedShelfId = newData[0].id;
		}

		this.markDirty();
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
