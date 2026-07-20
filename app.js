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

  function getInversionCoverageDiagnostic(forms) {
    const counts = {};

    forms.forEach((form) => {
      if (!counts[form.quality]) {
        counts[form.quality] = { Root: 0, "1st": 0, "2nd": 0, "3rd": 0 };
      }

      const slotInversion = getFormSlotInversion(form);
      counts[form.quality][slotInversion] = (counts[form.quality][slotInversion] ?? 0) + 1;
    });

    return counts;
  }

  function logInversionCoverageDiagnostic(forms) {
    const counts = getInversionCoverageDiagnostic(forms);
    const issues = Object.entries(counts).filter(([quality, slots]) =>
      DATA.inversions.some((inversion) => (slots[inversion] ?? 0) !== 1)
    );
    const summary = Object.entries(counts).map(([quality, slots]) =>
      `${quality}: ${DATA.inversions.map((inversion) => `${inversion}=${slots[inversion] ?? 0}`).join(", ")}`
    ).join(" | ");

    if (issues.length) {
      console.warn("[GVL] inversion coverage issue", {
        library: state.library,
        stringSet: state.stringSet,
        summary,
        counts
      });
    } else {
      console.info("[GVL] inversion coverage OK", {
        library: state.library,
        stringSet: state.stringSet,
        summary,
        counts
      });
    }

    return { counts, issues };
  }

  function cloneCandidate(candidate) {
    if (!candidate) return null;
    return {
      ...candidate,
      frets: Array.isArray(candidate.frets) ? [...candidate.frets] : candidate.frets
    };
  }

  function isMutedFret(fret) {
    return fret === null || fret === undefined || String(fret).toLowerCase() === "x";
  }

  function numericFret(fret) {
    if (isMutedFret(fret)) return null;
    const number = Number(fret);
    return Number.isFinite(number) ? number : null;
  }

  function summarizeCandidate(candidate) {
    const soundingFrets = candidate.frets
      .map(numericFret)
      .filter((fret) => fret !== null);

    const positiveFrets = soundingFrets.filter((fret) => fret > 0);
    const lowestFret = positiveFrets.length ? Math.min(...positiveFrets) : 1;
    const averageFret = soundingFrets.length
      ? soundingFrets.reduce((sum, fret) => sum + fret, 0) / soundingFrets.length
      : lowestFret;

    return {
      ...candidate,
      lowestFret,
      averageFret,
      registerPenalty: Math.abs(averageFret - 10),
      displayLabel: `${lowestFret}fr`
    };
  }

  function shiftFrets(frets, shift) {
    const shifted = [];

    for (const fret of frets) {
      if (isMutedFret(fret)) {
        shifted.push(fret);
        continue;
      }

      const number = numericFret(fret);
      if (number === null) return null;

      const next = number + shift;
      if (next < 0 || next > 21) return null;
      shifted.push(next);
    }

    return shifted;
  }

  function buildBaseCandidateForChord(chord, form) {
    const transposed = transposeForm(form, chord.root);
    const frets = transposed.frets.map((fret) => {
      if (isMutedFret(fret)) return fret;
      const number = numericFret(fret);
      return number === null ? fret : number;
    });

    return summarizeCandidate({
      ...transposed,
      frets,
      quality: chord.quality,
      inversion: getFormSlotInversion(form),
      inversionOrder: DATA.inversions.indexOf(getFormSlotInversion(form)),
      formId: form.id,
      octaveShift: 0
    });
  }

  function cloneCandidateWithShift(candidate, shift) {
    if (!candidate) return null;
    const shiftedFrets = shiftFrets(candidate.frets, shift);
    if (!shiftedFrets) return null;

    return summarizeCandidate({
      ...cloneCandidate(candidate),
      frets: shiftedFrets,
      octaveShift: (candidate.octaveShift ?? 0) + shift
    });
  }

  function candidateSignature(candidate) {
    return [
      candidate.formId,
      candidate.inversion,
      candidate.octaveShift ?? 0,
      candidate.frets.map((fret) => String(fret)).join(",")
    ].join("|");
  }

  function generatePhysicalCandidates(chord, form) {
    if (!form) return [];

    const base = buildBaseCandidateForChord(chord, form);
    const candidates = [-12, 0, 12]
      .map((shift) => shift === 0 ? base : cloneCandidateWithShift(base, shift))
      .filter(Boolean);

    const unique = new Map();
    candidates.forEach((candidate) => {
      unique.set(candidateSignature(candidate), candidate);
    });

    return [...unique.values()].sort((left, right) => {
      if (left.lowestFret !== right.lowestFret) return left.lowestFret - right.lowestFret;
      if (left.averageFret !== right.averageFret) return left.averageFret - right.averageFret;
      return candidateSignature(left).localeCompare(candidateSignature(right));
    });
  }

  function buildCandidateLookup(activeChords, forms) {
    return activeChords.map((chord) => {
      const byInversion = {};

      DATA.inversions.forEach((inversion) => {
        const form = forms.find((item) =>
          item.quality === chord.quality &&
          item.library === state.library &&
          item.stringSet === state.stringSet &&
          getFormSlotInversion(item) === inversion
        );

        byInversion[inversion] = generatePhysicalCandidates(chord, form);
      });

      return byInversion;
    });
  }

  function calculateTransitionCost(previousCandidate, candidate) {
    let totalMovement = 0;
    let maxJump = 0;
    let largeJumpCount = 0;

    previousCandidate.frets.forEach((fret, index) => {
      const nextFret = candidate.frets[index];
      if (isMutedFret(fret) || isMutedFret(nextFret)) return;

      const previousNumber = numericFret(fret);
      const nextNumber = numericFret(nextFret);
      if (previousNumber === null || nextNumber === null) return;

      const movement = Math.abs(previousNumber - nextNumber);
      totalMovement += movement;
      maxJump = Math.max(maxJump, movement);
      if (movement >= 10) largeJumpCount += 1;
    });

    return {
      totalMovement,
      maxJump,
      largeJumpCount,
      positionDrift: Math.abs(candidate.lowestFret - previousCandidate.lowestFret)
    };
  }

  function generateInversionPermutations() {
    const items = [...DATA.inversions];
    const permutations = [];

    function visit(prefix) {
      if (prefix.length === items.length) {
        permutations.push(prefix.slice());
        return;
      }

      items.forEach((item) => {
        if (!prefix.includes(item)) {
          prefix.push(item);
          visit(prefix);
          prefix.pop();
        }
      });
    }

    visit([]);
    return permutations;
  }

  function cartesianProduct(groups, visitor) {
    const selection = [];

    function walk(index) {
      if (index === groups.length) {
        visitor(selection.slice());
        return;
      }

      groups[index].forEach((item) => {
        selection.push(item);
        walk(index + 1);
        selection.pop();
      });
    }

    walk(0);
  }

  function emptyPathScore() {
    return {
      totalMovement: 0,
      maxJump: 0,
      largeJumpCount: 0,
      positionDrift: 0,
      registerPenalty: 0
    };
  }

  function addTransitionToScore(score, transitions, candidates) {
    return {
      totalMovement: score.totalMovement + transitions.reduce((sum, item) => sum + item.totalMovement, 0),
      maxJump: Math.max(score.maxJump, ...transitions.map((item) => item.maxJump)),
      largeJumpCount: score.largeJumpCount + transitions.reduce((sum, item) => sum + item.largeJumpCount, 0),
      positionDrift: score.positionDrift + transitions.reduce((sum, item) => sum + item.positionDrift, 0),
      registerPenalty: score.registerPenalty + candidates.reduce((sum, candidate) => sum + candidate.registerPenalty, 0)
    };
  }

  function comparePathScores(left, right) {
    if (left.totalMovement !== right.totalMovement) return left.totalMovement - right.totalMovement;
    if (left.maxJump !== right.maxJump) return left.maxJump - right.maxJump;
    if (left.largeJumpCount !== right.largeJumpCount) return left.largeJumpCount - right.largeJumpCount;
    if (left.positionDrift !== right.positionDrift) return left.positionDrift - right.positionDrift;
    if (left.registerPenalty !== right.registerPenalty) return left.registerPenalty - right.registerPenalty;
    return 0;
  }

  function clonePattern(pattern) {
    return {
      patternIndex: pattern.patternIndex,
      startingInversion: pattern.startingInversion,
      path: pattern.path.map((candidate) => cloneCandidate(candidate))
    };
  }

  function cloneOptimizerState(stateItem) {
    return {
      score: { ...stateItem.score },
      patterns: stateItem.patterns.map((pattern) => clonePattern(pattern)),
      signature: stateItem.signature
    };
  }

  function currentStateSignature(candidates) {
    return candidates.map(candidateSignature).join(";;");
  }

  function createInitialStates(candidateLookup) {
    const startingInversions = ["Root", "1st", "2nd", "3rd"];
    const groups = startingInversions.map((inversion) => candidateLookup[0][inversion] ?? []);
    const states = [];

    if (groups.some((group) => group.length === 0)) return states;

    cartesianProduct(groups, (candidates) => {
      const patterns = candidates.map((candidate, patternIndex) => ({
        patternIndex,
        startingInversion: startingInversions[patternIndex],
        path: [cloneCandidate(candidate)]
      }));

      const score = {
        ...emptyPathScore(),
        registerPenalty: candidates.reduce((sum, candidate) => sum + candidate.registerPenalty, 0)
      };

      states.push({
        score,
        patterns,
        signature: currentStateSignature(candidates)
      });
    });

    return states;
  }

  function optimizePhysicalVoiceLeading(activeChords, candidateLookup) {
    const permutations = generateInversionPermutations();
    const BEAM_WIDTH = 320;
    let states = createInitialStates(candidateLookup);

    for (let chordIndex = 1; chordIndex < activeChords.length; chordIndex += 1) {
      const bestByCurrentState = new Map();

      states.forEach((previousState) => {
        permutations.forEach((permutation) => {
          const candidateGroups = permutation.map((inversion) =>
            candidateLookup[chordIndex][inversion] ?? []
          );

          if (candidateGroups.some((group) => group.length === 0)) return;

          cartesianProduct(candidateGroups, (currentCandidates) => {
            const transitions = currentCandidates.map((candidate, patternIndex) => {
              const previousCandidate = previousState.patterns[patternIndex].path[chordIndex - 1];
              return calculateTransitionCost(previousCandidate, candidate);
            });

            const score = addTransitionToScore(previousState.score, transitions, currentCandidates);
            const patterns = previousState.patterns.map((pattern, patternIndex) => ({
              patternIndex: pattern.patternIndex,
              startingInversion: pattern.startingInversion,
              path: [...pattern.path.map((candidate) => cloneCandidate(candidate)), cloneCandidate(currentCandidates[patternIndex])]
            }));

            const signature = currentStateSignature(currentCandidates);
            const stateKey = `${chordIndex}|${signature}`;
            const currentBest = bestByCurrentState.get(stateKey);

            const nextState = { score, patterns, signature };
            if (!currentBest ||
                comparePathScores(score, currentBest.score) < 0 ||
                (comparePathScores(score, currentBest.score) === 0 && signature < currentBest.signature)) {
              bestByCurrentState.set(stateKey, nextState);
            }
          });
        });
      });

      states = [...bestByCurrentState.values()]
        .sort((left, right) => {
          const scoreOrder = comparePathScores(left.score, right.score);
          if (scoreOrder !== 0) return scoreOrder;
          return left.signature.localeCompare(right.signature);
        })
        .slice(0, BEAM_WIDTH);
    }

    return states.length ? cloneOptimizerState(states[0]) : null;
  }

  function applyWholePatternOctaveShift(patternPath, shift) {
    const shiftedPath = patternPath.map((candidate) => cloneCandidateWithShift(candidate, shift));
    if (shiftedPath.some((candidate) => !candidate)) return null;
    return shiftedPath;
  }

  function generateWholePatternPlacements(pattern) {
    const variants = [-12, 0, 12]
      .map((shift) => {
        const path = shift === 0
          ? pattern.path.map((candidate) => cloneCandidate(candidate))
          : applyWholePatternOctaveShift(pattern.path, shift);

        return path
          ? {
              patternIndex: pattern.patternIndex,
              startingInversion: pattern.startingInversion,
              shift,
              path
            }
          : null;
      })
      .filter(Boolean);

    const unique = new Map();
    variants.forEach((variant) => {
      const key = variant.path.map(candidateSignature).join(";;");
      unique.set(key, variant);
    });

    return [...unique.values()];
  }

  function averagePatternRegister(pattern) {
    return pattern.path.reduce((sum, candidate) => sum + (candidate.averageFret ?? candidate.lowestFret ?? 0), 0) / Math.max(1, pattern.path.length);
  }

  function registerHeightPenalty(patterns) {
    return patterns.reduce((sum, pattern) => sum + pattern.path.reduce((patternSum, candidate) => {
      if (!candidate) return patternSum;
      const lowestFret = Number(candidate.lowestFret);
      return patternSum + (Number.isFinite(lowestFret) ? lowestFret : 0);
    }, 0), 0);
  }

  function registerDistributionScore(patterns) {
    const averages = patterns.map(averagePatternRegister);
    const allHighCount = patterns.filter((pattern) =>
      pattern.path.every((candidate) => candidate.lowestFret >= 13)
    ).length;

    let overlapPenalty = 0;
    for (let left = 0; left < averages.length; left += 1) {
      for (let right = left + 1; right < averages.length; right += 1) {
        overlapPenalty += Math.max(0, 3 - Math.abs(averages[left] - averages[right]));
      }
    }

    return {
      highExcess: Math.max(0, allHighCount - 1),
      registerHeight: registerHeightPenalty(patterns),
      overlapPenalty,
      centerPenalty: averages.reduce((sum, average) => sum + Math.abs(average - 10), 0),
      signature: patterns
        .map((pattern) => `${pattern.patternIndex}:${pattern.shift}:${pattern.path.map(candidateSignature).join("/")}`)
        .join(";;")
    };
  }

  function compareRegisterScores(left, right) {
    if (left.highExcess !== right.highExcess) return left.highExcess - right.highExcess;
    if (left.registerHeight !== right.registerHeight) return left.registerHeight - right.registerHeight;
    if (left.overlapPenalty !== right.overlapPenalty) return left.overlapPenalty - right.overlapPenalty;
    if (left.centerPenalty !== right.centerPenalty) return left.centerPenalty - right.centerPenalty;
    return left.signature.localeCompare(right.signature);
  }

  function selectBestRegisterDistribution(patterns) {
    const groups = patterns.map(generateWholePatternPlacements);
    let best = null;

    cartesianProduct(groups, (selection) => {
      const ordered = [...selection].sort((left, right) => left.patternIndex - right.patternIndex);
      const score = registerDistributionScore(ordered);

      if (!best || compareRegisterScores(score, best.score) < 0) {
        best = {
          score,
          patterns: ordered.map((pattern) => ({
            patternIndex: pattern.patternIndex,
            startingInversion: pattern.startingInversion,
            path: pattern.path.map((candidate) => cloneCandidate(candidate))
          }))
        };
      }
    });

    return best ? best.patterns : patterns.map((pattern) => clonePattern(pattern));
  }

  function buildFallbackPatterns(activeChords, candidateLookup) {
    return DATA.inversions.map((inversion, patternIndex) => {
      const path = [];
      let previousCandidate = null;

      activeChords.forEach((_, chordIndex) => {
        const candidates = candidateLookup[chordIndex][inversion] ?? [];
        const ranked = [...candidates].sort((left, right) => {
          if (!previousCandidate) {
            if (left.registerPenalty !== right.registerPenalty) return left.registerPenalty - right.registerPenalty;
          } else {
            const leftCost = calculateTransitionCost(previousCandidate, left);
            const rightCost = calculateTransitionCost(previousCandidate, right);
            if (leftCost.totalMovement !== rightCost.totalMovement) {
              return leftCost.totalMovement - rightCost.totalMovement;
            }
            if (leftCost.maxJump !== rightCost.maxJump) return leftCost.maxJump - rightCost.maxJump;
          }
          return candidateSignature(left).localeCompare(candidateSignature(right));
        });

        const selected = ranked[0] ?? null;
        path.push(selected ? cloneCandidate(selected) : null);
        previousCandidate = selected;
      });

      return {
        patternIndex,
        startingInversion: inversion,
        path
      };
    });
  }

  function validateAndFinalizePatternPaths(patterns, activeChords) {
    const expectedStarts = ["Root", "1st", "2nd", "3rd"];
    const ordered = [...patterns].sort((left, right) => left.patternIndex - right.patternIndex);

    const validCount = ordered.length === 4;
    const completePaths = ordered.every((pattern) =>
      pattern.path.length === activeChords.length &&
      pattern.path.every(Boolean)
    );
    const validStarts = ordered.every((pattern, index) =>
      pattern.path[0]?.inversion === expectedStarts[index]
    );

    let validCoverage = true;
    for (let chordIndex = 0; chordIndex < activeChords.length; chordIndex += 1) {
      const inversions = ordered.map((pattern) => pattern.path[chordIndex]?.inversion);
      if (DATA.inversions.some((inversion) => !inversions.includes(inversion))) {
        validCoverage = false;
        break;
      }
    }

    if (!validCount || !completePaths || !validStarts || !validCoverage) {
      console.warn("[GVL] optimized pattern validation failed", {
        validCount,
        completePaths,
        validStarts,
        validCoverage
      });
    }

    return ordered;
  }

  function validatePhysicalPath(patternPath) {
    const warnings = [];

    patternPath.forEach((candidate, index) => {
      if (index === 0 || !candidate) return;
      const previousCandidate = patternPath[index - 1];
      const transition = calculateTransitionCost(previousCandidate, candidate);

      if (transition.maxJump >= 10 ||
          Math.abs(candidate.lowestFret - previousCandidate.lowestFret) >= 10) {
        warnings.push({
          chordIndex: index,
          maxMovement: transition.maxJump,
          previousPosition: previousCandidate.lowestFret,
          currentPosition: candidate.lowestFret
        });
      }
    });

    return warnings;
  }

  function logFinalPatternDiagnostic(patterns, activeChords) {
    patterns.forEach((pattern) => {
      console.info(`[GVL] Pattern ${pattern.patternIndex + 1}`, {
        patternIndex: pattern.patternIndex,
        startingInversion: pattern.startingInversion,
        firstInversion: pattern.path?.[0]?.inversion ?? "—",
        inversionSequence: pattern.path.map((candidate) => candidate?.inversion ?? "—"),
        fretTrajectory: pattern.path.map((candidate) => candidate ? `${candidate.lowestFret}fr` : "—")
      });
    });

    if (activeChords.length) {
      console.info("[GVL] inversion coverage", activeChords.map((_, chordIndex) => ({
        chordIndex,
        inversions: patterns.map((pattern) => pattern.path?.[chordIndex]?.inversion ?? null)
      })));
    }
  }

  function buildAutomaticVoiceLedPatterns(activeChords, forms) {
    if (!activeChords.length) return [];

    const candidateLookup = buildCandidateLookup(activeChords, forms);
    const optimized = optimizePhysicalVoiceLeading(activeChords, candidateLookup);

    let patterns = optimized
      ? optimized.patterns.map((pattern) => clonePattern(pattern))
      : buildFallbackPatterns(activeChords, candidateLookup);

    patterns = selectBestRegisterDistribution(patterns);
    patterns = validateAndFinalizePatternPaths(patterns, activeChords);

    if (patterns.length !== 4 || patterns.some((pattern) => pattern.path.some((candidate) => !candidate))) {
      patterns = buildFallbackPatterns(activeChords, candidateLookup);
    }

    logFinalPatternDiagnostic(patterns, activeChords);

    patterns.forEach((pattern) => {
      const warnings = validatePhysicalPath(pattern.path);
      if (warnings.length) {
        console.warn("[GVL] physical path warning", {
          patternIndex: pattern.patternIndex,
          warnings
        });
      }
    });

    return patterns;
  }

  function setPage(page) {
    state.page = page;
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function updatePrintStyle() {
    printStyle.textContent = state.page === "forms"
      ? "@page { size: A4 landscape; margin: 8mm; }"
      : "@page { size: A4 portrait; margin: 7mm; }";
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

  function printHeaderMarkup() {
    const activeChords = state.page === "voicings"
      ? state.chords.filter((chord) => chord.root)
      : [];

    const headerValue = state.page === "forms"
      ? state.root
      : activeChords.map((chord) => `${chord.root}${displayQuality(chord.quality)}`).join(" → ");

    const headerLabel = state.page === "voicings" ? "CHORDS:" : "ROOT:";

    return `
      <div class="print-header" aria-hidden="true">
        <div class="print-header-item">DROP2 ${escapeHtml(state.library.toUpperCase())}</div>
        <div class="print-header-item">${escapeHtml(headerLabel)} ${escapeHtml(headerValue)}</div>
        <div class="print-header-item">String Set: ${escapeHtml(state.stringSet)}</div>
      </div>
    `;
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
    return DATA.forms.filter((form) =>
      form.library === state.library && form.stringSet === state.stringSet
    );
  }

  function renderFormLibrary() {
    const forms = currentForms();
    logInversionCoverageDiagnostic(forms);
    const byKey = new Map(forms.map((form) => [`${form.quality}|${getFormSlotInversion(form)}`, form]));
    let selected = forms.find((form) => form.id === state.selectedFormId);

    if (!selected) selected = forms[0] ?? null;
    if (selected) state.selectedFormId = selected.id;

    const table = [
      `<div class="table-cell header">Quality</div>`,
      ...DATA.inversions.map((inversion) => `<div class="table-cell header">${escapeHtml(inversion)}</div>`)
    ];

    DATA.qualities.forEach((quality) => {
      table.push(`<div class="table-cell row-label">${escapeHtml(displayQuality(quality))}</div>`);

      DATA.inversions.forEach((inversion) => {
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
        <div class="form-table">${table.join("")}</div>
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
              <p>${escapeHtml(selected.inversion)} (Drop2)</p>
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

  function renderChordControls() {
    const rootOptions = ["", ...DATA.roots];

    return state.chords.map((chord, index) => `
      <div class="chord-row ${chord.root ? "" : "is-empty"}">
        <div class="chord-number">Chord ${index + 1}</div>

        <div class="control-group">
          <label for="chordRoot${index}">Root</label>
          <select id="chordRoot${index}" data-chord-index="${index}" data-chord-field="root">
            ${rootOptions.map((item) => `
              <option value="${escapeHtml(item)}"${item === chord.root ? " selected" : ""}>
                ${item ? escapeHtml(item) : "—"}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="control-group">
          <label for="chordQuality${index}">Quality</label>
          <select id="chordQuality${index}" data-chord-index="${index}" data-chord-field="quality"${chord.root ? "" : " disabled"}>
            ${options(DATA.qualities, chord.quality)}
          </select>
        </div>
      </div>
    `).join("");
  }

  function renderVoicingLibrary() {
    const forms = currentForms();
    logInversionCoverageDiagnostic(forms);
    const activeChords = state.chords
      .map((chord, index) => ({ ...chord, originalIndex: index }))
      .filter((chord) => chord.root);

    app.innerHTML = `
      ${printHeaderMarkup()}
      ${commonControls({ includeRoot: false })}

      <section class="panel voicing-chords">
        ${renderChordControls()}
      </section>

      <div class="section-heading">
        <h2>Chord Changes</h2>
        <p>${activeChords.length} ${activeChords.length === 1 ? "chord" : "chords"} x 4 patterns</p>
      </div>

      <section id="patternList" class="pattern-list"></section>
    `;

    const list = document.querySelector("#patternList");

    if (activeChords.length === 0) {
      list.innerHTML = `<div class="empty-state panel">Select at least one chord.</div>`;
      return;
    }

    const patterns = buildAutomaticVoiceLedPatterns(activeChords, forms);

    patterns.forEach((pattern) => {
      const group = document.createElement("section");
      group.className = "pattern-group";

      const heading = document.createElement("div");
      heading.className = "pattern-heading";
      heading.innerHTML = `
        <h3>Pattern ${pattern.patternIndex + 1}</h3>
        <p>${activeChords.map((chord) => `${escapeHtml(chord.root)}${escapeHtml(displayQuality(chord.quality))}`).join(" &rarr; ")}</p>
      `;

      const grid = document.createElement("div");
      grid.className = "pattern-grid";

      activeChords.forEach((chord, sequenceIndex) => {
        const candidate = pattern.path[sequenceIndex];
        const card = document.createElement("article");
        card.className = "voicing-card";

        const title = document.createElement("h4");
        title.textContent = `${chord.root}${displayQuality(chord.quality)}`;

        const meta = document.createElement("p");
        meta.className = "voicing-meta";
        meta.innerHTML = `
          <span class="voicing-inversion">${escapeHtml(candidate ? candidate.inversion : "")}</span>
          <span class="voicing-separator" aria-hidden="true">${candidate ? "-" : ""}</span>
          <span class="voicing-fret">${escapeHtml(candidate ? candidate.displayLabel : "")}</span>
          <span class="voicing-separator" aria-hidden="true">${candidate ? "-" : ""}</span>
          <span class="voicing-chord-number">Chord ${chord.originalIndex + 1}</span>
        `;

        card.append(title, meta);

        if (!candidate) {
          const empty = document.createElement("div");
          empty.className = "empty-state compact";
          empty.textContent = "No form";
          card.appendChild(empty);
        } else {
          const host = document.createElement("div");
          host.className = "fretboard-host";
          card.appendChild(host);

          requestAnimationFrame(() => {
            Fretboard.render(host, candidate, {
              size: "small",
              orientation: state.orientation,
              showDegrees: state.showDegrees,
              preserveAbsolutePositions: true
            });
          });
        }

        grid.appendChild(card);
      });

      group.append(heading, grid);
      list.appendChild(group);
    });
  }

  function bindEvents() {
    printButton.onclick = () => {
      updatePrintStyle();
      requestAnimationFrame(() => {
        window.setTimeout(() => window.print(), 80);
      });
    };

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
    updatePrintStyle();
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

  // Development build: remove old service workers and caches so CSS/JS/data
  // can never become mixed between releases on iOS Safari.
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
