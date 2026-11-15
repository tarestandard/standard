> Reviewed 2026-11-14. This statement covers the published standards at tarestandard.org and this site's own pages.

This site targets WCAG 2.2 Level AA. This page records what that target covers,
how the site is checked, what is known to fall short, and where to report a
barrier.

## What this page covers

This statement covers the pages the site publishes: the contents at `/`, the
Agent Standard and its documents, the Shopfront Standard and its documents, the
not-found page, and this statement. It does not cover the scan service at
[tarestandard.com](https://tarestandard.com), which is a separate product and
publishes its own record.

## The target

The target is WCAG 2.2 Level AA. The site is a static reading surface: no
account, no form, no timed action, and no authored animation. Where a reference
table is wider than a phone, the table scrolls inside its own labelled region
and the page itself does not scroll sideways.

## How the site is checked

- Every change is checked in a browser at 320, 390, 640, 767, 768, 980, 1039,
  1040, 1360 and 1440 pixels wide. The check fails on a page that pans, on a
  table that scrolls without its cue, on a dated line that wraps inside the
  date, and on a table cell that breaks a word.
- The pages are read with a keyboard, at 200% zoom, and the focus ring is
  checked on the shipped stylesheet.
- Colour contrast is measured from the shipped stylesheet: body and table text
  12.18:1, secondary text 5.80:1, the focus ring 5.17:1.
- The source Markdown is published beside each document, so the same text is
  available without the page's styling.

## Known limitations

- Wide reference tables scroll horizontally inside their own region at narrow
  widths. A visible cue above the table says so; the page itself stays within
  the viewport.
- The site has no search. The contents page and each document's "On this page"
  list are the ways in.
- The copy control needs JavaScript. Without it, the citation text is still
  selectable and every URL is printed as text.
- No assistive-technology audit is on file yet. The pages use landmarks, one
  `h1`, ordered headings, a skip link, labelled table regions and a visible
  focus ring; a manual screen-reader pass is the next check.
- The site is checked against the WCAG 2.2 AA target on its own pages. It is
  not audited by a third party, and this page records what was tested rather
  than granting a status.

## Reporting a barrier

Report a barrier at [the public issue tracker](https://github.com/tarestandard/standard/issues).
Name the page and what happened. Every report is read. If you need the
standard in another format, ask there as well.

## This statement

The review date is printed above, and it is the site's publication date. This
statement is republished whenever the site changes; it is not a new edition of
either standard.
