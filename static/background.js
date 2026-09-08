// Function to generate a unique ID
function generateUUID() {
  return crypto.randomUUID();
}

// Only the settings used here; mirrors DEFAULT_SETTINGS in src/lib/state/settings.svelte.js,
// which this service worker cannot import
const SETTINGS_DEFAULTS = {
  keepTabsOpen: false,
  savePinnedTabs: false,
  saveTabGroups: false,
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

// The id a tab out of every group reports. The constant lives in chrome.tabGroups,
// which is only there with the 'tabGroups' permission.
const NO_GROUP = -1;

// groupId is missing altogether on a Chrome too old to know about groups
const isGrouped = (tab) => tab.groupId !== undefined && tab.groupId !== NO_GROUP;

// A tab qualifies unless it is pinned, is in a tab group, or is not a web page. Both
// pinned and grouped tabs are opt-in, and a tab that does not qualify is left entirely
// alone: the batch never sees it, so it is neither saved nor closed.
function isSavable(tab, settings) {
  if (tab.pinned && !settings.savePinnedTabs) return false;
  if (isGrouped(tab) && !settings.saveTabGroups) return false;
  return tab.url.startsWith('http');
}

// Chrome shows an unnamed group by its colour, so a book named after one does the same
function groupBookTitle(group) {
  const title = group.title?.trim();
  if (title) return title;
  return `${group.color.charAt(0).toUpperCase()}${group.color.slice(1)} group`;
}

// The titles the batch needs, by group id. isSavable() already dropped every grouped tab
// unless the setting asks for them, so this only has to survive a missing API or a denied
// permission: without one, every tab stays ungrouped and the batch is one book.
async function groupTitles(tabs, settings) {
  const titles = new Map();
  if (!settings.saveTabGroups || !chrome.tabGroups) return titles;

  for (const id of new Set(tabs.filter(isGrouped).map(tab => tab.groupId))) {
    try {
      titles.set(id, groupBookTitle(await chrome.tabGroups.get(id)));
    } catch (err) {
      console.error('Tab group lookup failed:', err);   // its tabs fall back to one book
    }
  }
  return titles;
}

// One book per group whose title is known, plus one holding every ungrouped tab, ordered
// by the first tab of each: the books come out in the order the tabs are in. With no
// titles this is the single book the batch has always been.
function splitIntoBooks(tabs, titles) {
  const batches = [];
  const byGroup = new Map();

  tabs.forEach(tab => {
    const key = titles.has(tab.groupId) ? tab.groupId : NO_GROUP;
    let batch = byGroup.get(key);
    if (!batch) {
      batch = { title: titles.get(key) ?? null, tabs: [] };
      byGroup.set(key, batch);
      batches.push(batch);
    }
    batch.tabs.push(tab);
  });

  return batches;
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

  // Split the batch into the books it will become, before anything is read or written
  const batches = splitIntoBooks(tabs, await groupTitles(tabs, settings));

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

  // Drop the duplicates the settings ask for. The per-book flag starts a fresh set for
  // every book the batch produces, so a page saved from two groups survives in both; the
  // per-shelf flag also compares against what is already filed and keeps its set across
  // the whole batch, or one save could leave two copies in the shelf. Empty books are
  // left to the app, which sweeps them on load; nothing here can create one. The tabs are
  // closed either way, since a skipped page is already saved.
  const dedupe = settings.removeDuplicatesInBook || settings.removeDuplicatesInShelf;
  const seen = new Set();
  if (settings.removeDuplicatesInShelf) {
    shelf.books.forEach(book => book.pages.forEach(page => seen.add(page.url)));
  }

  // Pinned books hold the head of the list; mirrors firstUnpinnedIndex() in the app. The
  // books of one save go in consecutively: all inserted at the same spot they would come
  // out reversed.
  const firstUnpinned = shelf.books.findIndex(book => !book.pinned);
  let insertAt = (settings.newBooksAtBottom || firstUnpinned === -1)
    ? shelf.books.length
    : firstUnpinned;

  batches.forEach(batch => {
    if (dedupe && !settings.removeDuplicatesInShelf) seen.clear();

    const newPages = batch.tabs.map(tab => ({
      id: generateUUID(),
      title: tab.title,
      url: tab.url
    }));
    if (dedupe) {
      for (let i = newPages.length - 1; i >= 0; i--) {
        if (seen.has(newPages[i].url)) newPages.splice(i, 1);
        else seen.add(newPages[i].url);
      }
    }
    if (newPages.length === 0) return;   // nothing left to file, the tabs still go away

    // Create new book ID
    let newBookId;
    do {
      newBookId = generateUUID();
    } while(shelf.books.some(book => book.id === newBookId));

    // A group lends the book its name; everything else is 'Book X', numbered as the shelf
    // grows so that two books born of one save cannot share a number
    shelf.books.splice(insertAt, 0, {
      id: newBookId,
      title: batch.title ?? `Book ${shelf.books.length + 1}`,
      pages: newPages,
      collapsed: settings.newBooksCollapsed,
      locked: settings.newBooksLocked
    });
    insertAt++;
  });

  // Save the updated bookshelf data to storage
  chrome.storage.local.set({ 'selectedShelfId': selectedShelfId, 'bookshelfData': bookshelfData }, () => {
    // Close the saved tabs, unless the user asked to keep them
    if (!settings.keepTabsOpen) chrome.tabs.remove(tabs.map(tab => tab.id));

    // Send a message to tabs.html to refresh the bookshelf
    chrome.runtime.sendMessage({ action: 'bookshelfUpdated' });
  });
}