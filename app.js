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
    pageTitle.textContent = isHome
      ? "Home"
      : state.page === "forms"
        ? "Form Library"
        : "Voicing Library";
    backButton.classList.toggle("hidden", isHome);
    degreeControl.classList.toggle("hidden", isHome);
    printButton.classList.toggle("hidden", isHome);
  }

  function renderHome() {
    app.innerHTML = `
      <section class="home-grid">
        <button class="nav-card" data-go="forms" type="button">
          <span class="card-kicker">FORMS</span>
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>Form Library</h2>
          <p>Browse voicing forms</p>
        </button>

        <button class="nav-card" data-go="voicings" type="button">
          <span class="card-kicker">PROGRESSIONS</span>
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>Voicing Library</h2>
          <p>Explore chord progressions</p>
        </button>
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
    if (state.page === "voicings") Changes.renderVoicingLibrary();
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
