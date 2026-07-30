(() => {
  "use strict";

  const DATA = window.GVL_DATA;
  const Fretboard = window.GuitarFretboard;
  const Browse = window.GVL_BROWSE;
  const Changes = window.GVL_CHANGES;
  const Print = window.GVL_PRINT;

  const state = {
    page: "home",
    family: "Drop2",
    variant: "Standard",
    stringSet: "2-5",
    root: "C",
    browseByChordRoot: "C",
    browseByChordQuality: "Maj7",
    selectedBrowseByChordFormId: "",
    orientation: "horizontal",
    showDegrees: localStorage.getItem("gvl-show-degrees") !== "false",
    selectedFormId: "M7-25-R-S-01",
    chords: [
      { root: "C", quality: "Maj7" },
      { root: "A", quality: "m7" },
      { root: "D", quality: "m7" },
      { root: "G", quality: "7" }
    ]
  };

  const app = document.querySelector("#app");
  const pageTitle = document.querySelector("#pageTitle");
  const backButton = document.querySelector("#backButton");
  const degreeControl = document.querySelector("#degreeControl");
  const degreeToggle = document.querySelector("#degreeToggle");
  const header = document.querySelector(".app-header");
  const printButton = document.createElement("button");
  const printStyle = document.createElement("style");

  printStyle.id = "dynamicPrintPageStyle";
  document.head.appendChild(printStyle);
  printButton.id = "printButton";
  printButton.className = "print-button";
  printButton.type = "button";
  printButton.textContent = "Print";
  printButton.setAttribute("aria-label", "Print current view");

  const headerActions = document.createElement("div");
  headerActions.className = "header-actions";
  degreeControl.remove();
  headerActions.append(degreeControl, printButton);
  header.appendChild(headerActions);
  degreeToggle.checked = state.showDegrees;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function options(items, selected) {
    return items
      .map((item) => `<option value="${escapeHtml(item)}"${item === selected ? " selected" : ""}>${escapeHtml(item)}</option>`)
      .join("");
  }

  function displayQuality(quality) {
    return quality === "m7b5" ? "m7b5" : quality;
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

  const helpers = { escapeHtml, options, displayQuality, transposeForm, getFormSlotInversion };
  Browse.configure({ DATA, Fretboard, state, app, helpers });
  Print.configure({ state, printStyle, helpers });

  function setPage(page) {
    state.page = page;
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderHeader() {
    const isHome = state.page === "home";
    const pageTitles = {
      home: "Home",
      forms: "Form Library",
      voicings: "Voicing Library",
      "browse-by-chord": "Browse by Chord",
      "changes-play": "Chord Changes (Play)"
    };
    const hasViewControls = state.page === "forms" || state.page === "voicings" || state.page === "browse-by-chord";

    pageTitle.textContent = pageTitles[state.page] ?? "Home";
    backButton.classList.toggle("hidden", isHome);
    degreeControl.classList.toggle("hidden", !hasViewControls);
    printButton.classList.toggle("hidden", !hasViewControls);
  }

  function renderHome() {
    app.innerHTML = `
      <section class="home-grid">
        <button class="nav-card" data-go="forms" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>Browse by Voicing</h2>
          <p>Explore forms by family, variant, and string set.</p>
        </button>

        <button class="nav-card" data-go="browse-by-chord" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>Browse by Chord</h2>
          <p>Find voicings from a root and chord quality.</p>
        </button>

        <button class="nav-card" data-go="voicings" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>Chord Changes (Study)</h2>
          <p>Examine optimized voice-leading through changes.</p>
        </button>

        <button class="nav-card" data-go="changes-play" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>Chord Changes (Play)</h2>
          <p>Shape voice-leading with a top-note focus.</p>
        </button>
      </section>
    `;
  }

  function renderGuidePage({ title, description }) {
    app.innerHTML = `
      <section class="guide-page panel">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </section>
    `;
  }

  function commonControls({ includeRoot = true } = {}) {
    return `
      <section class="panel">
        <div class="control-grid">
          <div class="control-group">
            <label for="familySelect">Family</label>
            <select id="familySelect">${options(Browse.availableFamilies(), state.family)}</select>
          </div>
          <div class="control-group">
            <label for="variantSelect">Variant</label>
            <select id="variantSelect">${options(Browse.availableVariants(), state.variant)}</select>
          </div>
          <div class="control-group">
            <label for="stringSetSelect">String Set</label>
            <select id="stringSetSelect">${options(Browse.availableStringSets(), state.stringSet)}</select>
          </div>
          ${includeRoot ? `
            <div class="control-group">
              <label for="rootSelect">Root</label>
              <select id="rootSelect">${options(DATA.roots, state.root)}</select>
            </div>
          ` : ""}
          <div class="control-group">
            <span class="control-label">View</span>
            <div class="segmented" data-segment="orientation">
              <button class="${state.orientation === "horizontal" ? "active" : ""}" data-value="horizontal" type="button">Horizontal</button>
              <button class="${state.orientation === "vertical" ? "active" : ""}" data-value="vertical" type="button">Vertical</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  Changes.configure({
    DATA,
    Fretboard,
    state,
    app,
    helpers: {
      ...helpers,
      availableInversions: Browse.availableInversions,
      availableQualities: Browse.availableQualities,
      supportsChordChanges: Browse.supportsChordChanges,
      currentForms: Browse.currentForms,
      logInversionCoverageDiagnostic: Browse.logInversionCoverageDiagnostic
    },
    renderDependencies: { printHeaderMarkup: Print.printHeaderMarkup, commonControls }
  });

  function bindEvents() {
    Print.bindPrint(printButton);
    document.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => setPage(button.dataset.go));
    });
    document.querySelector("#familySelect")?.addEventListener("change", (event) => {
      state.family = event.target.value;
      render();
    });
    document.querySelector("#variantSelect")?.addEventListener("change", (event) => {
      state.variant = event.target.value;
      render();
    });
    document.querySelector("#stringSetSelect")?.addEventListener("change", (event) => {
      state.stringSet = event.target.value;
      render();
    });
    document.querySelector("#rootSelect")?.addEventListener("change", (event) => {
      state.root = event.target.value;
      render();
    });
    document.querySelector("#browseChordRootSelect")?.addEventListener("change", (event) => {
      state.browseByChordRoot = event.target.value;
      state.selectedBrowseByChordFormId = "";
      render();
    });
    document.querySelector("#browseChordQualitySelect")?.addEventListener("change", (event) => {
      state.browseByChordQuality = event.target.value;
      state.selectedBrowseByChordFormId = "";
      render();
    });
    document.querySelectorAll("[data-segment='orientation'] button").forEach((button) => {
      button.addEventListener("click", () => {
        state.orientation = button.dataset.value;
        render();
      });
    });
    document.querySelectorAll("[data-form-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedFormId = button.dataset.formId;
        render();
      });
    });
    document.querySelectorAll("[data-browse-form-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedBrowseByChordFormId = button.dataset.browseFormId;
        render();
      });
    });
    document.querySelector("[data-close-browse-modal]")?.addEventListener("click", () => {
      state.selectedBrowseByChordFormId = "";
      render();
    });
    document.querySelectorAll("[data-chord-index]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.dataset.chordIndex);
        const field = select.dataset.chordField;
        state.chords[index][field] = select.value;
        render();
      });
    });
  }

  function render() {
    Browse.normalizeSelectionState();
    Print.updatePrintStyle();
    renderHeader();
    if (state.page === "home") renderHome();
    if (state.page === "forms") Browse.renderFormLibrary({
      printHeaderMarkup: Print.printHeaderMarkup,
      commonControls
    });
    if (state.page === "browse-by-chord") Browse.renderBrowseByChord({
      printHeaderMarkup: Print.printHeaderMarkup
    });
    if (state.page === "voicings") Changes.renderVoicingLibrary();
    if (state.page === "changes-play") renderGuidePage({
      title: "Chord Changes (Play)",
      description: "Develop voice-leading around a chosen top-note direction."
    });
    bindEvents();
  }

  backButton.addEventListener("click", () => setPage("home"));
  degreeToggle.addEventListener("change", () => {
    state.showDegrees = degreeToggle.checked;
    localStorage.setItem("gvl-show-degrees", String(state.showDegrees));
    render();
  });
  render();

  window.addEventListener("load", async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    } catch (error) {
      console.warn("Cache cleanup skipped:", error);
    }
  });
})();
