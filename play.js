(() => {
  "use strict";
  let DATA, Fretboard, state, app, helpers, rerender;
  const qualityOptions = ["Maj7", "7", "m7", "m7b5"];
  const tuning = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };

  function configure(context) {
    ({ DATA, Fretboard, state, app, rerender } = context);
    helpers = context.helpers;
  }

  function transpose(form, root) {
    const offset = DATA.rootOffsets[root] ?? 0;
    return { ...form, frets: form.frets.map((fret) => Number(fret) + offset) };
  }

  function metrics(form, root, shift = 0) {
    const voicing = transpose(form, root);
    const frets = voicing.frets.map((fret) => Number(fret) + shift);
    if (frets.some((fret) => !Number.isFinite(fret) || fret < 1 || fret > 21)) return null;
    const pitches = frets.map((fret, index) => tuning[voicing.strings[index]] + fret);
    const top = Math.max(...pitches);
    return {
      ...voicing, frets, topNotePitch: top, topNotePitchClass: ((top % 12) + 12) % 12,
      topNoteFret: frets[pitches.indexOf(top)], topString: voicing.strings[pitches.indexOf(top)],
      minFret: Math.min(...frets), maxFret: Math.max(...frets),
      positionCenter: frets.reduce((sum, fret) => sum + fret, 0) / frets.length
    };
  }

  function candidates(chord, rootOnly = false) {
    return DATA.forms
      .filter((form) => form.quality === chord.quality && form.showInBrowseByChord === true && Number.isInteger(form.browseByChordOrder))
      .filter((form) => rootOnly
        ? (((form.family === "Drop2" && form.stringSet === "2-5") || (form.family === "Drop3" && form.stringSet === "2-6")) && form.inversion === "Root")
        : form.variant !== "Standard")
      .flatMap((form) => [-12, 0, 12].map((shift) => metrics(form, chord.root, shift)).filter(Boolean));
  }

  function initial(list, mode) {
    return [...list].sort((a, b) => {
      const aRange = a.maxFret <= 12 ? 0 : 1;
      const bRange = b.maxFret <= 12 ? 0 : 1;
      if (aRange !== bRange) return aRange - bRange;
      const center = Math.abs(a.positionCenter - 6) - Math.abs(b.positionCenter - 6);
      if (center) return center;
      if (mode === "asc") return a.topNotePitch - b.topNotePitch;
      if (mode === "desc") return b.topNotePitch - a.topNotePitch;
      return a.browseByChordOrder - b.browseByChordOrder;
    })[0] || null;
  }

  function choose(previous, list, mode) {
    if (!previous) return initial(list, mode);

    // v2.1: Ascending must rise strictly. Equal or lower top notes are excluded.
    const eligible = mode === "asc"
      ? list.filter((item) => item.topNotePitch > previous.topNotePitch)
      : list;

    return [...eligible].sort((a, b) => {
      const rank = (item) => {
        const difference = item.topNotePitch - previous.topNotePitch;
        if (mode === "desc") return difference === 0 ? 0 : difference < 0 ? 1 : 2;
        return 0;
      };
      const rankDifference = rank(a) - rank(b);
      if (rankDifference) return rankDifference;
      const aDistance = Math.abs(a.topNotePitch - previous.topNotePitch);
      const bDistance = Math.abs(b.topNotePitch - previous.topNotePitch);
      return aDistance - bDistance
        || Math.abs(a.positionCenter - previous.positionCenter) - Math.abs(b.positionCenter - previous.positionCenter)
        || a.positionCenter - b.positionCenter
        || a.browseByChordOrder - b.browseByChordOrder;
    })[0] || null;
  }

  function sequence(mode) {
    let previous = null;
    return state.playChords.map((chord) => {
      const next = mode === "root"
        ? choose(previous, candidates(chord, true), "nearest")
        : choose(previous, candidates(chord, false), mode);
      previous = next;
      return next;
    });
  }

  function card(chord, voicing) {
    return `<article class="play-card"${voicing ? ` data-play-selected-id="${helpers.escapeHtml(voicing.id)}" data-play-top="${voicing.topNotePitch}" data-play-center="${voicing.positionCenter}"` : ""}>
      <h4>${helpers.escapeHtml(chord.root + chord.quality)}</h4>
      ${voicing
        ? `<p>${helpers.escapeHtml(voicing.family)} · ${helpers.escapeHtml(voicing.stringSet)} · ${helpers.escapeHtml(voicing.inversion)}</p><div class="play-board" data-play-form="${helpers.escapeHtml(voicing.id)}" data-play-frets="${voicing.frets.join(",")}"></div>`
        : `<div class="empty-state compact">${helpers.escapeHtml(helpers.t("noVoicing"))}</div>`}
    </article>`;
  }

  function render() {
    const patterns = [
      [helpers.t("ascending"), "asc"],
      [helpers.t("descending"), "desc"],
      [helpers.t("nearest"), "nearest"],
      [helpers.t("rootPosition"), "root"]
    ];

    app.innerHTML = `
      <div class="play-print-header">${helpers.escapeHtml(helpers.t("playPage"))}<br><span>${helpers.escapeHtml(state.playChords.map((chord) => chord.root + chord.quality).join(" → "))}</span></div>
      <section class="panel play-controls">
        ${state.playChords.map((chord, index) => `
          <div class="chord-row">
            <div class="control-group"><label>${helpers.escapeHtml(helpers.t("root"))}</label><select data-play-index="${index}" data-play-field="root">${helpers.options(DATA.roots, chord.root)}</select></div>
            <div class="control-group"><label>${helpers.escapeHtml(helpers.t("quality"))}</label><select data-play-index="${index}" data-play-field="quality">${helpers.options(qualityOptions, chord.quality)}</select></div>
            ${state.playChords.length > 2 ? `<button data-play-remove="${index}" type="button">${helpers.escapeHtml(helpers.t("remove"))}</button>` : ""}
          </div>`).join("")}
        <div class="control-group play-view">
          <span class="control-label">${helpers.escapeHtml(helpers.t("view"))}</span>
          <div class="segmented" data-segment="orientation">
            <button class="${state.orientation === "horizontal" ? "active" : ""}" data-value="horizontal" type="button">${helpers.escapeHtml(helpers.t("horizontal"))}</button>
            <button class="${state.orientation === "vertical" ? "active" : ""}" data-value="vertical" type="button">${helpers.escapeHtml(helpers.t("vertical"))}</button>
          </div>
        </div>
        <button data-play-add type="button"${state.playChords.length >= 5 ? " disabled" : ""}>${helpers.escapeHtml(helpers.t("addChord"))}</button>
        <button data-play-refresh type="button">${helpers.escapeHtml(helpers.t("refresh"))}</button>
      </section>
      ${patterns.map(([name, mode]) => {
        const selected = sequence(mode);
        return `<section class="pattern-group play-pattern"><div class="pattern-heading"><h3>${helpers.escapeHtml(name)}</h3></div><div class="play-grid">${state.playChords.map((chord, index) => card(chord, selected[index])).join("")}</div></section>`;
      }).join("")}`;

    document.querySelectorAll("[data-play-index]").forEach((select) => {
      select.onchange = () => {
        state.playChords[Number(select.dataset.playIndex)][select.dataset.playField] = select.value;
        rerender();
      };
    });
    document.querySelector("[data-play-add]")?.addEventListener("click", () => {
      if (state.playChords.length < 5) {
        state.playChords.push({ root: "C", quality: "Maj7" });
        rerender();
      }
    });
    document.querySelectorAll("[data-play-remove]").forEach((button) => {
      button.onclick = () => {
        state.playChords.splice(Number(button.dataset.playRemove), 1);
        rerender();
      };
    });
    document.querySelector("[data-play-refresh]")?.addEventListener("click", rerender);
    document.querySelectorAll("[data-segment='orientation'] button").forEach((button) => {
      button.onclick = () => {
        state.orientation = button.dataset.value;
        rerender();
      };
    });
    document.querySelectorAll("[data-play-form]").forEach((host, index) => {
      const voicing = sequence(patterns[Math.floor(index / state.playChords.length)][1])[index % state.playChords.length];
      if (voicing) {
        Fretboard.render(host, { ...voicing, frets: voicing.frets }, {
          size: "small", orientation: state.orientation, showDegrees: state.showDegrees, preserveAbsolutePositions: true
        });
      }
    });
  }

  window.GVL_PLAY = { configure, render };
})();
