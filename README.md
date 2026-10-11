# Folio EPUB Reader

Folio is a local-first, responsive EPUB-reader starter intended to be edited and deployed from an iPad browser.

## What works in this starter
- Import ordinary EPUB files into IndexedDB on the current browser/device
- Library grid, title/author metadata, search, sorting and progress bars
- EPUB rendering via epub.js, table of contents, page navigation
- Paper/light/sepia/dark themes, font size, line spacing and content width controls
- Bookmarks and reading-position persistence
- JSON backup export and backup restore (restore UI is not yet exposed; can be added next)
- PWA manifest and a service worker for the app shell

## Important limitations
- This starter loads epub.js from jsDelivr, so first use and EPUB rendering require internet access. For stronger offline support, bundle epub.js locally in a future build.
- Browser storage is device/browser-specific. Clearing Safari website data can delete the library. Export backups regularly.
- EPUB DRM is not supported.
- Highlighting, annotations, full-text search, AI summaries, series metadata editing and sync are planned additions, not implemented yet.
- EPUB layouts vary; test with your own files.

## Run it
The app must be served over HTTPS or localhost for service workers and PWA behaviour. The easiest iPad-only route:
1. Create a GitHub account if needed and create a new repository named `folio-reader`.
2. Upload all files from this folder to the repository root.
3. In the repository, open **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**, choose `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish the site. Open the published URL in Safari.
6. Test by importing a non-DRM EPUB.
7. In Safari tap **Share → Add to Home Screen**.

GitHub's UI can vary slightly on mobile. If uploading many files on iPad is awkward, use GitHub's web editor or upload the ZIP contents through the repository's Add file controls.

## Local data and backups
The EPUB files and progress live in IndexedDB in the current Safari origin. Use **Export library backup** before changing hosting URLs or clearing website data. A future version should add a restore button and optional encrypted sync.
