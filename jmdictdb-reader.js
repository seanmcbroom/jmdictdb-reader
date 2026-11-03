// ==UserScript==
// @name         JMdictDB — Cleaner Reader
// @namespace    https://www.edrdg.org/jmwsgi/
// @version      2.1.0
// @description  Tames JMdictDB's Submissions/Edits/Entry pages by making whole entries collapsible ([+]/[-] to a one-line summary), plus a filter box and light tidy-up. Diffs auto-collapse too, and each entry gets a one-click N-gram count lookup. Plain, old-web look on purpose — no cards, no shadows, no rounded pills. Nothing is deleted, only collapsed.
// @author       you
// @match        https://www.edrdg.org/jmwsgi/*
// @match        https://www.edrdg.org/~jwb/cgi-bin/ngramlookup*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  /* ================================================================
   * 1. SETTINGS: defaults, storage (GM_* with localStorage fallback)
   * ============================================================== */

  const DEFAULTS = {
    theme: 'auto',            // 'light' | 'dark' | 'auto'
    accent: 'classicblue',    // 'classicblue' | 'graphite' | 'green' | 'vermilion' | 'violet'
    fontSize: 13,             // px, 12-18
    density: 'compact',       // 'compact' | 'comfortable'
    collapseEntries: true,    // collapse each whole submission to one line by default (the main feature)
    collapseHistory: false,   // also collapse the History block inside an expanded entry
    collapseDiff: true,       // collapse each Diff block to a one-line [+] toggle by default
    diffHighlight: true,      // colorize +/-/@@ lines inside Diff blocks (text color only)
    capBlocks: true,          // cap the height of long Refs/Comments/Diff blocks
    capHeight: 260,           // px
    dimSearchOnly: true,      // visually de-emphasize sK / sk (search-only) forms
    highlightEditor: ''       // editor name to spot among many entries
  };

  const STORE_KEY = 'jmdictdb_cleaner_reader_settings_v2';

  function gmGet(key, fallback) {
    try { if (typeof GM_getValue === 'function') return GM_getValue(key, fallback); } catch (e) { }
    try {
      const raw = localStorage.getItem('jmdcr:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function gmSet(key, val) {
    try { if (typeof GM_setValue === 'function') { GM_setValue(key, val); return; } } catch (e) { }
    try { localStorage.setItem('jmdcr:' + key, JSON.stringify(val)); } catch (e) { }
  }

  function loadState() {
    const saved = gmGet(STORE_KEY, null);
    if (saved && typeof saved === 'object') return Object.assign({}, DEFAULTS, saved);
    return Object.assign({}, DEFAULTS);
  }
  function saveState() { gmSet(STORE_KEY, state); }

  let state = loadState();

  function addStyle(css) {
    try { if (typeof GM_addStyle === 'function') { GM_addStyle(css); return; } } catch (e) { }
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function gmClipboard(text) {
    try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(text); return; } } catch (e) { }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text); } catch (e) { }
  }

  /* ================================================================
   * 2. STYLESHEET
   *    Deliberately plain: flat colors, square corners, no shadows,
   *    no "card" boxes, text-bracket badges like [Active] / [+] / [-]
   *    instead of pills — closer to the site's own look, just tidied.
   * ============================================================== */

  const ACCENTS = {
    graphite: '#333333',
    slate: '#475569', // neutral gray
    emerald: '#16A34A', // vibrant green
    forest: '#15803D', // darker green
    sky: '#2563EB', // modern blue
    indigo: '#4F46E5', // soft violet-blue
    teal: '#0F766E', // blue-green
    white: '#dddfe2', // white
  };

  const CSS = `
  :root{
    --jmd-mono: ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
    --jmd-sans: Verdana, Geneva, Arial, Helvetica, sans-serif;
  }

  html{ --jmd-font-size: 13px; --jmd-accent: ${ACCENTS.graphite}; }

  /* ---- light theme tokens (default) ---- */
  html, html[data-jmd-theme="light"]{
    --jmd-bg: #ffffff;
    --jmd-surface-2: #f2f2f2;
    --jmd-border: #bbbbbb;
    --jmd-border-light: #dddddd;
    --jmd-text: #111111;
    --jmd-muted: #555555;
    --jmd-green: #006400;  --jmd-red: #a00000; --jmd-amber: #8a5a00;
    --jmd-diff-add: #006400; --jmd-diff-del: #a00000; --jmd-diff-hunk: #4a4a8a;
    --jmd-visited: #551A8B;
    --jmd-article: #E8FFF0;
  }
  html[data-jmd-theme="dark"]{
    --jmd-bg: #1c1c1c;
    --jmd-surface-2: #262626;
    --jmd-border: #444444;
    --jmd-border-light: #333333;
    --jmd-text: #dddddd;
    --jmd-muted: #999999;
    --jmd-green: #6fce6f;  --jmd-red: #e08080; --jmd-amber: #d3a44e;
    --jmd-diff-add: #6fce6f; --jmd-diff-del: #e08080; --jmd-diff-hunk: #9aa0e0;
    --jmd-visited: #c79ef0;
    --jmd-article: #202120;
  }

  /* density tokens */
  html{ --jmd-sp-1:3px; --jmd-sp-2:6px; --jmd-sp-3:9px; --jmd-sp-4:14px; }
  html[data-jmd-density="comfortable"]{ --jmd-sp-1:5px; --jmd-sp-2:9px; --jmd-sp-3:14px; --jmd-sp-4:20px; }

  /* ---- base page ---- */
  * { border-radius: 0 !important; box-shadow: none !important; }
  body{
    background: var(--jmd-bg) !important;
    color: var(--jmd-text) !important;
    font-family: var(--jmd-sans) !important;
    font-size: var(--jmd-font-size) !important;
    line-height: 1.4;
  }
  article {
    background: var(--jmd-article) !important;
  }
  main.jmd-content{ max-width: 900px; margin: var(--jmd-sp-4) auto; padding: 0 var(--jmd-sp-4); }
  a{ color: var(--jmd-accent); }
  a:visited{ color: var(--jmd-visited); }

  /* ---- header / footer ---- */
  header.jmd-header{ background: var(--jmd-surface-2); border-bottom: 1px solid var(--jmd-border); padding: var(--jmd-sp-3) var(--jmd-sp-4); }
  header.jmd-header .banner{ display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap: var(--jmd-sp-3); max-width:900px; margin:0 auto; }
  header.jmd-header h2{ font-size: .8em; font-weight:bold; color: var(--jmd-muted); margin:0 0 2px; }
  header.jmd-header h1{ font-size: 1.25em; margin:0; color: var(--jmd-text); }
  header.jmd-header .loginout{ font-size: .82em; color: var(--jmd-muted); }
  header.jmd-header .loginout table{ border-collapse:collapse; }
  header.jmd-header .loginout td{ padding:1px 4px; }
  header.jmd-header .loginout input[type="text"], header.jmd-header .loginout input[type="password"]{
    background: #fff; border:1px solid var(--jmd-border); color:#111; padding:1px 4px;
  }
  header.jmd-header .loginout input[type="submit"]{
    background: var(--jmd-surface-2); border:1px solid #888; padding:2px 8px; cursor:pointer; font-size:.95em;
  }

  nav.navlinks{ display:flex; flex-wrap:wrap; gap: var(--jmd-sp-2) 2px; align-items:center; max-width:900px; margin: var(--jmd-sp-2) auto 0; font-size:.86em; }
  nav.navlinks a{ text-decoration:underline; color: var(--jmd-accent); padding: 1px 6px; }

  footer{ background: var(--jmd-surface-2); border-top:1px solid var(--jmd-border); padding: var(--jmd-sp-4); margin-top: var(--jmd-sp-4); }
  footer .row{ max-width:900px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--jmd-sp-2); }
  footer .foottxt{ max-width:900px; margin: var(--jmd-sp-3) auto 0; font-size:.82em; color: var(--jmd-muted); }
  span.svc.navlinks{ font-size:.8em; color:var(--jmd-muted); font-family: var(--jmd-mono); }

  /* ---- one-time legend box ---- */
  article.v-entr > hr{ display:none; }
  section#notes{
    background: var(--jmd-surface-2); border: 1px solid var(--jmd-border);
    padding: var(--jmd-sp-3) var(--jmd-sp-4); margin: 0 0 var(--jmd-sp-4); font-size: .88em; color: var(--jmd-muted);
  }
  section#notes h2{ font-size:.85em; margin:0 0 6px; color: var(--jmd-text); }
  section#notes ul{ margin:0; padding-left:1.1em; }
  section#notes li{ margin-bottom:4px; }

  /* ---- entry: no card, just a hairline rule between entries ---- */
  article.v-entr{ border-bottom: 1px solid var(--jmd-border-light); padding: 10px;  }
  article.v-entr.jmd-mine{ border-left: 3px solid var(--jmd-accent); padding-left: var(--jmd-sp-3); }
  article.v-entr.jmd-filtered-out{ display:none !important; }
  article.v-entr.jmd-collapsed{ padding-bottom: var(--jmd-sp-2); }

  header.entry{ display:flex; align-items:baseline; flex-wrap:wrap; gap: var(--jmd-sp-2); }
  .jmd-entry-toggle{
    font-family: var(--jmd-mono); font-weight:bold; cursor:pointer; color: var(--jmd-accent);
    user-select:none; padding: 0 2px;
  }
  .jmd-entry-preview{ color: var(--jmd-muted); font-size: .95em; }
  .jmd-entry-preview b{ color: var(--jmd-text); }
  header.entry > span.abbr{ font-size:.75em; color: var(--jmd-muted); text-decoration:none; }
  header.entry > a{ font-weight:bold; font-family: var(--jmd-mono); color: var(--jmd-accent); }
  span.status{ font-weight:bold; }
  span.status.jmd-status-active{ color: var(--jmd-green); }
  span.status.jmd-status-deleted{ color: var(--jmd-red); }
  span.pend{ font-weight:bold; color: var(--jmd-amber); }
  span.pkid{ font-size:.85em; color: var(--jmd-muted); text-align:right; }
  span.email{ font-size:.9em; color: var(--jmd-muted); }

  div.jmd-entry-body{ margin-top: var(--jmd-sp-2); }

  /* headwords */
  div.kanj, div.rdng{ line-height:1.35; }
  div.kanj{ margin: var(--jmd-sp-1) 0 2px; }
  div.kanj span.kanj{ font-size: calc(var(--jmd-font-size) * 1.2); color: var(--jmd-text); }
  div.rdng{ color: var(--jmd-muted); font-size: calc(var(--jmd-font-size) * 1.05); margin-bottom: var(--jmd-sp-2); }
  .v-entr:not(:has(> div.kanj)) div.rdng{ color: var(--jmd-text); font-size: calc(var(--jmd-font-size) * 1.2); }
  div.conj{ display: none; }
  .jmd-entry-body > form[action="edform.py"]{ text-align: left !important; }
  span.kattrs, span.rattrs{ font-size:.75em; color: var(--jmd-muted); }
  html.jmd-dim-searchonly .kanj:has(+ span.kattrs [title="search-only kanji form"]){ opacity:.55; }
  html.jmd-dim-searchonly .rdng:has(+ span.rattrs [title="search-only kana form"]){ opacity:.55; }

  div.einfo{ font-size:.88em; font-style:italic; color: var(--jmd-muted); margin-bottom: var(--jmd-sp-2); }

  /* senses */
  ol.senses{ margin: var(--jmd-sp-2) 0; padding-left: 1.5em; }
  li.sense{ margin-bottom: var(--jmd-sp-2); }
  span.pos .abbr{ color: #2f5fb3; text-decoration: underline dotted; cursor: help; }
  html[data-jmd-theme="dark"] span.pos .abbr{ color:#8fb4f0; }
  span.misc .abbr{ color: var(--jmd-amber); text-decoration: underline dotted; cursor: help; }
  span.fld, span.dial{ font-size:.9em; color: var(--jmd-muted); font-style: italic; }
  div.note{ font-style: italic; color: var(--jmd-muted); font-size:.92em; margin: 2px 0; }
  ul.glosses{ margin: 3px 0 0; padding-left: 1.2em; }
  ul.glosses li{ margin-bottom: 1px; }
  span.ginf .abbr{ font-size:.85em; color: var(--jmd-muted); text-decoration:none; }

  div.xrefs{ font-size:.82em; color: var(--jmd-muted); margin-top:3px; }
  div.xrefs ul.xrefs{ font-size:1em; color: var(--jmd-text); margin: 2px 0 0; padding-left: 1.1em; }
  li.xref{ margin-bottom:2px; }

  /* edit button */
  form[action="edform.py"]{ text-align:right; margin: var(--jmd-sp-2) 0; }
  form[action="edform.py"] input[type="submit"]{
    background: var(--jmd-surface-2); border:1px solid #888; color: var(--jmd-text);
    padding:2px 10px; cursor:pointer; font-size:.85em;
  }
  div.conj{ margin: var(--jmd-sp-1) 0; font-size:.9em; }

  /* ---- history ---- */
  div.hist{ margin-top: var(--jmd-sp-3); border-top: 1px dotted var(--jmd-border); padding-top: var(--jmd-sp-2); }
  button.jmd-hist-toggle{
    display:inline; background:none; border:none; cursor:pointer; font: inherit;
    font-family: var(--jmd-mono); font-weight:bold; font-size:.9em; color: var(--jmd-accent); padding:0;
  }
  span.jmd-hist-count{ font-weight:normal; color: var(--jmd-muted); font-family: var(--jmd-sans); }

  ol.hist-items{ list-style:none; margin: var(--jmd-sp-2) 0 0; padding:0; }
  li.hist-item{ border-left: 2px solid var(--jmd-border-light); padding: var(--jmd-sp-1) 0 var(--jmd-sp-1) var(--jmd-sp-2); margin-bottom: 2px; }
  li.hist-item.jmd-hrow-a{ border-left-color: var(--jmd-green); }
  li.hist-item.jmd-hrow-astar{ border-left-color: var(--jmd-amber); }
  li.hist-item.jmd-hrow-d{ border-left-color: var(--jmd-muted); }
  li.hist-item.jmd-hrow-dstar{ border-left-color: var(--jmd-red); }
  li.hist-item > ul{ list-style:none; margin:0; padding:0; }
  li.header header{ display:flex; flex-wrap:wrap; gap:6px; align-items:baseline; font-size:.9em; }
  span.stat{ font-weight:bold; }
  span.stat.jmd-stat-a{ color: var(--jmd-green); }
  span.stat.jmd-stat-astar{ color: var(--jmd-amber); }
  span.stat.jmd-stat-d{ color: var(--jmd-muted); }
  span.stat.jmd-stat-dstar{ color: var(--jmd-red); }
  span.dt{ font-family: var(--jmd-mono); color: var(--jmd-muted); font-size:.95em; }
  span.name{ font-weight:bold; }

  li.comments, li.refs, li.diff{ margin-top:3px; }
  li.comments dt, li.refs dt, li.diff dt{ font-size:.75em; font-weight:bold; color: var(--jmd-muted); margin-bottom:0; }
  li.comments dl, li.refs dl, li.diff dl{ margin:0; }
  pre.preformat{
    font-family: var(--jmd-mono);
    font-size: calc(var(--jmd-font-size) * .85);
    line-height:1.25;
    background: var(--jmd-surface-2);
    border: 1px solid var(--jmd-border-light);
    padding: 4px 6px;
    margin:0;
    overflow-x: auto;
    overflow-y: auto;
    max-height: var(--jmd-pre-maxh, none);
    resize: vertical;
  }

  /* diff block collapsed to a [+]/[-] toggle — same idiom as the History toggle */
  button.jmd-diff-toggle{
    display:inline; background:none; border:none; cursor:pointer; font: inherit;
    font-family: var(--jmd-mono); font-weight:bold; font-size:.85em; color: var(--jmd-accent); padding:0;
  }
  span.jmd-diff-count{ font-weight:normal; color: var(--jmd-muted); font-family: var(--jmd-sans); }

  /* N-gram lookup link, styled as plain text to match the page's look */
  button.jmd-ngram-btn{
    display:inline; background:none; border:none; cursor:pointer; font: inherit;
    font-family: var(--jmd-sans); font-size:.78em; color: var(--jmd-accent); padding:0;
    text-decoration: underline; margin-left: 8px;
  }
  button.jmd-ngram-btn:hover{ color: var(--jmd-text); }

  /* diff line coloring: text color only, no background fill (toggle via html.jmd-diff-off) */
  span.d-add{ display:block; color: var(--jmd-diff-add); }
  span.d-del{ display:block; color: var(--jmd-diff-del); }
  span.d-hunk{ display:block; color: var(--jmd-diff-hunk); }
  span.d-ctx{ display:block; color: var(--jmd-muted); }
  html.jmd-diff-off span.d-add, html.jmd-diff-off span.d-del, html.jmd-diff-off span.d-hunk{ color:inherit; }

  li.hist-toggle{ margin-top:3px; }
  li.hist-toggle .fakelink{ font-size:.85em; color: var(--jmd-accent); cursor:pointer; text-decoration:underline; }

  /* alternate-format links */
  div.notes{ font-size:.82em; color: var(--jmd-muted); margin-top: var(--jmd-sp-2); }
  div.notes a.displink{ font-family: var(--jmd-mono); color: var(--jmd-accent); }

  /* ---- N-gram lookup results page (opened by the N-gram counts button) ---- */
  html.jmd-ngram-page body{ max-width: 480px; margin: 32px auto !important; padding: 0 18px; }
  html.jmd-ngram-page h2{ font-size: 1.15em; margin-bottom: var(--jmd-sp-3); }
  html.jmd-ngram-page table{ border-collapse: collapse; width:100%; margin: var(--jmd-sp-2) 0; }
  html.jmd-ngram-page table th{
    text-align:left; font-size:.72em; text-transform:uppercase; letter-spacing:.06em;
    color: var(--jmd-muted); padding: 3px 8px 6px; border-bottom: 2px solid var(--jmd-border);
  }
  html.jmd-ngram-page table th.jmd-ngram-num, html.jmd-ngram-page table th.jmd-ngram-share{ text-align:right; }
  html.jmd-ngram-page table th input[type="checkbox"]{ vertical-align:middle; }
  html.jmd-ngram-page table td{ padding: 6px 8px; font-size: 1em; border-bottom: 1px solid var(--jmd-border-light); }
  html.jmd-ngram-page td.jmd-ngram-term{ font-family: var(--jmd-sans); position:relative; }
  html.jmd-ngram-page tr.jmd-ngram-top td.jmd-ngram-term{ font-weight:bold; }
  html.jmd-ngram-page tr.jmd-ngram-top td.jmd-ngram-term::before{ content:"\u2605"; color: var(--jmd-accent); margin-right:5px; }
  html.jmd-ngram-page td.jmd-ngram-num{ font-family: var(--jmd-mono); text-align:right; }
  html.jmd-ngram-page td.jmd-ngram-check{ text-align:center; width:20px; padding: 6px 4px; }
  html.jmd-ngram-page td.jmd-ngram-share{ position:relative; text-align:right; font-family: var(--jmd-mono); min-width:80px; }
  html.jmd-ngram-page .jmd-ngram-bar{ position:absolute; inset:2px 0; z-index:0; transition: width .15s ease; }
  html.jmd-ngram-page .jmd-ngram-share-text{ position:relative; z-index:1; padding-right:8px; }
  html.jmd-ngram-page tr:has(> td > input[type="checkbox"]:not(:checked)) td:not(.jmd-ngram-check){ opacity:.45; }
  html.jmd-ngram-page .jmd-ngram-total{ font-size:.85em; color: var(--jmd-muted); text-align:right; margin: 4px 0 var(--jmd-sp-3); }
  html.jmd-ngram-page font{ font-size: .82em !important; color: var(--jmd-muted); }
  html.jmd-ngram-page a{ text-decoration: underline; }
  html.jmd-ngram-page .jmd-ngram-controls{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin: var(--jmd-sp-3) 0; font-size:.85em; }
  html.jmd-ngram-page .jmd-ngram-controls label{ display:flex; align-items:center; gap:4px; }
  html.jmd-ngram-page pre.jmd-ngram-preview{
    font-family: var(--jmd-mono); font-size: .82em; line-height:1.3; background: var(--jmd-surface-2);
    border: 1px solid var(--jmd-border-light); padding: 8px 10px; white-space: pre; overflow-x: auto;
  }

  /* ---- New Entry / Edit form (edform.py) ---- */
  article.v-edform textarea, article.v-edform input[type="text"], article.v-edform select{
    font-family: var(--jmd-mono); font-size: 1em; background: var(--jmd-bg); color: var(--jmd-text);
    border: 1px solid var(--jmd-border); padding: 3px 5px; box-sizing: border-box;
  }
  article.v-edform .row{ margin-bottom: var(--jmd-sp-3); }
  article.v-edform label{ font-weight:bold; }
  .jmd-autofilled{ background: var(--jmd-surface-2) !important; }

  /* ================================================================
   * 3. TOOLBAR + SETTINGS PANEL
   * ============================================================== */
  #jmd-toolbar{ position:sticky; top:0; z-index:999999; background: var(--jmd-surface-2); border-bottom:1px solid var(--jmd-border); }
  #jmd-toolbar-inner{ max-width:900px; margin:0 auto; display:flex; align-items:center; gap:8px; padding:5px 14px; flex-wrap:wrap; }
  #jmd-toolbar .jmd-brand{ font-weight:bold; color: var(--jmd-text); font-size:.9em; white-space:nowrap; }
  #jmd-toolbar .jmd-count{ font-size:.8em; color: var(--jmd-muted); white-space:nowrap; }
  #jmd-filter{ flex: 1 1 200px; min-width:140px; background:#fff; border:1px solid var(--jmd-border); padding:3px 6px; color:#111; font-size:.88em; }
  html[data-jmd-theme="dark"] #jmd-filter{ background: var(--jmd-surface-2); color: var(--jmd-text); }
  .jmd-btn{ background: var(--jmd-surface-2); border:1px solid #888; color: var(--jmd-text); padding:3px 9px; font-size:.82em; cursor:pointer; }
  .jmd-btn:hover{ border-color: var(--jmd-accent); }

  #jmd-settings-panel{
    position:absolute; top:100%; right:14px; margin-top:2px; width:280px; max-height:80vh; overflow:auto;
    background: var(--jmd-bg); border:1px solid var(--jmd-border); padding: 10px; font-size:.86em;
  }
  #jmd-settings-panel[hidden]{ display:none; }
  .jmd-panel-section{ margin-bottom:10px; }
  .jmd-panel-section > label{ display:block; font-weight:bold; margin-bottom:4px; color: var(--jmd-text); }
  .jmd-check-row label{ display:flex; align-items:center; gap:6px; font-weight:normal; }
  .jmd-segmented{ display:flex; border:1px solid var(--jmd-border); }
  .jmd-segmented button{ flex:1; background: var(--jmd-bg); border:none; padding:3px 0; cursor:pointer; color: var(--jmd-text); font-size:.92em; }
  .jmd-segmented button + button{ border-left:1px solid var(--jmd-border); }
  .jmd-segmented button.jmd-active{ background: var(--jmd-accent); color:#fff; }
  .jmd-swatches{ display:flex; gap:6px; }
  .jmd-swatches button{ width:18px; height:18px; border:2px solid var(--jmd-border); background: var(--sw); cursor:pointer; padding:0; }
  .jmd-swatches button.jmd-active{ border-color: var(--jmd-text); }
  #jmd-opt-editor, #jmd-opt-capHeight, #jmd-opt-myname, #jmd-opt-myemail{ background:#fff; border:1px solid var(--jmd-border); padding:3px 6px; color:#111; box-sizing:border-box; }
  html[data-jmd-theme="dark"] #jmd-opt-editor, html[data-jmd-theme="dark"] #jmd-opt-capHeight,
  html[data-jmd-theme="dark"] #jmd-opt-myname, html[data-jmd-theme="dark"] #jmd-opt-myemail{ background: var(--jmd-surface-2); color: var(--jmd-text); }
  #jmd-opt-editor, #jmd-opt-myname, #jmd-opt-myemail{ width:100%; }
  #jmd-opt-capHeight{ width:60px; margin-left:6px; }
  .jmd-panel-actions{ text-align:right; }
  input[type="range"]{ width:100%; }

  #jmd-top-btn{
    position:fixed; right:14px; bottom:14px; z-index:999999;
    background: var(--jmd-surface-2); color: var(--jmd-text); border:1px solid #888; padding:3px 8px; font-size:.8em; cursor:pointer;
    opacity:0; pointer-events:none; transition: opacity .1s linear;
  }
  #jmd-top-btn.jmd-visible{ opacity:1; pointer-events:auto; }

  @media (prefers-reduced-motion: reduce){ #jmd-top-btn{ transition:none !important; } }
  `;

  addStyle(CSS);

  /* ================================================================
   * 4. APPLY STATE -> CSS VARIABLES / DOM CLASSES
   * ============================================================== */

  function effectiveTheme() {
    if (state.theme === 'auto') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return state.theme;
  }

  function applyState() {
    const html = document.documentElement;
    html.setAttribute('data-jmd-theme', effectiveTheme());
    html.setAttribute('data-jmd-density', state.density);
    html.style.setProperty('--jmd-font-size', state.fontSize + 'px');
    html.style.setProperty('--jmd-accent', ACCENTS[state.accent] || ACCENTS.graphite);
    html.style.setProperty('--jmd-pre-maxh', state.capBlocks ? state.capHeight + 'px' : 'none');
    html.classList.toggle('jmd-diff-off', !state.diffHighlight);
    html.classList.toggle('jmd-dim-searchonly', !!state.dimSearchOnly);
    applyEditorHighlight(state.highlightEditor);
    syncPanelControls();
  }

  /* ================================================================
   * 5. DOM ENHANCERS (run once)
   * ============================================================== */

  function classifyStatusAndStat() {
    document.querySelectorAll('span.status').forEach(el => {
      const t = el.textContent.trim().toLowerCase();
      el.classList.add(t === 'active' ? 'jmd-status-active' : (t === 'deleted' ? 'jmd-status-deleted' : 'jmd-status-other'));
    });
    document.querySelectorAll('span.stat').forEach(el => {
      const t = el.textContent.trim();
      let cls = 'jmd-stat-other', row = 'jmd-hrow-other';
      if (t === 'A') { cls = 'jmd-stat-a'; row = 'jmd-hrow-a'; }
      else if (t === 'A*') { cls = 'jmd-stat-astar'; row = 'jmd-hrow-astar'; }
      else if (t === 'D') { cls = 'jmd-stat-d'; row = 'jmd-hrow-d'; }
      else if (t === 'D*') { cls = 'jmd-stat-dstar'; row = 'jmd-hrow-dstar'; }
      el.classList.add(cls);
      const li = el.closest('li.hist-item');
      if (li) li.classList.add(row);
    });
  }

  // Fix: the site's native "(show/hide N older history records)" link calls
  // a single global toggle_visibility('hide') that toggles EVERY hidden
  // history row on the whole page. We rescope each one to just its own entry.
  function fixOlderHistoryToggle() {
    document.querySelectorAll('li.hist-toggle .fakelink').forEach(link => {
      link.removeAttribute('onclick');
      link.setAttribute('role', 'button');
      link.setAttribute('tabindex', '0');
      const activate = () => {
        const ol = link.closest('ol.hist-items');
        if (!ol) return;
        ol.querySelectorAll(':scope > li.hist-item.hide').forEach(li => {
          li.style.display = (li.style.display === 'none') ? '' : 'none';
        });
      };
      link.addEventListener('click', activate);
      link.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    });
  }

  // Wrap each entry's "History:" label in a [+]/[-] collapsible toggle.
  function buildHistoryCollapsers() {
    document.querySelectorAll('div.hist').forEach(div => {
      const ol = div.querySelector(':scope > ol.hist-items');
      if (!ol) return;
      const labelNode = Array.from(div.childNodes).find(n => n.nodeType === 3 && /History/.test(n.textContent));
      const count = ol.querySelectorAll(':scope > li.hist-item').length;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jmd-hist-toggle';
      const expanded = !state.collapseHistory;
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.innerHTML = '[' + (expanded ? '\u2212' : '+') + '] History <span class="jmd-hist-count">(' + count + ' revision' + (count === 1 ? '' : 's') + ')</span>';

      btn.addEventListener('click', () => setHistoryExpanded(btn, ol, btn.getAttribute('aria-expanded') !== 'true'));

      if (labelNode) { div.insertBefore(btn, labelNode); labelNode.remove(); }
      else div.insertBefore(btn, ol);

      ol.style.display = expanded ? '' : 'none';
    });
  }

  function setHistoryExpanded(btn, ol, expanded) {
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.innerHTML = '[' + (expanded ? '\u2212' : '+') + '] History ' + btn.querySelector('.jmd-hist-count').outerHTML;
    ol.style.display = expanded ? '' : 'none';
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // A plain character-count .padEnd()/.padStart() misaligns the moment you
  // mix single-width (ASCII header labels, digits) with double-width
  // (Japanese) text in the same column -- which is exactly why every
  // hand-made ngram table in the wild skips headers entirely. Doing the
  // width math properly means we don't have to make that trade-off.
  function charWidth(ch) {
    const c = ch.codePointAt(0);
    const wide =
      (c >= 0x1100 && c <= 0x115F) ||                  // Hangul Jamo
      (c >= 0x2E80 && c <= 0x303E) ||                  // CJK radicals / symbols & punctuation
      (c >= 0x3041 && c <= 0x33FF) ||                  // Hiragana .. CJK compatibility
      (c >= 0x3400 && c <= 0x4DBF) ||                  // CJK ext A
      (c >= 0x4E00 && c <= 0x9FFF) ||                  // CJK unified ideographs
      (c >= 0xAC00 && c <= 0xD7A3) ||                  // Hangul syllables
      (c >= 0xF900 && c <= 0xFAFF) ||                  // CJK compatibility ideographs
      (c >= 0xFF00 && c <= 0xFF60) ||                  // fullwidth forms (Ａ Ｖ etc, not halfwidth kana)
      (c >= 0xFFE0 && c <= 0xFFE6);
    return wide ? 2 : 1;
  }
  function displayWidth(str) {
    let w = 0;
    for (const ch of str) w += charWidth(ch);
    return w;
  }
  function padEndVisual(str, width) { return str + ' '.repeat(Math.max(0, width - displayWidth(str))); }
  function padStartVisual(str, width) { return ' '.repeat(Math.max(0, width - displayWidth(str))) + str; }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // Absolute-scale ASCII bar: length is the term's literal share of 100%,
  // not relative to the top term, so two lists never look misleadingly
  // similar just because their top term happens to dominate either way.
  // Uses the eighth-block characters for sub-character precision so a
  // small-but-real share (e.g. 0.6%) still shows a sliver instead of
  // rounding away to nothing.
  const BAR_WIDTH = 20;
  const EIGHTHS = [' ', '\u258F', '\u258E', '\u258D', '\u258C', '\u258B', '\u258A', '\u2589', '\u2588'];
  function buildBar(pct) {
    const exact = (pct / 100) * BAR_WIDTH;
    const full = Math.min(BAR_WIDTH, Math.floor(exact));
    const frac = Math.round((exact - full) * 8);
    let bar = '\u2588'.repeat(full);
    if (frac > 0 && full < BAR_WIDTH) bar += '\u2588';
    return bar;
  }

  // Wrap each line of a Diff block in a <span> so CSS can colorize
  // added/removed/hunk-header lines. Non-destructive: only re-wraps text.
  function highlightDiffs() {
    document.querySelectorAll('li.diff pre.preformat').forEach(pre => {
      if (pre.dataset.jmdHl) return;
      const lines = pre.textContent.split('\n');
      pre.innerHTML = lines.map(line => {
        let cls = 'd-ctx';
        if (line.startsWith('@@')) cls = 'd-hunk';
        else if (line.startsWith('+')) cls = 'd-add';
        else if (line.startsWith('-')) cls = 'd-del';
        return '<span class="' + cls + '">' + escapeHtml(line) + '</span>';
      }).join('\n');
      pre.dataset.jmdHl = '1';
    });
  }

  // Diff blocks are the biggest, noisiest part of a history item (a full
  // unified diff), so collapse each one to a one-line [+] toggle with an
  // added/removed line-count preview — same idiom as the History toggle.
  function diffLineStats(text) {
    let add = 0, del = 0;
    text.split('\n').forEach(line => {
      if (line.startsWith('+') && !line.startsWith('+++')) add++;
      else if (line.startsWith('-') && !line.startsWith('---')) del++;
    });
    return { add, del };
  }

  function diffToggleLabel(expanded, statsHtml) {
    return '[' + (expanded ? '\u2212' : '+') + '] Diff' + (statsHtml ? ' ' + statsHtml : '');
  }

  function buildDiffCollapsers() {
    document.querySelectorAll('li.diff').forEach(li => {
      if (li.dataset.jmdWrapped) return;
      const dt = li.querySelector('dt');
      const dd = li.querySelector('dd');
      if (!dt || !dd) return;

      const pre = dd.querySelector('pre.preformat');
      let statsSpan = '';
      if (pre) {
        const { add, del } = diffLineStats(pre.textContent);
        const bits = [];
        if (add) bits.push('+' + add);
        if (del) bits.push('\u2212' + del);
        if (bits.length) statsSpan = '<span class="jmd-diff-count">(' + bits.join(' ') + ')</span>';
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jmd-diff-toggle';
      const expanded = !state.collapseDiff;
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.innerHTML = diffToggleLabel(expanded, statsSpan);

      btn.addEventListener('click', () => setDiffExpanded(btn, dd, btn.getAttribute('aria-expanded') !== 'true'));

      dt.replaceWith(btn);
      dd.style.display = expanded ? '' : 'none';
      li.dataset.jmdWrapped = '1';
    });
  }

  function setDiffExpanded(btn, dd, expanded) {
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    const stats = btn.querySelector('.jmd-diff-count');
    btn.innerHTML = diffToggleLabel(expanded, stats ? stats.outerHTML : '');
    dd.style.display = expanded ? '' : 'none';
  }

  function setAllDiffs(expanded) {
    document.querySelectorAll('li.diff .jmd-diff-toggle').forEach(btn => {
      const li = btn.closest('li.diff');
      const dd = li && li.querySelector('dd');
      if (dd) setDiffExpanded(btn, dd, expanded);
    });
  }

  // "N-gram counts" button per entry: gathers every kanji/reading headword
  // form, copies them (space-separated — the lookup tool's own multi-term
  // syntax) to the clipboard, and opens the tool so the counts are one
  // paste + submit away. edrdg.org doesn't publish the lookup form's field
  // names, so a true one-click deep link risked silently breaking — this
  // is the safer, still one-click-to-the-hard-part version.
  function buildNgramButtons() {
    document.querySelectorAll('article.v-entr').forEach(article => {
      if (article.dataset.jmdNgram) return;
      const terms = [];
      article.querySelectorAll('div.kanj span.kanj, div.rdng span.rdng').forEach(el => {
        const t = el.textContent.trim();
        if (t && !terms.includes(t)) terms.push(t);
      });
      if (!terms.length) return;

      const anchor = article.querySelector('div.rdng') || article.querySelector('div.kanj');
      if (!anchor) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'jmd-ngram-btn';
      btn.textContent = 'N-gram counts';
      btn.title = 'Copy "' + terms.join(' ') + '" and open the Google N-gram lookup tool';

      btn.addEventListener('click', () => {
        window.open(`https://www.edrdg.org/~jwb/cgi-bin/ngramlookup?sent=${terms.join('+')}`, '_blank', 'noopener');
      });

      anchor.appendChild(btn);
      article.dataset.jmdNgram = '1';
    });
  }

  // The N-gram lookup tool (opened by the "N-gram counts" button) returns a
  // bare, 1990s-style HTML page with a plain <TABLE> of word/count/percent.
  // This adds per-row checkboxes to include/exclude terms from the percentage
  // math, a sort button, and a copy-to-clipboard that exports a plain
  // markdown-style pipe table (with a live preview) — easy to read as flat
  // text and with no character-width math to get wrong for mixed-width terms.
  function enhanceNgramPage() {
    if (document.title.trim() !== 'Google N-gram Corpus Counts') return;
    document.documentElement.classList.add('jmd-ngram-page');

    const table = document.querySelector('table');
    if (!table || table.dataset.jmdWrapped) return;
    table.dataset.jmdWrapped = '1';

    const WORD_COL = 0, COUNT_COL = 1, PERC_COL = 2;
    const accentHex = ACCENTS[state.accent] || ACCENTS.classicblue;
    const barColor = hexToRgba(accentHex, 0.16);

    function dataRows() { return Array.from(table.querySelectorAll('tr:not(.jmd-ngram-headrow)')); }

    // comma-format the raw counts, stashing the numeric value for later math
    dataRows().forEach(row => {
      const cell = row.cells[COUNT_COL];
      if (!cell) return;
      const n = parseInt(cell.textContent, 10);
      cell.dataset.count = Number.isNaN(n) ? 0 : n;
      cell.textContent = (Number.isNaN(n) ? 0 : n).toLocaleString('en-US');
      cell.className = 'jmd-ngram-num';
    });

    // guarantee a percentage column, then add an include/exclude checkbox
    dataRows().forEach(row => {
      while (row.cells.length < 3) { row.insertCell(); }
      row.cells[PERC_COL].className = 'jmd-ngram-share';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', displayPercentages);
      const cbCell = row.insertCell();
      cbCell.className = 'jmd-ngram-check';
      cbCell.appendChild(cb);
      row.cells[WORD_COL].className = 'jmd-ngram-term';
    });

    // mark the single highest-count row, regardless of checked state
    let topRow = null, topCount = -1;
    dataRows().forEach(row => {
      const n = Number(row.cells[COUNT_COL].dataset.count);
      if (n > topCount) { topCount = n; topRow = row; }
    });
    if (topRow) topRow.classList.add('jmd-ngram-top');

    function renderShareCell(row, pct, active) {
      const cell = row.cells[PERC_COL];
      cell.innerHTML = '';
      const bar = document.createElement('div');
      bar.className = 'jmd-ngram-bar';
      bar.style.width = (active ? pct : 0) + '%';
      bar.style.background = barColor;
      const text = document.createElement('span');
      text.className = 'jmd-ngram-share-text';
      text.textContent = active ? (pct.toFixed(1) + '%') : '\u2014';
      cell.appendChild(bar);
      cell.appendChild(text);
    }

    function displayPercentages() {
      let total = 0;
      dataRows().forEach(row => {
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) total += Number(row.cells[COUNT_COL].dataset.count);
      });
      dataRows().forEach(row => {
        const cb = row.querySelector('input[type="checkbox"]');
        const checked = !!(cb && cb.checked);
        const count = Number(row.cells[COUNT_COL].dataset.count);
        if (checked && total > 0) {
          const pct = (count * 100) / total;
          row.cells[PERC_COL].dataset.pct = pct.toFixed(1);
          renderShareCell(row, pct, true);
        } else {
          row.cells[PERC_COL].dataset.pct = '';
          renderShareCell(row, 0, false);
        }
      });
      const totalEl = document.getElementById('jmd-ngram-total');
      if (totalEl) totalEl.textContent = 'Total (checked): ' + total.toLocaleString('en-US');
      refreshPreview();
    }

    function isKana(text) {
      for (const ch of text) { if (ch < '\u3041' || ch > '\u30FF') return false; }
      return true;
    }

    function sortTable() {
      dataRows().sort((a, b) => {
        const aKana = isKana(a.cells[WORD_COL].textContent);
        const bKana = isKana(b.cells[WORD_COL].textContent);
        const aCount = Number(a.cells[COUNT_COL].dataset.count);
        const bCount = Number(b.cells[COUNT_COL].dataset.count);
        if (aKana === bKana) return bCount - aCount;
        return aKana ? 1 : -1;
      }).forEach(tr => table.appendChild(tr));
      refreshPreview();
    }

    // A tidy, properly-aligned plain table for the clipboard: real column
    // widths (East-Asian-width aware), right-aligned numbers, no header --
    // the term/count/share order is obvious enough on its own. Includes an
    // absolute-scale bar so the shape of the distribution is visible too,
    // not just the raw numbers.
    function tableToText() {
      let withPct = false;
      dataRows().forEach(row => {
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) withPct = true;
      });

      const rows = dataRows().map(row => {
        const pct = row.cells[PERC_COL].dataset.pct;
        return {
          term: row.cells[WORD_COL].textContent.trim(),
          count: row.cells[COUNT_COL].textContent.trim(),
          share: withPct ? (pct ? pct + '%' : '\u2014') : '',
          bar: withPct && pct ? buildBar(parseFloat(pct)) : ''
        };
      });

      const GAP = ' ';
      const termW = Math.max(...rows.map(r => displayWidth(r.term)));
      const countW = Math.max(...rows.map(r => displayWidth(r.count)));
      const shareW = withPct ? Math.max(...rows.map(r => displayWidth(r.share))) : 0;

      const lines = [];
      const title = (document.querySelector('h2') || {}).textContent.trim();
      if (title) { lines.push(title, ''); }

      rows.forEach(r => {
        let line = padEndVisual(r.term, termW) + GAP + padStartVisual(r.count, countW);
        if (withPct) line += GAP + padEndVisual(r.bar, BAR_WIDTH) + GAP + padStartVisual(r.share, shareW);
        lines.push(line);
      });

      return lines.join('\n');
    }

    function refreshPreview() {
      const pre = document.getElementById('jmd-ngram-preview');
      if (pre) pre.textContent = tableToText();
    }

    // real header row, with a "select all" checkbox up front
    const headRow = document.createElement('tr');
    headRow.className = 'jmd-ngram-headrow';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.checked = true;
    selectAll.title = 'Toggle all rows';
    selectAll.addEventListener('change', () => {
      dataRows().forEach(row => { row.querySelector('input[type="checkbox"]').checked = selectAll.checked; });
      displayPercentages();
    });
    const thCheck = document.createElement('th'); thCheck.appendChild(selectAll);
    const thTerm = document.createElement('th'); thTerm.textContent = 'Term';
    const thCount = document.createElement('th'); thCount.textContent = 'Count'; thCount.className = 'jmd-ngram-num';
    const thShare = document.createElement('th'); thShare.textContent = 'Share'; thShare.className = 'jmd-ngram-share';
    headRow.append(thTerm, thCount, thShare, thCheck);
    table.insertBefore(headRow, table.firstChild);

    const total = document.createElement('div');
    total.id = 'jmd-ngram-total';
    total.className = 'jmd-ngram-total';
    table.after(total);

    const controls = document.createElement('div');
    controls.className = 'jmd-ngram-controls';
    controls.innerHTML = `
      <button type="button" id="jmd-ngram-copy" class="jmd-btn">Copy to clipboard</button>`;
    total.after(controls);

    const preview = document.createElement('pre');
    preview.className = 'jmd-ngram-preview';
    preview.id = 'jmd-ngram-preview';
    controls.after(preview);

    controls.querySelector('#jmd-ngram-copy').addEventListener('click', function () {
      gmClipboard(tableToText());
      const btn = this;
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1200);
    });

    sortTable();
    displayPercentages(); // also renders the first preview
  }

  // Remove the plain " | " separators between nav links.
  function tidyNavSeparators() {
    document.querySelectorAll('nav.navlinks').forEach(nav => {
      Array.from(nav.childNodes).forEach(n => {
        if (n.nodeType === 3 && n.textContent.trim() === '|') n.remove();
      });
    });
  }

  // The main feature: collapse each whole submission down to one line
  // (seq# / status / headword / first gloss), with a [+] to expand it.
  function buildEntryCollapsers() {
    document.querySelectorAll('article.v-entr').forEach(article => {
      if (article.dataset.jmdWrapped) return;
      const headerEntry = article.querySelector(':scope > header.entry');
      if (!headerEntry) return;

      let headword = '';
      const kanjEl = article.querySelector(':scope > div.kanj span.kanj');
      const rdngEl = article.querySelector(':scope > div.rdng span.rdng');
      if (kanjEl) headword = kanjEl.textContent.trim();
      else if (rdngEl) headword = rdngEl.textContent.trim();

      let gloss = '';
      const glossEl = article.querySelector(':scope > ol.senses li.sense ul.glosses li');
      if (glossEl) gloss = glossEl.textContent.trim();
      if (gloss.length > 70) gloss = gloss.slice(0, 68) + '\u2026';

      // Move everything after header.entry into a collapsible body.
      const body = document.createElement('div');
      body.className = 'jmd-entry-body';
      let node = headerEntry.nextSibling;
      while (node) { const next = node.nextSibling; body.appendChild(node); node = next; }
      article.appendChild(body);

      const toggle = document.createElement('span');
      toggle.className = 'jmd-entry-toggle';
      toggle.textContent = '[+]';
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');

      const preview = document.createElement('span');
      preview.className = 'jmd-entry-preview';
      preview.innerHTML = (headword ? '<b>' + escapeHtml(headword) + '</b> ' : '') + escapeHtml(gloss);

      headerEntry.insertBefore(toggle, headerEntry.firstChild);
      headerEntry.appendChild(preview);

      const setExpanded = (expanded) => {
        body.style.display = expanded ? '' : 'none';
        preview.style.display = expanded ? 'none' : '';
        toggle.textContent = expanded ? '[\u2212]' : '[+]';
        article.classList.toggle('jmd-collapsed', !expanded);
      };
      toggle.addEventListener('click', () => setExpanded(body.style.display === 'none'));
      toggle.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(body.style.display === 'none'); }
      });

      article._jmdSetExpanded = setExpanded;
      setExpanded(!state.collapseEntries);
      article.dataset.jmdWrapped = '1';
    });
  }

  function setAllEntries(expanded) {
    document.querySelectorAll('article.v-entr').forEach(a => { if (a._jmdSetExpanded) a._jmdSetExpanded(expanded); });
  }

  function countEntries() {
    const all = document.querySelectorAll('article.v-entr');
    let deleted = 0, pending = 0;
    all.forEach(a => {
      if (a.querySelector('.jmd-status-deleted')) deleted++;
      if (a.querySelector('span.pend')) pending++;
    });
    return { total: all.length, deleted, pending };
  }

  function updateCounter(shown) {
    const el = document.getElementById('jmd-count');
    if (!el) return;
    const c = countEntries();
    let txt = c.total + (c.total === 1 ? ' entry' : ' entries');
    const bits = [];
    if (c.pending) bits.push(c.pending + ' pending');
    if (c.deleted) bits.push(c.deleted + ' deleted');
    if (bits.length) txt += ' (' + bits.join(', ') + ')';
    if (typeof shown === 'number' && shown !== c.total) txt = shown + ' / ' + txt;
    el.textContent = txt;
  }

  // While filtering, auto-expand matches so it's obvious why they matched;
  // collapse back to the default state once the filter is cleared.
  function applyFilter(query) {
    const q = query.trim().toLowerCase();
    const entries = document.querySelectorAll('article.v-entr');
    let shown = 0;
    entries.forEach(a => {
      const match = !q || a.textContent.toLowerCase().includes(q);
      a.classList.toggle('jmd-filtered-out', !match);
      if (match) {
        shown++;
        if (a._jmdSetExpanded) a._jmdSetExpanded(q ? true : !state.collapseEntries);
      }
    });
    updateCounter(shown);
  }

  function applyEditorHighlight(name) {
    const n = (name || '').trim().toLowerCase();
    document.querySelectorAll('article.v-entr').forEach(a => {
      if (!n || n.length < 2) { a.classList.remove('jmd-mine'); return; }
      let found = false;
      a.querySelectorAll('.hist-item .name').forEach(el => {
        if (el.textContent.trim().toLowerCase().includes(n)) found = true;
      });
      a.classList.toggle('jmd-mine', found);
    });
  }

  /* ================================================================
   * 6. TOOLBAR + SETTINGS PANEL UI
   * ============================================================== */

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.id = 'jmd-toolbar';
    bar.innerHTML = `
      <div id="jmd-toolbar-inner">
        <span class="jmd-brand">JMdictDB</span>
        <span id="jmd-count" class="jmd-count"></span>
        <input id="jmd-filter" type="search" placeholder="Filter by seq#, word, reading, editor, gloss\u2026" />
        <button id="jmd-expand-all" class="jmd-btn" type="button">Expand all</button>
        <button id="jmd-collapse-all" class="jmd-btn" type="button">Collapse all</button>
        <button id="jmd-theme-btn" class="jmd-btn" type="button" title="Toggle light/dark">theme</button>
        <button id="jmd-settings-btn" class="jmd-btn" type="button" title="Settings">settings</button>
        <div id="jmd-settings-panel" hidden>
          <div class="jmd-panel-section">
            <label>Theme</label>
            <div class="jmd-segmented" data-role="theme">
              <button type="button" data-value="light">Light</button>
              <button type="button" data-value="dark">Dark</button>
              <button type="button" data-value="auto">Auto</button>
            </div>
          </div>
          <div class="jmd-panel-section">
            <label>Accent color</label>
            <div class="jmd-swatches" data-role="accent">
              <button type="button" data-value="graphite" style="--sw:${ACCENTS.graphite}" title="Graphite"></button>
              <button type="button" data-value="slate" style="--sw:${ACCENTS.slate}" title="Slate"></button>
              <button type="button" data-value="emerald" style="--sw:${ACCENTS.emerald}" title="Emerald"></button>
              <button type="button" data-value="forest" style="--sw:${ACCENTS.forest}" title="Forest"></button>
              <button type="button" data-value="sky" style="--sw:${ACCENTS.sky}" title="Sky"></button>
              <button type="button" data-value="indigo" style="--sw:${ACCENTS.indigo}" title="Indigo"></button>
              <button type="button" data-value="teal" style="--sw:${ACCENTS.teal}" title="Teal"></button>
              <button type="button" data-value="white" style="--sw:${ACCENTS.white}" title="White"></button>
            </div>
          </div>
          <div class="jmd-panel-section">
            <label>Text size (<span id="jmd-fontsize-val"></span>px)</label>
            <input type="range" id="jmd-fontsize" min="12" max="18" step="1">
          </div>
          <div class="jmd-panel-section">
            <label>Density</label>
            <div class="jmd-segmented" data-role="density">
              <button type="button" data-value="compact">Compact</button>
              <button type="button" data-value="comfortable">Comfortable</button>
            </div>
          </div>
          <div class="jmd-panel-section jmd-check-row">
            <label><input type="checkbox" id="jmd-opt-collapseEntries"> Collapse submissions by default</label>
          </div>
          <div class="jmd-panel-section jmd-check-row">
            <label><input type="checkbox" id="jmd-opt-collapseHistory"> Also collapse History when expanded</label>
          </div>
          <div class="jmd-panel-section jmd-check-row">
            <label><input type="checkbox" id="jmd-opt-collapseDiff"> Collapse diffs by default</label>
          </div>
          <div class="jmd-panel-section jmd-check-row">
            <label><input type="checkbox" id="jmd-opt-diffHighlight"> Colorize diffs</label>
          </div>
          <div class="jmd-panel-section jmd-check-row">
            <label><input type="checkbox" id="jmd-opt-capBlocks"> Cap long refs/diff blocks at <input type="number" id="jmd-opt-capHeight" min="120" max="1000" step="20">px</label>
          </div>
          <div class="jmd-panel-section jmd-check-row">
            <label><input type="checkbox" id="jmd-opt-dimSearchOnly"> Dim search-only forms (sK / sk)</label>
          </div>
          <div class="jmd-panel-section">
            <label>Highlight an editor's entries</label>
            <input type="text" id="jmd-opt-editor" placeholder="e.g. your username">
          </div>
          <div class="jmd-panel-section">
            <label>Auto-fill on New Entry / Edit forms</label>
            <input type="text" id="jmd-opt-myname" placeholder="Your name" style="margin-bottom:6px;">
            <input type="text" id="jmd-opt-myemail" placeholder="Your email">
          </div>
          <div class="jmd-panel-section jmd-panel-actions">
            <button type="button" id="jmd-reset-btn" class="jmd-btn">Reset to defaults</button>
          </div>
        </div>
      </div>`;
    document.body.insertBefore(bar, document.body.firstChild);
    wireToolbar(bar);
    updateCounter();
  }

  function wireToolbar(bar) {
    const panel = bar.querySelector('#jmd-settings-panel');
    const settingsBtn = bar.querySelector('#jmd-settings-btn');

    settingsBtn.addEventListener('click', e => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
    });
    document.addEventListener('click', e => {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== settingsBtn) panel.hidden = true;
    });

    let filterTimer = null;
    bar.querySelector('#jmd-filter').addEventListener('input', e => {
      clearTimeout(filterTimer);
      const v = e.target.value;
      filterTimer = setTimeout(() => applyFilter(v), 120);
    });

    bar.querySelector('#jmd-expand-all').addEventListener('click', () => setAllEntries(true));
    bar.querySelector('#jmd-collapse-all').addEventListener('click', () => setAllEntries(false));

    bar.querySelector('#jmd-theme-btn').addEventListener('click', () => {
      state.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
      saveState();
      applyState();
    });

    panel.querySelectorAll('.jmd-segmented[data-role="theme"] button').forEach(b => {
      b.addEventListener('click', () => { state.theme = b.dataset.value; saveState(); applyState(); });
    });
    panel.querySelectorAll('.jmd-segmented[data-role="density"] button').forEach(b => {
      b.addEventListener('click', () => { state.density = b.dataset.value; saveState(); applyState(); });
    });
    panel.querySelectorAll('.jmd-swatches[data-role="accent"] button').forEach(b => {
      b.addEventListener('click', () => { state.accent = b.dataset.value; saveState(); applyState(); });
    });

    const fs = panel.querySelector('#jmd-fontsize');
    fs.addEventListener('input', () => {
      state.fontSize = parseInt(fs.value, 10);
      panel.querySelector('#jmd-fontsize-val').textContent = state.fontSize;
      document.documentElement.style.setProperty('--jmd-font-size', state.fontSize + 'px');
    });
    fs.addEventListener('change', saveState);

    panel.querySelector('#jmd-opt-collapseEntries').addEventListener('change', e => {
      state.collapseEntries = e.target.checked; saveState();
      setAllEntries(!state.collapseEntries);
    });
    panel.querySelector('#jmd-opt-collapseHistory').addEventListener('change', e => {
      state.collapseHistory = e.target.checked; saveState();
    });
    panel.querySelector('#jmd-opt-collapseDiff').addEventListener('change', e => {
      state.collapseDiff = e.target.checked; saveState();
      setAllDiffs(!state.collapseDiff);
    });
    panel.querySelector('#jmd-opt-diffHighlight').addEventListener('change', e => {
      state.diffHighlight = e.target.checked; saveState(); applyState();
    });
    panel.querySelector('#jmd-opt-capBlocks').addEventListener('change', e => {
      state.capBlocks = e.target.checked; saveState(); applyState();
    });
    panel.querySelector('#jmd-opt-capHeight').addEventListener('change', e => {
      state.capHeight = parseInt(e.target.value, 10) || DEFAULTS.capHeight; saveState(); applyState();
    });
    panel.querySelector('#jmd-opt-dimSearchOnly').addEventListener('change', e => {
      state.dimSearchOnly = e.target.checked; saveState(); applyState();
    });
    panel.querySelector('#jmd-opt-editor').addEventListener('input', e => {
      state.highlightEditor = e.target.value; saveState(); applyEditorHighlight(state.highlightEditor);
    });
    panel.querySelector('#jmd-opt-myname').addEventListener('input', e => {
      state.savedName = e.target.value; saveState();
    });
    panel.querySelector('#jmd-opt-myemail').addEventListener('input', e => {
      state.savedEmail = e.target.value; saveState();
    });

    panel.querySelector('#jmd-reset-btn').addEventListener('click', () => {
      state = Object.assign({}, DEFAULTS);
      saveState();
      applyState();
      setAllEntries(!state.collapseEntries);
      setAllDiffs(!state.collapseDiff);
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.theme === 'auto') applyState();
      });
    }
  }

  function syncPanelControls() {
    const panel = document.getElementById('jmd-settings-panel');
    if (!panel) return;
    panel.querySelectorAll('.jmd-segmented[data-role="theme"] button').forEach(b => {
      b.classList.toggle('jmd-active', b.dataset.value === state.theme);
    });
    panel.querySelectorAll('.jmd-segmented[data-role="density"] button').forEach(b => {
      b.classList.toggle('jmd-active', b.dataset.value === state.density);
    });
    panel.querySelectorAll('.jmd-swatches[data-role="accent"] button').forEach(b => {
      b.classList.toggle('jmd-active', b.dataset.value === state.accent);
    });
    const fs = panel.querySelector('#jmd-fontsize');
    fs.value = state.fontSize;
    panel.querySelector('#jmd-fontsize-val').textContent = state.fontSize;
    panel.querySelector('#jmd-opt-collapseEntries').checked = state.collapseEntries;
    panel.querySelector('#jmd-opt-collapseHistory').checked = state.collapseHistory;
    panel.querySelector('#jmd-opt-collapseDiff').checked = state.collapseDiff;
    panel.querySelector('#jmd-opt-diffHighlight').checked = state.diffHighlight;
    panel.querySelector('#jmd-opt-capBlocks').checked = state.capBlocks;
    panel.querySelector('#jmd-opt-capHeight').value = state.capHeight;
    panel.querySelector('#jmd-opt-dimSearchOnly').checked = state.dimSearchOnly;
    panel.querySelector('#jmd-opt-editor').value = state.highlightEditor;
    panel.querySelector('#jmd-opt-myname').value = state.savedName;
    panel.querySelector('#jmd-opt-myemail').value = state.savedEmail;
  }

  function buildBackToTop() {
    const btn = document.createElement('button');
    btn.id = 'jmd-top-btn';
    btn.type = 'button';
    btn.title = 'Back to top';
    btn.textContent = '^ Top';
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => {
      btn.classList.toggle('jmd-visible', window.scrollY > 600);
    }, { passive: true });
    btn.addEventListener('click', () => {
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  // Auto-fill the Name/Email fields on the New Entry / Edit form
  // (edform.py) from the saved values in settings, so they don't have to
  // be retyped on every submission. Only fills empty fields, and only
  // touches plain text inputs with id="name" / id="email" -- never the
  // login username/password fields, which live in a different form.
  function autofillIdentity() {
    const nameEl = document.querySelector('#name');
    const emailEl = document.querySelector('#email');
    if (nameEl && nameEl.tagName === 'INPUT' && nameEl.type === 'text' && !nameEl.value && state.savedName) {
      nameEl.value = state.savedName;
      nameEl.classList.add('jmd-autofilled');
    }
    if (emailEl && emailEl.tagName === 'INPUT' && emailEl.type === 'text' && !emailEl.value && state.savedEmail) {
      emailEl.value = state.savedEmail;
      emailEl.classList.add('jmd-autofilled');
    }
  }

  /* ================================================================
   * 7. INIT
   * ============================================================== */

  function init() {
    const isJmdictdbPage = !!document.querySelector('header.jmd-header, main.jmd-content');
    if (isJmdictdbPage) {
      classifyStatusAndStat();
      fixOlderHistoryToggle();
      buildHistoryCollapsers();
      highlightDiffs();
      buildDiffCollapsers();
      buildNgramButtons();
      tidyNavSeparators();
      buildEntryCollapsers();
      buildToolbar();
      buildBackToTop();
      autofillIdentity();
    }
    enhanceNgramPage();
    applyState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();