<script>
	import { bs } from '$lib/state/bookshelf.svelte.js';
	import { splitMatches } from '$lib/utils/highlight.js';

	/** @type {{ text: string, on?: boolean }} */
	let { text, on = true } = $props();

	// The markup below is deliberately one line: a newline between the pieces would land in
	// the middle of the text as whitespace. The pieces stay text nodes - never {@html}, since
	// page titles come from arbitrary websites.
	const parts = $derived(on ? splitMatches(text, bs.searchQuery) : [{ text, hit: false }]);
</script>
{#each parts as part}{#if part.hit}<mark class="searchHit">{part.text}</mark>{:else}{part.text}{/if}{/each}
