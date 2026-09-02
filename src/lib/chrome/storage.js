const isChromeExtension =
	typeof chrome !== 'undefined' && !!chrome?.storage?.local;

export async function loadFromStorage() {
	if (isChromeExtension) {
		return chrome.storage.local.get(['selectedShelfId', 'bookshelfData', 'themeSelected']);
	}
	return {
		bookshelfData: JSON.parse(localStorage.getItem('bookshelfData') || 'null'),
		selectedShelfId: localStorage.getItem('selectedShelfId') || null,
		themeSelected: localStorage.getItem('themeSelected') || 'light'
	};
}

export async function saveToStorage(data) {
	if (isChromeExtension) {
		return new Promise((resolve) => {
			chrome.storage.local.set(data, () => {
				if (chrome.runtime.lastError) {
					console.error('Error setting storage:', chrome.runtime.lastError);
				}
				resolve();
			});
		});
	}
	Object.entries(data).forEach(([k, v]) => {
		localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
	});
}

export function onExternalUpdate(callback) {
	if (isChromeExtension) {
		chrome.runtime.onMessage.addListener((message) => {
			if (message.action === 'bookshelfUpdated') callback();
		});
	}
}

export function openTab(url) {
	if (isChromeExtension) {
		chrome.tabs.create({ url });
	} else {
		window.open(url, '_blank');
	}
}
