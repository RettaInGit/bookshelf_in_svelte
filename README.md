# OVERVIEW

Turn your browser into an organized library! This extension acts like a personal bookshelf for your browser. Save your open pages, arrange them like books on a shelf, and instantly revisit them whenever you need. Download it from the [Chrome Web Store](https://chromewebstore.google.com/detail/bookshelf/bmgphchchbdajdapnomkmbhiolapbple).

This project is a new implementation of [bookshelf](https://github.com/RettaInGit/bookshelf), which I rewrote with the help of Claude Code. It uses SvelteKit, a full-stack framework, to maintain the code clear and the application fast.


# FEATURES

An enhanced version of [OneTab](https://www.one-tab.com/) where you can more easily change the order of your saved pages and also split them into multiple instances based on different conceptual areas (here called 'shelves').


# LICENSE

This is a [FOSS](https://en.wikipedia.org/wiki/Free_and_open-source_software) project, you can download and modify it as you like.


# HOW TO BUILD

Running `pnpm build` creates the `build` folder which contains the actual code used by this extension.


# FUTURE IMPLEMENTATIONS

- [x] Use the checkbox to multi-select the pages to drag and drop
- [x] Pin favorite books
- [x] Check duplicate pages inside a book
- [x] Sort pages or books by name
- [ ] ~~Visualize only X pages if there are more than X in a book~~
- [x] Add settings in the settings page
- [ ] ~~All text should be only in one row (add "..." at the end if it's too long)~~
- [ ] Page names should be editable