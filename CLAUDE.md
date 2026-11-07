# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Tampermonkey userscript, `jmdictdb-reader.user.js`, that restyles and enhances the JMdictDB web editor (`https://www.edrdg.org/jmwsgi/*`) and the companion Google N-gram lookup page (`https://www.edrdg.org/~jwb/cgi-bin/ngramlookup*`). There is no build step or test suite. `package.json` exists only for ESLint.

## Commands

- Lint: `npm run lint` (`npm run lint:fix` to autofix). Config is in `eslint.config.js`. CI (`.github/workflows/lint.yml`) runs lint plus `node --check jmdictdb-reader.user.js` on pushes and PRs to `main`.
- Testing is manual: paste the script into Tampermonkey and reload a matching edrdg.org page.
- Installed copies auto-update from the raw GitHub URL in `@updateURL`/`@downloadURL`, triggered by a higher `@version`. Bump it when shipping changes, and keep the `version` in `package.json` in step. Keep `@match`/`@grant` in sync with what the code uses (`GM_addStyle`, `GM_setValue`, `GM_getValue`, `GM_setClipboard`). If you add a new `GM_*` API, also add it to the globals in `eslint.config.js`.

## Architecture

The whole script is one IIFE split into numbered sections (search for `* N.` banners):

1. **Settings**: `DEFAULTS` is the schema for all persisted state. Any new setting must be added there, or it will be `undefined` after a fresh install or a reset. State is stored under `STORE_KEY` via `gmGet`/`gmSet`, which fall back to `localStorage` (`jmdcr:` prefix) when GM APIs are unavailable. `loadState` merges saved data over `DEFAULTS` and migrates legacy `theme`/`accent` keys via `legacyThemePreset`.
2. **Stylesheet**: `THEMES` (each preset has `mode` and a `colors` map) and `FONT_PRESETS`, plus one large `CSS` template string injected with `addStyle`. Every color is a CSS variable, so the CSS never hard-codes theme colors. Design intent: deliberately plain, "old-web" look with square corners, no shadows, and text-bracket badges like `[+]`/`[-]`.
4. **`applyState()`**: the single place that turns `state` into DOM. It maps each theme color key to a `--jmd-<kebab-key>` variable (`surface` becomes `--jmd-surface-2`), sets `data-jmd-*` attributes and classes on `<html>`, then calls `syncPanelControls()`. Settings handlers usually do `state.x = ...; saveState(); applyState();`.
5. **DOM enhancers** run once at init. They wrap the site's existing markup (`article.v-entr`, `div.hist`, `ol.hist-items`, diff `<pre>`s) with collapsers, filters and classes. Nothing is removed from the page, only collapsed or hidden. Collapsible groups follow a pattern: `buildXCollapsers` / `setXExpanded` / `setAllX` (entries, history, diffs).
   - `enhanceNgramPage()` is a separate mini-app for the N-gram lookup page. It runs only when the page title is `Google N-gram Corpus Counts`, and it adds checkboxes, sort, percentage bars and an East-Asian-width-aware plain-text export (`charWidth`/`displayWidth`/`padEndVisual`).
6. **Toolbar and settings panel**: `buildToolbar`/`wireToolbar` create the panel. `syncPanelControls` pushes `state` back into its inputs.
7. **`init()`**: on JMdictDB pages (detected by `header.jmd-header, main.jmd-content`) it adds `html.jmd-enhanced` and runs the enhancers. It always calls `enhanceNgramPage()` and `applyState()`.

## Conventions

- Scope page-specific CSS under `html.jmd-enhanced` or `html.jmd-ngram-page`, because the script's `@match` covers every page under `/jmwsgi/`.
- The site's own CSS often wins, so overrides use `!important`.
- In themes, keep `red`/`diffDel` visually distinct from `accent`, so deletions don't look like links.
- Build URLs with `encodeURIComponent` for user or headword text.
