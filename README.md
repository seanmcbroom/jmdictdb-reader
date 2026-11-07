# JMdictDB reader

[![lint](https://github.com/seanmcbroom/jmdictdb-reader/actions/workflows/lint.yml/badge.svg)](https://github.com/seanmcbroom/jmdictdb-reader/actions/workflows/lint.yml)

A Tampermonkey userscript that makes the [JMdictDB](https://www.edrdg.org/jmwsgi/) Submissions, Edits and Entry pages easier to read.

- Whole entries collapse to a one-line summary (`[+]`/`[-]`), and diff and history blocks can collapse too.
- A filter box, plus highlighting of a chosen editor's entries.
- Colorized diffs and theme and font presets, kept to a deliberately plain, old-web look.
- A Tools menu per entry (N-gram counts, Kotobank, Weblio, Eijiro, Wadoku, WWWJDIC, plus a copy-glosses-for-AI action), plus a cleaner N-gram results page with sorting, percentages and copy-as-text.
- Name/Email auto-fill on the edit form.

Nothing on the page is deleted; it's only collapsed.

## Demo

https://github.com/user-attachments/assets/044cf320-48ff-41f9-ac22-6af7df34566e

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open [jmdictdb-reader.user.js](https://raw.githubusercontent.com/seanmcbroom/jmdictdb-reader/main/jmdictdb-reader.user.js) and click **Install**.

Tampermonkey checks this URL for updates automatically.

## Development

```sh
npm install
npm run lint        # or: npm run lint:fix
```

There's no build step. To test a change, paste the script into Tampermonkey (or reinstall it from your branch's raw URL) and reload a JMdictDB page. Bump `@version` in the userscript header when releasing, since that's what tells installed copies to update.

## License

[GPL-3.0-or-later](LICENSE)
