// Function to generate a unique ID
function generateUUID() {
  return crypto.randomUUID();
}

// Only the settings used here; mirrors DEFAULT_SETTINGS in src/lib/state/settings.svelte.js,
// which this service worker cannot import
const SETTINGS_DEFAULTS = {
  keepTabsOpen: false,
  savePinnedTabs: false,
  newBooksAtBottom: false,
  newBooksCollapsed: false,
  newBooksLocked: false,
  removeDuplicatesInBook: false,
  removeDuplicatesInShelf: false
};

async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  return { ...SETTINGS_DEFAULTS, ...(data.settings ?? {}) };
}

// A tab qualifies unless it is pinned (opt-in) or is not a web page
function isSavable(tab, settings) {
  return (settings.savePinnedTabs || !tab.pinned) && tab.url.startsWith('http');
}

// Open extension page when its icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'tabs.html' });
});

// Create context menu items when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Menu items
  chrome.contextMenus.create({
    id: 'savePagesOnLeft',
    title: 'Save pages on the left',
    contexts: ['action']
  });

  chrome.contextMenus.create({
    id: 'savePagesOnRight',
    title: 'Save pages on the right',
    contexts: ['action']
  });

  chrome.contextMenus.create({
    id: 'saveOnlyThisPage',
    title: 'Save only this page',
    contexts: ['action']
  });

  chrome.contextMenus.create({
    id: 'saveAllPages',
    title: 'Save all pages',
    contexts: ['action']
  });

  chrome.contextMenus.create({
    id: 'saveAllPagesExceptThis',
    title: 'Save all pages except this',
    contexts: ['action']
  });
});

// Listen for clicks on context menu items
chrome.contextMenus.onClicked.addListener(async (info, currentTab) => {
  const settings = await loadSettings();
  if (info.menuItemId === 'savePagesOnLeft') {
    savePagesOnLeft(currentTab, settings);
  } else if (info.menuItemId === 'savePagesOnRight') {
    savePagesOnRight(currentTab, settings);
  } else if (info.menuItemId === 'saveOnlyThisPage') {
    saveOnlyThisPage(currentTab, settings);
  } else if (info.menuItemId === 'saveAllPages') {
    saveAllPages(currentTab, settings);
  } else if (info.menuItemId === 'saveAllPagesExceptThis') {
    saveAllPagesExceptThis(currentTab, settings);
  }
});

// Function to save pages on the left
function savePagesOnLeft(currentTab, settings) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    savePages(tabs.filter(tab => (tab.index < currentTab.index) && isSavable(tab, settings)), settings);
  });
}

// Function to save pages on the right
function savePagesOnRight(currentTab, settings) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    savePages(tabs.filter(tab => (tab.index > currentTab.index) && isSavable(tab, settings)), settings);
  });
}

// Function to save only the current page
function saveOnlyThisPage(currentTab, settings) {
  if (isSavable(currentTab, settings)) {
    savePages([currentTab], settings);
  }
}

// Function to save all pages
function saveAllPages(currentTab, settings) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    savePages(tabs.filter(tab => isSavable(tab, settings)), settings);
  });
}

// Function to save all pages except current
function saveAllPagesExceptThis(currentTab, settings) {
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    savePages(tabs.filter(tab => (tab.id !== currentTab.id) && isSavable(tab, settings)), settings);
  });
}

// Generic function to save pages
async function savePages(tabs, settings) {
  // Check if there are any pages to save
  if (tabs.length === 0) return;

  // Map the filtered tabs to get their title and URL for the pages
  const newPages = tabs.map(tab => ({
    id: generateUUID(),
    title: tab.title,
    url: tab.url
  }));

  // Retrieve bookshelf saved data to determine the default book title and save it
  let bookshelfData;
  let selectedShelfId;
  const data = await chrome.storage.local.get(['selectedShelfId', 'bookshelfData']);
  if (!data.bookshelfData) {
    bookshelfData = [{ id: generateUUID(), title: 'Shelf 1', books: [] }];
    selectedShelfId = bookshelfData[0].id;
  }
  else {
    bookshelfData = data.bookshelfData;
    selectedShelfId = data.selectedShelfId || bookshelfData[0].id;
  }

  // Find the shelf
  let shelf = bookshelfData.find(shelf => shelf.id === selectedShelfId);
  if (!shelf) {
    // Create new shelf ID
    let newShelfId;
    do {
      newShelfId = generateUUID();
    } while(bookshelfData.some(shelf => shelf.id === newShelfId));

    // Create new shelf
    const newShelf = {
      id: newShelfId,
      title: `Shelf ${bookshelfData.length + 1}`,
      books: []
    }

    // Save new shelf and add it at the end of the array
    selectedShelfId = newShelf.id;
    bookshelfData.push(newShelf);

    shelf = newShelf;
  }

  // Drop the duplicates the settings ask for. The batch becomes one book, so the per-book
  // flag dedupes within it, and the per-shelf flag also compares against what is already
  // filed. Empty books are left to the app, which sweeps them on load; nothing here can
  // create one. The tabs are closed either way, since a skipped page is already saved.
  if (settings.removeDuplicatesInBook || settings.removeDuplicatesInShelf) {
    const seen = new Set();
    if (settings.removeDuplicatesInShelf) {
      shelf.books.forEach(book => book.pages.forEach(page => seen.add(page.url)));
    }
    for (let i = newPages.length - 1; i >= 0; i--) {
      if (seen.has(newPages[i].url)) newPages.splice(i, 1);
      else seen.add(newPages[i].url);
    }

    // Everything was a duplicate: nothing to file, but the tabs still go away
    if (newPages.length === 0) {
      chrome.storage.local.set({ 'selectedShelfId': selectedShelfId, 'bookshelfData': bookshelfData }, () => {
        if (!settings.keepTabsOpen) chrome.tabs.remove(tabs.map(tab => tab.id));
        chrome.runtime.sendMessage({ action: 'bookshelfUpdated' });
      });
      return;
    }
  }

  // Create new book ID
  let newBookId;
  do {
    newBookId = generateUUID();
  } while(shelf.books.some(book => book.id === newBookId));

  // Create default book title as 'Book X'
  let defaultBookTitle = `Book ${shelf.books.length + 1}`;

  // Add the new book where the settings ask for it
  const newBook = {
    id: newBookId,
    title: defaultBookTitle,
    pages: newPages,
    collapsed: settings.newBooksCollapsed,
    locked: settings.newBooksLocked
  };
  if (settings.newBooksAtBottom) shelf.books.push(newBook);
  else shelf.books.unshift(newBook);

  // Save the updated bookshelf data to storage
  chrome.storage.local.set({ 'selectedShelfId': selectedShelfId, 'bookshelfData': bookshelfData }, () => {
    // Close the saved tabs, unless the user asked to keep them
    if (!settings.keepTabsOpen) chrome.tabs.remove(tabs.map(tab => tab.id));

    // Send a message to tabs.html to refresh the bookshelf
    chrome.runtime.sendMessage({ action: 'bookshelfUpdated' });
  });
}