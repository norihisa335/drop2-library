(() => {
  "use strict";

  const DATA = window.GVL_DATA;
  const Fretboard = window.GuitarFretboard;

  const state = {
    page: "home",
    library: "Standard",
    stringSet: "2-5",
    root: "C",
    orientation: "horizontal",
    showDegrees: localStorage.getItem("gvl-show-degrees") !== "false",
    selectedFormId: "M7-25-R-01",
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
    return items.map((item) =>
      `<option value="${escapeHtml(item)}"${item === selected ? " selected" : ""}>${escapeHtml(item)}</option>`
    ).join("");
  }

  function setPage(page) {
    state.page = page;
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
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
  }

  function renderHome() {
    app.innerHTML = `
      <section class="hero">
        <h2>Find the shape.<br>Hear the movement.</h2>
        <p>A clear, practical reference for guitar voicings and chord progressions.</p>
      </section>

      <section class="home-grid">
        <button class="nav-card" data-go="forms" type="button">
          <span class="card-kicker">FORMS</span>
          <span class="arrow">âº</span>
          <h2>Form Library</h2>
          <p>Browse voicing forms</p>
        </button>

        <button class="nav-card" data-go="voicings" type="button">
          <span class="card-kicker">PROGRESSIONS</span>
          <span class="arrow">âº</span>
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
            <label for="librarySelect">Library</label>
            <select id="librarySelect">${options(DATA.libraries, state.library)}</select>
          </div>

          <div class="control-group">
            <label for="stringSetSelect">String Set</label>
            <select id="stringSetSelect">${options(DATA.stringSets, state.stringSet)}</select>
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

  function currentForms() {
    const exact = DATA.forms.filter((form) =>
      form.library === state.library && form.stringSet === state.stringSet
    );

    // Demo fallback while Practical and 1â4 data are still being entered.
    return exact.length ? exact : DATA.forms.filter((form) => form.stringSet === "2-5");
  }

  function renderFormLibrary() {
    const forms = currentForms();
    const byKey = new Map(forms.map((form) => [`${form.quality}|${form.inversion}`, form]));
    let selected = forms.find((form) => form.id === state.selectedFormId) ?? forms[0];

    if (selected) state.selectedFormId = selected.id;

    const table = [
      `<div class="table-cell header"></div>`,
      ...DATA.inversions.map((inv) => `<div class="table-cell header">${escapeHtml(inv)}</div>`)
    ];

    DATA.qualities.forEach((quality) => {
      table.push(`<div class="table-cell row-label">${escapeHtml(quality)}</div>`);
      DATA.inversions.forEach((inversion) => {
        const form = byKey.get(`${quality}|${inversion}`);
        table.push(`
          <div class="table-cell">
            ${form
              ? `<button class="form-button ${form.id === state.selectedFormId ? "selected" : ""}" data-form-id="${escapeHtml(form.id)}" type="button">${escapeHtml(inversion)}</button>`
              : `<span aria-hidden="true">â</span>`}
          </div>
        `);
      });
    });

    app.innerHTML = `
      ${commonControls()}

      <div class="section-heading">
        <h2>Forms</h2>
        <p>${escapeHtml(state.stringSet)} strings</p>
      </div>

      <section class="form-table-wrap">
        <div class="form-table">${table.join("")}</div>
      </section>

      <div class="section-heading">
        <h2>Selected Form</h2>
        <p>${selected ? escapeHtml(selected.id) : ""}</p>
      </div>

      ${selected ? `
        <section class="selected-card">
          <div class="selected-meta">
            <div>
              <h3>${escapeHtml(state.root)}${escapeHtml(selected.quality)}</h3>
              <p>${escapeHtml(selected.inversion)} Â· ${escapeHtml(selected.category)}</p>
            </div>
            <p>${escapeHtml(selected.stringSet)}</p>
          </div>

          <div id="selectedFretboard" class="fretboard-host"></div>

          <div class="use-case">
            <strong>Use Case</strong><br>
            ${escapeHtml(selected.useCase)}
          </div>
        </section>
      ` : `<div class="empty-state">No matching forms yet.</div>`}
    `;

    if (selected) {
      Fretboard.render("#selectedFretboard", selected, {
        size: "large",
        orientation: state.orientation,
        showDegrees: state.showDegrees
      });
    }
  }

  function renderChordControls() {
    return state.chords.map((chord, index) => `
      <div class="chord-row">
        <div class="chord-number">Chord ${index + 1}</div>
        <div class="control-group">
          <label for="chordRoot${index}">Root</label>
          <select id="chordRoot${index}" data-chord-index="${index}" data-chord-field="root">
            ${options(DATA.roots, chord.root)}
          </select>
        </div>
        <div class="control-group">
          <label for="chordQuality${index}">Quality</label>
          <select id="chordQuality${index}" data-chord-index="${index}" data-chord-field="quality">
            ${options(DATA.qualities, chord.quality)}
          </select>
        </div>
      </div>
    `).join("");
  }

  function renderVoicingLibrary() {
    const forms = currentForms();

    app.innerHTML = `
      ${commonControls({ includeRoot: false })}

      <section class="panel voicing-chords">
        ${renderChordControls()}
      </section>

      <div class="section-heading">
        <h2>Voicings</h2>
        <p>4 chords Ã 4 inversions</p>
      </div>

      <section id="voicingGrid" class="voicing-grid"></section>
    `;

    const grid = document.querySelector("#voicingGrid");

    state.chords.forEach((chord, chordIndex) => {
      DATA.inversions.forEach((inversion) => {
        const form = forms.find((item) =>
          item.quality === chord.quality && item.inversion === inversion
        );

        const card = document.createElement("article");
        card.className = "voicing-card";

        if (!form) {
          card.innerHTML = `
            <h3>${escapeHtml(chord.root)}${escapeHtml(chord.quality)}</h3>
            <p>${escapeHtml(inversion)}</p>
            <div class="empty-state">No form</div>
          `;
          grid.appendChild(card);
          return;
        }

        const title = document.createElement("h3");
        title.textContent = `${chord.root}${chord.quality}`;
        const meta = document.createElement("p");
        meta.textContent = `${inversion} Â· Chord ${chordIndex + 1}`;
        const host = document.createElement("div");
        host.className = "fretboard-host";

        card.append(title, meta, host);
        grid.appendChild(card);

        Fretboard.render(host, form, {
          size: "small",
          orientation: state.orientation,
          showDegrees: state.showDegrees
        });
      });
    });
  }

  function bindEvents() {
    document.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => setPage(button.dataset.go));
    });

    document.querySelector("#librarySelect")?.addEventListener("change", (event) => {
      state.library = event.target.value;
      render();
    });

    document.querySelector("#stringSetSelect")?.addEventListener("change", (event) => {
      state.stringSet = event.target.value;
      render();
    });

    document.querySelector("#rootSelect")?.addEventListener("change", (event) => {
      state.root = event.target.value;
      renderFormLibrary();
      bindEvents();
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
        renderFormLibrary();
        bindEvents();
      });
    });

    document.querySelectorAll("[data-chord-index]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.dataset.chordIndex);
        state.chords[index][select.dataset.chordField] = select.value;
        renderVoicingLibrary();
        bindEvents();
      });
    });
  }

  function render() {
    renderHeader();

    if (state.page === "home") renderHome();
    if (state.page === "forms") renderFormLibrary();
    if (state.page === "voicings") renderVoicingLibrary();

    bindEvents();
  }

  backButton.addEventListener("click", () => setPage("home"));

  degreeToggle.addEventListener("change", () => {
    state.showDegrees = degreeToggle.checked;
    localStorage.setItem("gvl-show-degrees", String(state.showDegrees));
    render();
  });

  render();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(console.error);
    });
  }
})();
