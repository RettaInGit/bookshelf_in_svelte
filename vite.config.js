import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Turn the prerendered page into an extension page: 'tabs.html' (as referenced by
// background.js) with the SvelteKit bootstrap moved out of the document, since MV3
// blocks inline scripts (CSP 'script-src self').
function extensionPagePlugin() {
	return {
		name: 'extension-page',
		closeBundle() {
			const indexPath = resolve('build/index.html');
			const tabsPath = resolve('build/tabs.html');

			if (existsSync(indexPath)) renameSync(indexPath, tabsPath);
			if (!existsSync(tabsPath)) return;  // not this build step

			const html = readFileSync(tabsPath, 'utf-8');
			const inlineScript = html.match(/[ \t]*<script>([\s\S]*?)<\/script>/);
			if (!inlineScript) return;  // already extracted

			writeFileSync(resolve('build/tabs-init.js'), inlineScript[1].trim() + '\n');
			writeFileSync(tabsPath, html.replace(inlineScript[0], '\t\t\t<script src="./tabs-init.js"></script>'));
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), extensionPagePlugin()]
});
