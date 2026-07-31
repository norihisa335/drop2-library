# Guitar Voicing Library v2.0 Specification

## Design and versioning

The library separates app version (v2.0), data master (v5), asset cache-buster (v9.5), and Git history. Minor releases use v2.1 onward; structural releases use v3.0.

## Home and structure

Home provides Browse by Voicing, Browse by Chord, Chord Changes (Study), and Chord Changes (Play). JavaScript is divided into `app.js` (state/routing), `browse.js` (library browsing), `changes.js` (Study), `play.js` (Play), `print.js`, `fretboard.js`, and generated `data.js`.

## Data model and validation

The v5 Excel master is authoritative. Generated forms retain id, family, variant, quality, inversion, stringSet, strings, frets, degrees, notes, and Browse by Chord fields. Strings/frets/degrees have matching lengths; degrees are strings. Validation checks IDs, required values, field types, and Browse orders.

## Browsing, diagrams, and print

Browse by Voicing filters family, variant, string set, and root. Browse by Chord uses master-provided visibility and order. Diagrams support Degree and Horizontal/Vertical orientation. Browse by Chord prints A4 portrait in four columns and landscape in six columns.

## Chord Changes

Study retains its existing optimizer. Play supports two to five chords, excludes Standard candidates except for Root Position, expands practical positions by ±12 while keeping frets 1–21 and excluding open strings, and calculates highest sounding pitch as `topNotePitch`. Ascending prefers same/upward top notes; Descending same/downward; Nearest minimum absolute change; Root Position selects Drop2 2-5 Root or Drop3 2-6 Root by nearest position center.

## Links

Live app: https://norihisa335.github.io/drop2-library/

Repository: https://github.com/norihisa335/drop2-library/
