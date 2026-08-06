(() => {
  "use strict";

  const DATA = window.GVL_DATA;
  const Fretboard = window.GuitarFretboard;
  const Browse = window.GVL_BROWSE;
  const Changes = window.GVL_CHANGES;
  const Print = window.GVL_PRINT;
  const Play = window.GVL_PLAY;

  const translations = {
    en: {
      home: "Home", formsPage: "Form Library", voicingsPage: "Voicing Library",
      browseChordPage: "Browse by Chord", playPage: "Chord Changes (Play)",
      browseVoicing: "Browse by Voicing", browseVoicingDesc: "Explore forms by family, variant, and string set.",
      browseChord: "Browse by Chord", browseChordDesc: "Find voicings from a root and chord quality.",
      chordStudy: "Chord Changes (Study)", chordStudyDesc: "Examine optimized voice-leading through changes.",
      chordPlay: "Chord Changes (Play)", chordPlayDesc: "Shape voice-leading with a top-note focus.",
      family: "Family", variant: "Variant", stringSet: "String Set", root: "Root", quality: "Quality",
      inversion: "Inversion", view: "View", horizontal: "Horizontal", vertical: "Vertical",
      standard: "Standard", practical: "Practical", print: "Print", degrees: "Degrees",
      backAria: "Back", printAria: "Print current view", languageButton: "日本語", languageAria: "日本語表示に切り替える",
      forms: "Forms", selectedForm: "Selected Form", notes: "Notes", noMatchingForms: "No matching forms yet.",
      printLayout: "Print layout", portrait: "Portrait", landscape: "Landscape", voicingDetails: "Voicing details", close: "Close",
      chord: "Chord", chords: "chords", pattern: "Pattern", noForm: "No form", selectChord: "Select at least one chord.",
      changesUnavailable: "Chord Changes is currently available for Drop2 and Drop3 only.",
      remove: "Remove", addChord: "Add chord", refresh: "Refresh", noVoicing: "No available voicing",
      ascending: "Ascending", descending: "Descending", nearest: "Nearest", rootPosition: "Root Position"
    },
    ja: {
      home: "ホーム", formsPage: "ボイシングから", voicingsPage: "コード進行（学習用）",
      browseChordPage: "コードから", playPage: "コード進行（練習用）",
      browseVoicing: "ボイシングから", browseVoicingDesc: "種類・バリエーション・弦セットから探します。",
      browseChord: "コードから", browseChordDesc: "ルートとコードタイプから探します。",
      chordStudy: "コード進行（学習用）", chordStudyDesc: "コード進行に合うボイシングを確認します。",
      chordPlay: "コード進行（練習用）", chordPlayDesc: "トップノートを意識してコードチェンジを練習します。",
      family: "ボイシング", variant: "バリエーション", stringSet: "弦セット", root: "ルート", quality: "コードタイプ",
      inversion: "転回形", view: "表示", horizontal: "横向き", vertical: "縦向き",
      standard: "基本", practical: "実践", print: "印刷", degrees: "度数",
      backAria: "戻る", printAria: "現在の画面を印刷", languageButton: "English", languageAria: "Switch to English",
      forms: "ボイシング一覧", selectedForm: "選択中のボイシング", notes: "メモ", noMatchingForms: "一致するボイシングがありません。",
      printLayout: "印刷レイアウト", portrait: "縦", landscape: "横", voicingDetails: "ボイシング詳細", close: "閉じる",
      chord: "コード", chords: "コード", pattern: "パターン", noForm: "ボイシングなし", selectChord: "コードを1つ以上選択してください。",
      changesUnavailable: "コード進行は現在、Drop2とDrop3のみ対応しています。",
      remove: "削除", addChord: "コードを追加", refresh: "更新", noVoicing: "使用できるボイシングがありません",
      ascending: "上行", descending: "下行", nearest: "最短", rootPosition: "ルートポジション"
    }
  };

  const state = {
    language: "en",
    page: "home",
    family: "Drop2",
    variant: "Standard",
    stringSet: "2-5",
    root: "C",
    browseByChordRoot: "C",
    browseByChordQuality: "Maj7",
    browseByChordPrintOrientation: "portrait",
    selectedBrowseByChordFormId: "",
    playChords: [{ root: "D", quality: "m7" }, { root: "G", quality: "7" }, { root: "C", quality: "Maj7" }],
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
  const languageToggle = document.querySelector("#languageToggle");
  const degreeLabel = document.querySelector("#degreeLabel");
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

  function t(key) {
    return translations[state.language]?.[key] ?? translations.en[key] ?? key;
  }

  function displayUiValue(value) {
    if (value === "Standard") return t("standard");
    if (value === "Practical") return t("practical");
    return value;
  }

  function options(items, selected) {
    return items
      .map((item) => `<option value="${escapeHtml(item)}"${item === selected ? " selected" : ""}>${escapeHtml(displayUiValue(item))}</option>`)
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

  const helpers = { escapeHtml, options, displayQuality, transposeForm, getFormSlotInversion, t, displayUiValue };
  Browse.configure({ DATA, Fretboard, state, app, helpers });
  Print.configure({ state, printStyle, helpers });
  Play.configure({ DATA, Fretboard, state, app, helpers, rerender: () => render() });

  function setPage(page) {
    state.page = page;
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderHeader() {
    const isHome = state.page === "home";
    const pageTitles = {
      home: t("home"),
      forms: t("formsPage"),
      voicings: t("voicingsPage"),
      "browse-by-chord": t("browseChordPage"),
      "changes-play": t("playPage")
    };
    const hasViewControls = state.page === "forms" || state.page === "voicings" || state.page === "browse-by-chord" || state.page === "changes-play";

    document.documentElement.lang = state.language;
    pageTitle.textContent = pageTitles[state.page] ?? t("home");
    backButton.setAttribute("aria-label", t("backAria"));
    backButton.classList.toggle("hidden", isHome);
    degreeControl.classList.toggle("hidden", !hasViewControls);
    printButton.classList.toggle("hidden", !hasViewControls);
    printButton.textContent = t("print");
    printButton.setAttribute("aria-label", t("printAria"));
    degreeLabel.textContent = t("degrees");
    languageToggle.textContent = t("languageButton");
    languageToggle.setAttribute("aria-label", t("languageAria"));
    languageToggle.classList.toggle("hidden", !isHome);
  }

  function renderHome() {
    app.innerHTML = `
      <section class="home-grid">
        <button class="nav-card" data-go="forms" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>${escapeHtml(t("browseVoicing"))}</h2>
          <p>${escapeHtml(t("browseVoicingDesc"))}</p>
        </button>

        <button class="nav-card" data-go="browse-by-chord" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>${escapeHtml(t("browseChord"))}</h2>
          <p>${escapeHtml(t("browseChordDesc"))}</p>
        </button>

        <button class="nav-card" data-go="voicings" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>${escapeHtml(t("chordStudy"))}</h2>
          <p>${escapeHtml(t("chordStudyDesc"))}</p>
        </button>

        <button class="nav-card" data-go="changes-play" type="button">
          <span class="arrow" aria-hidden="true">&rsaquo;</span>
          <h2>${escapeHtml(t("chordPlay"))}</h2>
          <p>${escapeHtml(t("chordPlayDesc"))}</p>
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
            <label for="familySelect">${escapeHtml(t("family"))}</label>
            <select id="familySelect">${options(Browse.availableFamilies(), state.family)}</select>
          </div>
          <div class="control-group">
            <label for="variantSelect">${escapeHtml(t("variant"))}</label>
            <select id="variantSelect">${options(Browse.availableVariants(), state.variant)}</select>
          </div>
          <div class="control-group">
            <label for="stringSetSelect">${escapeHtml(t("stringSet"))}</label>
            <select id="stringSetSelect">${options(Browse.availableStringSets(), state.stringSet)}</select>
          </div>
          ${includeRoot ? `
            <div class="control-group">
              <label for="rootSelect">${escapeHtml(t("root"))}</label>
              <select id="rootSelect">${options(DATA.roots, state.root)}</select>
            </div>
          ` : ""}
          <div class="control-group">
            <span class="control-label">${escapeHtml(t("view"))}</span>
            <div class="segmented" data-segment="orientation">
              <button class="${state.orientation === "horizontal" ? "active" : ""}" data-value="horizontal" type="button">${escapeHtml(t("horizontal"))}</button>
              <button class="${state.orientation === "vertical" ? "active" : ""}" data-value="vertical" type="button">${escapeHtml(t("vertical"))}</button>
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
    document.querySelectorAll("[data-segment='print-orientation'] button").forEach((button) => {
      button.addEventListener("click", () => {
        state.browseByChordPrintOrientation = button.dataset.value;
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
    if (state.page === "changes-play") Play.render();
    bindEvents();
  }

  let languageToggleLocked = false;

  function toggleLanguage(event) {
    event?.preventDefault();
    event?.stopPropagation();

    // iOS Safariで click / touchend が連続発火した場合の二重切替を防ぐ。
    if (languageToggleLocked) return false;
    languageToggleLocked = true;

    state.language = state.language === "en" ? "ja" : "en";
    render();

    window.setTimeout(() => {
      languageToggleLocked = false;
    }, 350);

    return false;
  }

  // HTML側のonclickからも呼べるようにして、Safariでも確実に反応させる。
  window.GVL_toggleLanguage = toggleLanguage;

  languageToggle.addEventListener("click", toggleLanguage);
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
