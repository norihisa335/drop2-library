(() => {
  "use strict";

  let DATA, Fretboard, state, app, helpers;

  function configure(context) {
    ({ DATA, Fretboard, state, app } = context);
    helpers = context.helpers;
  }

  const escapeHtml = (...args) => helpers.escapeHtml(...args);
  const options = (...args) => helpers.options(...args);
  const displayQuality = (...args) => helpers.displayQuality(...args);
  function uniqueFormValues(forms, field) {
    return [...new Set(forms.map((form) => form[field]).filter(Boolean))];
  }

  function availableFamilies() {
    return uniqueFormValues(DATA.forms, "family");
  }

  function availableVariants(family = state.family) {
    return uniqueFormValues(DATA.forms.filter((form) => form.family === family), "variant");
  }

  function availableStringSets(family = state.family, variant = state.variant) {
    return uniqueFormValues(DATA.forms.filter((form) =>
      form.family === family && form.variant === variant
    ), "stringSet");
  }

  function currentForms() {
    return DATA.forms.filter((form) =>
      form.family === state.family &&
      form.variant === state.variant &&
      form.stringSet === state.stringSet
    );
  }

  function availableQualities(forms = currentForms()) {
    return uniqueFormValues(forms, "quality");
  }

  function availableInversions(forms = currentForms()) {
    return uniqueFormValues(forms, "inversion");
  }

  function supportsChordChanges(family = state.family) {
    return family === "Drop2" || family === "Drop3";
  }

  function normalizeSelectionState() {
    const families = availableFamilies();
    if (!families.includes(state.family)) state.family = families[0] ?? "";

    const variants = availableVariants();
    if (!variants.includes(state.variant)) state.variant = variants[0] ?? "";

    const stringSets = availableStringSets();
    if (!stringSets.includes(state.stringSet)) state.stringSet = stringSets[0] ?? "";

    const forms = currentForms();
    if (!forms.some((form) => form.id === state.selectedFormId)) {
      state.selectedFormId = forms[0]?.id ?? "";
    }

    const qualities = availableQualities(forms);
    if (qualities.length) {
      state.chords.forEach((chord) => {
        if (!qualities.includes(chord.quality)) chord.quality = qualities[0];
      });
    }
  }

  function transposeForm(form, root) {
    const offset = DATA.rootOffsets[root] ?? 0;
    return {
      ...form,
      frets: form.frets.map((fret) => {
        if (fret === null || fret === undefined || String(fret).toLowerCase() === "x") return fret;
        const number = Number(fret);
        return number > 0 ? number + offset : number;
      })
    };
  }

  function getFormSlotInversion(form) {
    return form?.inversion ?? "Root";
  }

  function getInversionCoverageDiagnostic(forms, inversions = availableInversions(forms)) {
    const counts = {};

    forms.forEach((form) => {
      if (!counts[form.quality]) {
        counts[form.quality] = Object.fromEntries(inversions.map((inversion) => [inversion, 0]));
      }

      const slotInversion = getFormSlotInversion(form);
      counts[form.quality][slotInversion] = (counts[form.quality][slotInversion] ?? 0) + 1;
    });

    return counts;
  }

  function logInversionCoverageDiagnostic(forms) {
    const inversions = availableInversions(forms);
    const counts = getInversionCoverageDiagnostic(forms, inversions);
    const issues = Object.entries(counts).filter(([quality, slots]) =>
      inversions.some((inversion) => (slots[inversion] ?? 0) !== 1)
    );
    const summary = Object.entries(counts).map(([quality, slots]) =>
      `${quality}: ${inversions.map((inversion) => `${inversion}=${slots[inversion] ?? 0}`).join(", ")}`
    ).join(" | ");

    if (issues.length) {
      console.warn("[GVL] inversion coverage issue", {
        family: state.family,
        variant: state.variant,
        stringSet: state.stringSet,
        summary,
        counts
      });
    } else {
      console.info("[GVL] inversion coverage OK", {
        family: state.family,
        variant: state.variant,
        stringSet: state.stringSet,
        summary,
        counts
      });
    }

    return { counts, issues };
  }

  function renderFormLibrary({ printHeaderMarkup, commonControls }) {
    const forms = currentForms();
    const inversions = availableInversions(forms);
    const qualities = availableQualities(forms);
    logInversionCoverageDiagnostic(forms);
    const byKey = new Map(forms.map((form) => [`${form.quality}|${getFormSlotInversion(form)}`, form]));
    let selected = forms.find((form) => form.id === state.selectedFormId);

    if (!selected) selected = forms[0] ?? null;
    if (selected) state.selectedFormId = selected.id;

    const table = [
      `<div class="table-cell header">Quality</div>`,
      ...inversions.map((inversion) => `<div class="table-cell header">${escapeHtml(inversion)}</div>`)
    ];

    qualities.forEach((quality) => {
      table.push(`<div class="table-cell row-label">${escapeHtml(displayQuality(quality))}</div>`);

      inversions.forEach((inversion) => {
        const form = byKey.get(`${quality}|${inversion}`);

        table.push(`
          <div class="table-cell">
            ${form
              ? `<button
                   class="form-button ${form.id === state.selectedFormId ? "selected" : ""}"
                   data-form-id="${escapeHtml(form.id)}"
                   type="button"
                   aria-label="${escapeHtml(`${displayQuality(quality)} ${inversion}`)}">
                   <span class="mini-fretboard" data-mini-form="${escapeHtml(form.id)}"></span>
                 </button>`
              : `<span class="missing-form">-</span>`}
          </div>
        `);
      });
    });

    app.innerHTML = `
      ${printHeaderMarkup()}
      ${commonControls()}

      <div class="section-heading">
        <h2>Forms</h2>
        <p>${escapeHtml(state.stringSet)}</p>
      </div>

      <section class="form-table-wrap">
        <div class="form-table" style="--form-column-count: ${inversions.length}">${table.join("")}</div>
      </section>

      <div class="section-heading selected-form-heading">
        <h2>Selected Form</h2>
        <p>${selected ? escapeHtml(selected.id) : ""}</p>
      </div>

      ${selected ? `
        <section class="selected-card">
          <div class="selected-meta">
            <div>
              <h3>${escapeHtml(state.root)}${escapeHtml(displayQuality(selected.quality))}</h3>
              <p>${escapeHtml(selected.inversion)} (${escapeHtml(selected.family)})</p>
            </div>
            <p>${escapeHtml(selected.stringSet)}</p>
          </div>

          <div id="selectedFretboard" class="fretboard-host"></div>

          <div class="use-case">
            <strong>Notes</strong><br>
            ${escapeHtml(selected.notes || "—")}
          </div>
        </section>
      ` : `<div class="empty-state">No matching forms yet.</div>`}
    `;

    document.querySelectorAll("[data-mini-form]").forEach((host) => {
      const form = forms.find((item) => item.id === host.dataset.miniForm);
      if (!form) return;

      Fretboard.render(host, transposeForm(form, state.root), {
        size: "small",
        orientation: state.orientation,
        showDegrees: false
      });
    });

    if (selected) {
      Fretboard.render("#selectedFretboard", transposeForm(selected, state.root), {
        size: "large",
        orientation: state.orientation,
        showDegrees: state.showDegrees
      });
    }
  }

  window.GVL_BROWSE = {
    configure,
    availableFamilies,
    availableVariants,
    availableStringSets,
    currentForms,
    availableQualities,
    availableInversions,
    supportsChordChanges,
    normalizeSelectionState,
    logInversionCoverageDiagnostic,
    renderFormLibrary
  };
})();
