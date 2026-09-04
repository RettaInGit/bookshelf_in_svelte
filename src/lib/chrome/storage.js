import { settings } from '$lib/state/settings.svelte.js';

const isChromeExtension =
	typeof chrome !== 'undefined' && !!chrome?.storage?.local;

export async function loadFromStorage() {
	if (isChromeExtension) {
		return chrome.storage.local.get(['selectedShelfId', 'bookshelfData', 'themeSelected', 'settings']);
	}
	return {
		bookshelfData: JSON.parse(localStorage.getItem('bookshelfData') || 'null'),
		selectedShelfId: localStorage.getItem('selectedShelfId') || null,
		themeSelected: localStorage.getItem('themeSelected') || 'system',
		settings: JSON.parse(localStorage.getItem('settings') || 'null')
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
		chrome.tabs.create({ url, active: !settings.openInBackground });
	} else {
		window.open(url, '_blank');
	}
}

// Null outside the extension: there is no manifest to read the version from.
export function getVersion() {
	if (typeof chrome === 'undefined' || !chrome?.runtime?.getManifest) return null;
	return chrome.runtime.getManifest().version;
}

