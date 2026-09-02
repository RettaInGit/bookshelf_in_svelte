<script>
	import { bs } from '$lib/state/bookshelf.svelte.js';

	let importAsNewShelf = $state(false);
	let exportAllShelves = $state(false);
	let textAreaValue = $state('');
	let textAreaEl = $state(null);

	// Auto-resize textarea width to fit its content (matches original behavior).
	$effect(() => {
		// Track dependencies.
		textAreaValue;
		if (!textAreaEl) return;
		const textSpan = document.createElement('span');
		textSpan.style.visibility = 'hidden';
		textSpan.style.fontFamily = textAreaEl.style.fontFamily;
		textSpan.style.fontSize = textAreaEl.style.fontSize;
		textSpan.textContent = textAreaValue;
		document.body.appendChild(textSpan);
		textAreaEl.style.width = `${textSpan.offsetWidth}px`;
		document.body.removeChild(textSpan);
	});

	function handleImport() {
		const success = bs.importText(textAreaValue, importAsNewShelf);
		if (success) { alert('Import complete!'); } else { alert('Invalid format. No bookshelves found.'); }
	}

	function handleExport() {
		textAreaValue = bs.exportText(exportAllShelves);
	}
</script>

<div id="importExportPopup" class:open={bs.importExportOpen} style="z-index: 101">
	<div style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 40px;">
		<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px;">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label style="font-weight: bold;">import in:</label>
			<div class="toggle-group">
				<span>current shelf</span>
				<label class="switch">
					<input type="checkbox" bind:checked={importAsNewShelf} />
					<span class="slider"></span>
				</label>
				<span>new shelf</span>
			</div>
			<button onclick={handleImport} style="width: 100%; margin: 10px 0 0 0;">Import</button>
		</div>
		<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px;">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label style="font-weight: bold;">export from:</label>
			<div class="toggle-group">
				<span>current shelf</span>
				<label class="switch">
					<input type="checkbox" bind:checked={exportAllShelves} />
					<span class="slider"></span>
				</label>
				<span>All shelves</span>
			</div>
			<button onclick={handleExport} style="width: 100%; margin: 10px 0 0 0;">Export</button>
		</div>
	</div>
	<textarea id="importExportTextArea" bind:value={textAreaValue} bind:this={textAreaEl}></textarea>
</div>
