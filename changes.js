(() => {
  "use strict";

  let DATA, Fretboard, state, app, helpers, renderDependencies;
  const inversionPermutationCache = new Map();
  const physicalCandidateCache = new WeakMap();
  const candidateSignatureCache = new WeakMap();
  const transitionCostCache = new WeakMap();

  function configure(context) {
    ({ DATA, Fretboard, state, app } = context);
    helpers = context.helpers;
    renderDependencies = context.renderDependencies;
  }

  const transposeForm = (...args) => helpers.transposeForm(...args);
  const getFormSlotInversion = (...args) => helpers.getFormSlotInversion(...args);
  const availableInversions = (...args) => helpers.availableInversions(...args);
  const availableQualities = (...args) => helpers.availableQualities(...args);
  const supportsChordChanges = (...args) => helpers.supportsChordChanges(...args);
  const displayQuality = (...args) => helpers.displayQuality(...args);
  const t = (...args) => helpers.t(...args);
  const escapeHtml = (...args) => helpers.escapeHtml(...args);
  const options = (...args) => helpers.options(...args);
  const currentForms = (...args) => helpers.currentForms(...args);
  const logInversionCoverageDiagnostic = (...args) => helpers.logInversionCoverageDiagnostic(...args);
  const printHeaderMarkup = (...args) => renderDependencies.printHeaderMarkup(...args);
  const commonControls = (...args) => renderDependencies.commonControls(...args);
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
      inversionOrder: availableInversions().indexOf(getFormSlotInversion(form)),
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
    const cached = candidateSignatureCache.get(candidate);
    if (cached) return cached;

    const signature = [
      candidate.formId,
      candidate.inversion,
      candidate.octaveShift ?? 0,
      candidate.frets.map((fret) => String(fret)).join(",")
    ].join("|");

    candidateSignatureCache.set(candidate, signature);
    return signature;
  }

  function generatePhysicalCandidates(chord, form) {
    if (!form) return [];

    let candidatesByRoot = physicalCandidateCache.get(form);
    const cached = candidatesByRoot?.get(chord.root);
    if (cached) return cached;

    const base = buildBaseCandidateForChord(chord, form);
    const candidates = [-12, 0, 12]
      .map((shift) => shift === 0 ? base : cloneCandidateWithShift(base, shift))
      .filter(Boolean);

    const unique = new Map();
    candidates.forEach((candidate) => {
      unique.set(candidateSignature(candidate), candidate);
    });

    const sortedCandidates = [...unique.values()].sort((left, right) => {
      if (left.lowestFret !== right.lowestFret) return left.lowestFret - right.lowestFret;
      if (left.averageFret !== right.averageFret) return left.averageFret - right.averageFret;
      return candidateSignature(left).localeCompare(candidateSignature(right));
    });

    if (!candidatesByRoot) {
      candidatesByRoot = new Map();
      physicalCandidateCache.set(form, candidatesByRoot);
    }
    candidatesByRoot.set(chord.root, sortedCandidates);
    return sortedCandidates;
  }

  function buildCandidateLookup(activeChords, forms, inversions) {
    return activeChords.map((chord) => {
      const byInversion = {};

      inversions.forEach((inversion) => {
        const form = forms.find((item) =>
          item.quality === chord.quality &&
          item.family === state.family &&
          item.variant === state.variant &&
          item.stringSet === state.stringSet &&
          getFormSlotInversion(item) === inversion
        );

        byInversion[inversion] = generatePhysicalCandidates(chord, form);
      });

      return byInversion;
    });
  }

  function calculateTransitionCost(previousCandidate, candidate) {
    let cachedTransitions = transitionCostCache.get(previousCandidate);
    if (cachedTransitions?.has(candidate)) return cachedTransitions.get(candidate);

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

    const transition = {
      totalMovement,
      maxJump,
      largeJumpCount,
      positionDrift: Math.abs(candidate.lowestFret - previousCandidate.lowestFret)
    };

    if (!cachedTransitions) {
      cachedTransitions = new WeakMap();
      transitionCostCache.set(previousCandidate, cachedTransitions);
    }
    cachedTransitions.set(candidate, transition);
    return transition;
  }

  function generateInversionPermutations(inversions) {
    const cacheKey = inversions.join("|");
    const cached = inversionPermutationCache.get(cacheKey);
    if (cached) return cached;

    const items = [...inversions];
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
    inversionPermutationCache.set(cacheKey, permutations);
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

  function createInitialStates(candidateLookup, startingInversions) {
    const groups = startingInversions.map((inversion) => candidateLookup[0][inversion] ?? []);
    const states = [];

    if (groups.some((group) => group.length === 0)) return states;

    cartesianProduct(groups, (candidates) => {
      const patterns = candidates.map((candidate, patternIndex) => ({
        patternIndex,
        startingInversion: startingInversions[patternIndex],
        path: [candidate]
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

  function optimizePhysicalVoiceLeading(activeChords, candidateLookup, inversions) {
    const permutations = generateInversionPermutations(inversions);
    const BEAM_WIDTH = 320;
    let states = createInitialStates(candidateLookup, inversions);

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
            const signature = currentStateSignature(currentCandidates);
            const stateKey = `${chordIndex}|${signature}`;
            const currentBest = bestByCurrentState.get(stateKey);

            if (!currentBest ||
                comparePathScores(score, currentBest.score) < 0 ||
                (comparePathScores(score, currentBest.score) === 0 && signature < currentBest.signature)) {
              const patterns = previousState.patterns.map((pattern, patternIndex) => ({
                patternIndex: pattern.patternIndex,
                startingInversion: pattern.startingInversion,
                path: [...pattern.path, currentCandidates[patternIndex]]
              }));
              bestByCurrentState.set(stateKey, { score, patterns, signature });
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

  function buildFallbackPatterns(activeChords, candidateLookup, inversions) {
    return inversions.map((inversion, patternIndex) => {
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

  function validateAndFinalizePatternPaths(patterns, activeChords, expectedStarts) {
    const ordered = [...patterns].sort((left, right) => left.patternIndex - right.patternIndex);

    const validCount = ordered.length === expectedStarts.length;
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
      if (expectedStarts.some((inversion) => !inversions.includes(inversion))) {
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

    const inversions = availableInversions(forms);
    const candidateLookup = buildCandidateLookup(activeChords, forms, inversions);
    const optimized = optimizePhysicalVoiceLeading(activeChords, candidateLookup, inversions);

    let patterns = optimized
      ? optimized.patterns.map((pattern) => clonePattern(pattern))
      : buildFallbackPatterns(activeChords, candidateLookup, inversions);

    patterns = selectBestRegisterDistribution(patterns);
    patterns = validateAndFinalizePatternPaths(patterns, activeChords, inversions);

    if (patterns.length !== inversions.length || patterns.some((pattern) => pattern.path.some((candidate) => !candidate))) {
      patterns = buildFallbackPatterns(activeChords, candidateLookup, inversions);
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

  function renderChordControls() {
    const rootOptions = ["", ...DATA.roots];

    return state.chords.map((chord, index) => `
      <div class="chord-row ${chord.root ? "" : "is-empty"}">
        <div class="chord-number">${escapeHtml(t("chord"))} ${index + 1}</div>

        <div class="control-group">
          <label for="chordRoot${index}">${escapeHtml(t("root"))}</label>
          <select id="chordRoot${index}" data-chord-index="${index}" data-chord-field="root">
            ${rootOptions.map((item) => `
              <option value="${escapeHtml(item)}"${item === chord.root ? " selected" : ""}>
                ${item ? escapeHtml(item) : "—"}
              </option>
            `).join("")}
          </select>
        </div>

        <div class="control-group">
          <label for="chordQuality${index}">${escapeHtml(t("quality"))}</label>
          <select id="chordQuality${index}" data-chord-index="${index}" data-chord-field="quality"${chord.root ? "" : " disabled"}>
            ${options(availableQualities(), chord.quality)}
          </select>
        </div>
      </div>
    `).join("");
  }

  function renderVoicingLibrary() {
    const forms = currentForms();
    if (!supportsChordChanges()) {
      app.innerHTML = `
        ${printHeaderMarkup()}
        ${commonControls({ includeRoot: false })}
        <div class="empty-state panel">${escapeHtml(t("changesUnavailable"))}</div>
      `;
      return;
    }

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
        <h2>${escapeHtml(t("chordStudy"))}</h2>
        <p>${activeChords.length} ${escapeHtml(t(activeChords.length === 1 ? "chord" : "chords"))} × ${availableInversions(forms).length} patterns</p>
      </div>

      <section id="patternList" class="pattern-list"></section>
    `;

    const list = document.querySelector("#patternList");

    if (activeChords.length === 0) {
      list.innerHTML = `<div class="empty-state panel">${escapeHtml(t("selectChord"))}</div>`;
      return;
    }

    const patterns = buildAutomaticVoiceLedPatterns(activeChords, forms);

    patterns.forEach((pattern) => {
      const group = document.createElement("section");
      group.className = "pattern-group";

      const heading = document.createElement("div");
      heading.className = "pattern-heading";
      heading.innerHTML = `
        <h3>${escapeHtml(t("pattern"))} ${pattern.patternIndex + 1}</h3>
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
          <span class="voicing-chord-number">${escapeHtml(t("chord"))} ${chord.originalIndex + 1}</span>
        `;

        card.append(title, meta);

        if (!candidate) {
          const empty = document.createElement("div");
          empty.className = "empty-state compact";
          empty.textContent = t("noForm");
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

  window.GVL_CHANGES = {
    configure,
    buildAutomaticVoiceLedPatterns,
    renderVoicingLibrary
  };
})();
