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

    if (mode === "desc") {
      const candidates = [...eligible].filter((item) => item.topNotePitch <= previous.topNotePitch);
      if (candidates.length > 0) {
        return candidates.sort((a, b) => {
          const diffA = previous.topNotePitch - a.topNotePitch;
          const diffB = previous.topNotePitch - b.topNotePitch;
          return diffA - diffB
            || Math.abs(a.positionCenter - previous.positionCenter) - Math.abs(b.positionCenter - previous.positionCenter)
            || a.positionCenter - b.positionCenter
            || a.browseByChordOrder - b.browseByChordOrder;
        })[0];
      }
      return null;
    }

    return [...eligible].sort((a, b) => {
      const aDistance = Math.abs(a.topNotePitch - previous.topNotePitch);
      const bDistance = Math.abs(b.topNotePitch - previous.topNotePitch);
      return aDistance - bDistance
        || Math.abs(a.positionCenter - previous.positionCenter) - Math.abs(b.positionCenter - previous.positionCenter)
        || a.positionCenter - b.positionCenter
        || a.browseByChordOrder - b.browseByChordOrder;
    })[0] || null;
  }

  function findDescendingPath(chords) {
    const optionsByIndex = chords.map((chord) => candidates(chord, false));
    let bestPath = null;

    const comparePaths = (pathA, pathB) => {
      const aLength = pathA.length;
      const bLength = pathB.length;
      if (aLength !== bLength) return bLength - aLength;
      const aStart = pathA[0]?.topNotePitch ?? Number.MAX_SAFE_INTEGER;
      const bStart = pathB[0]?.topNotePitch ?? Number.MAX_SAFE_INTEGER;
      if (aStart !== bStart) return aStart - bStart;
      const aDrop = pathA.reduce((sum, item, index) => index === 0 ? 0 : sum + (pathA[index - 1].topNotePitch - item.topNotePitch), 0);
      const bDrop = pathB.reduce((sum, item, index) => index === 0 ? 0 : sum + (pathB[index - 1].topNotePitch - item.topNotePitch), 0);
      if (aDrop !== bDrop) return aDrop - bDrop;
      const aMove = pathA.reduce((sum, item, index) => index === 0 ? 0 : sum + Math.abs(item.positionCenter - pathA[index - 1].positionCenter), 0);
      const bMove = pathB.reduce((sum, item, index) => index === 0 ? 0 : sum + Math.abs(item.positionCenter - pathB[index - 1].positionCenter), 0);
      if (aMove !== bMove) return aMove - bMove;
      return 0;
    };

    const search = (index, currentPath, currentTop, currentPosition) => {
      if (!bestPath || comparePaths(currentPath, bestPath) < 0) {
        bestPath = [...currentPath];
      }

      if (index === chords.length) {
        return;
      }

      const candidates = optionsByIndex[index] || [];
      const valid = currentPath.length === 0
        ? candidates
        : candidates.filter((item) => item.topNotePitch <= currentTop);

      if (valid.length === 0) {
        return;
      }

      const ranked = [...valid].sort((a, b) => {
        const aDrop = currentPath.length === 0 ? 0 : currentTop - a.topNotePitch;
        const bDrop = currentPath.length === 0 ? 0 : currentTop - b.topNotePitch;
        const aMove = Math.abs(a.positionCenter - currentPosition);
        const bMove = Math.abs(b.positionCenter - currentPosition);
        const aStartPenalty = currentPath.length === 0 ? a.topNotePitch : 0;
        const bStartPenalty = currentPath.length === 0 ? b.topNotePitch : 0;
        return (currentPath.length === 0 ? aStartPenalty - bStartPenalty : 0)
          || (currentPath.length === 0 ? aDrop - bDrop : 0)
          || (currentPath.length === 0 ? aMove - bMove : 0)
          || a.topNotePitch - b.topNotePitch
          || a.positionCenter - b.positionCenter
          || a.browseByChordOrder - b.browseByChordOrder;
      });

      ranked.forEach((item) => {
        const nextPath = [...currentPath, item];
        search(index + 1, nextPath, item.topNotePitch, item.positionCenter);
      });
    };

    search(0, [], Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

    if (!bestPath) {
      return chords.map(() => null);
    }

    const result = Array(chords.length).fill(null);
    bestPath.forEach((item, index) => {
      result[index] = item;
    });
    return result;
  }

  function sequence(mode) {
    if (mode === "desc") {
      const path = findDescendingPath(state.playChords);
      return path;
    }

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
