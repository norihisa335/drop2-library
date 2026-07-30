(() => {
  "use strict";

  let state, printStyle, helpers;

  function configure(context) {
    ({ state, printStyle } = context);
    helpers = context.helpers;
  }

  const escapeHtml = (...args) => helpers.escapeHtml(...args);
  const displayQuality = (...args) => helpers.displayQuality(...args);
  function updatePrintStyle() {
    const isBrowseByChord = state.page === "browse-by-chord";
    printStyle.textContent = isBrowseByChord
      ? `@page { size: A4 ${state.browseByChordPrintOrientation}; margin: 8mm; }`
      : state.page === "forms"
      ? "@page { size: A4 landscape; margin: 8mm; }"
      : "@page { size: A4 portrait; margin: 7mm; }";
  }

  function printHeaderMarkup() {
    if (state.page === "browse-by-chord") {
      return `<div class="print-header browse-chord-print-title" aria-hidden="true">${escapeHtml(`${state.browseByChordRoot}${displayQuality(state.browseByChordQuality)}`)}</div>`;
    }

    const activeChords = state.page === "voicings"
      ? state.chords.filter((chord) => chord.root)
      : [];

    const headerValue = state.page === "forms"
      ? state.root
      : activeChords.map((chord) => `${chord.root}${displayQuality(chord.quality)}`).join(" → ");

    const headerLabel = state.page === "voicings" ? "CHORDS:" : "ROOT:";

    return `
      <div class="print-header" aria-hidden="true">
        <div class="print-header-item">${escapeHtml(state.family)} ${escapeHtml(state.variant)}</div>
        <div class="print-header-item">${escapeHtml(headerLabel)} ${escapeHtml(headerValue)}</div>
        <div class="print-header-item">String Set: ${escapeHtml(state.stringSet)}</div>
      </div>
    `;
  }

  function bindPrint(printButton) {
    printButton.onclick = () => {
      updatePrintStyle();
      requestAnimationFrame(() => {
        window.setTimeout(() => window.print(), 80);
      });
    };
  }

  window.GVL_PRINT = { configure, updatePrintStyle, printHeaderMarkup, bindPrint };
})();
