(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const STRING_NUMBERS = [6, 5, 4, 3, 2, 1];

  function svgElement(name, attrs = {}, text = "") {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (text) el.textContent = text;
    return el;
  }

  function parseStringSet(stringSet) {
    const [high, low] = String(stringSet).split("-").map(Number);
    if (!high || !low) throw new Error(`Invalid stringSet: ${stringSet}`);

    const step = high <= low ? 1 : -1;
    const strings = [];
    for (let n = high; n !== low + step; n += step) strings.push(n);
    return strings;
  }

  function normalizeVoicing(voicing) {
    const strings = voicing.strings ?? parseStringSet(voicing.stringSet);
    const frets = voicing.frets ?? [];
    const degrees = voicing.degrees ?? [];

    if (strings.length !== frets.length) {
      throw new Error("strings and frets must contain the same number of entries.");
    }

    return { ...voicing, strings, frets, degrees };
  }

  function chooseWindow(frets, fretCount = 5) {
    const pressed = frets.filter((fret) => Number.isFinite(fret) && fret > 0);
    if (!pressed.length) return { startFret: 1, fretCount };

    const min = Math.min(...pressed);
    const max = Math.max(...pressed);

    if (max <= fretCount) return { startFret: 1, fretCount };

    let startFret = min;
    if (max - startFret + 1 > fretCount) startFret = max - fretCount + 1;

    return { startFret, fretCount };
  }

  function noteY(stringNumber, top, boardHeight) {
    const index = STRING_NUMBERS.indexOf(stringNumber);
    if (index < 0) throw new Error(`Invalid string number: ${stringNumber}`);
    return top + (boardHeight / 5) * index;
  }

  function renderFretboard(target, rawVoicing, options = {}) {
    const host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) throw new Error("Fretboard target was not found.");

    const voicing = normalizeVoicing(rawVoicing);
    const size = options.size === "large" ? "large" : "small";
    const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
    const showDegrees = options.showDegrees !== false;
    const fretCount = options.fretCount ?? 5;
    const { startFret } = chooseWindow(voicing.frets, fretCount);

    const horizontal = {
      small: { width: 260, height: 132, left: 28, right: 12, top: 24, bottom: 18 },
      large: { width: 520, height: 250, left: 46, right: 18, top: 35, bottom: 28 }
    };

    const vertical = {
      small: { width: 180, height: 250, left: 28, right: 18, top: 24, bottom: 18 },
      large: { width: 300, height: 470, left: 42, right: 24, top: 34, bottom: 28 }
    };

    const dims = orientation === "vertical" ? vertical[size] : horizontal[size];
    const { width, height, left, right, top, bottom } = dims;
    const boardWidth = width - left - right;
    const boardHeight = height - top - bottom;

    const svg = svgElement("svg", {
      class: "fretboard-svg",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": `${voicing.quality ?? "Chord"} ${voicing.inversion ?? ""} voicing`
    });

    const style = getComputedStyle(document.documentElement);
    const colors = {
      board: style.getPropertyValue("--board").trim() || "#fafafa",
      string: style.getPropertyValue("--string").trim() || "#71717a",
      fret: style.getPropertyValue("--fret").trim() || "#a1a1aa",
      marker: style.getPropertyValue("--marker").trim() || "#d4d4d8",
      note: style.getPropertyValue("--note").trim() || "#1d1d1f",
      root: style.getPropertyValue("--root-note").trim() || "#007aff",
      secondary: style.getPropertyValue("--secondary").trim() || "#6e6e73"
    };

    svg.appendChild(svgElement("rect", {
      x: left,
      y: top,
      width: boardWidth,
      height: boardHeight,
      rx: size === "large" ? 14 : 10,
      fill: colors.board
    }));

    if (startFret > 1) {
      svg.appendChild(svgElement("text", {
        x: left - 5,
        y: top + 5,
        fill: colors.secondary,
        "font-size": size === "large" ? 15 : 11,
        "font-weight": 700,
        "text-anchor": "end",
        "dominant-baseline": "middle"
      }, `${startFret}fr`));
    }

    if (orientation === "horizontal") {
      const fretWidth = boardWidth / fretCount;

      for (let i = 0; i <= fretCount; i += 1) {
        const x = left + fretWidth * i;
        const isNut = startFret === 1 && i === 0;
        svg.appendChild(svgElement("line", {
          x1: x, y1: top, x2: x, y2: top + boardHeight,
          stroke: colors.fret,
          "stroke-width": isNut ? (size === "large" ? 6 : 4) : (size === "large" ? 2 : 1.3),
          "stroke-linecap": "round"
        }));
      }

      STRING_NUMBERS.forEach((stringNumber, index) => {
        const y = top + (boardHeight / 5) * index;
        const thickness = (size === "large" ? 1.3 : .8) + (6 - index) * (size === "large" ? .22 : .13);
        svg.appendChild(svgElement("line", {
          x1: left, y1: y, x2: left + boardWidth, y2: y,
          stroke: colors.string,
          "stroke-width": thickness,
          "stroke-linecap": "round"
        }));
      });

      for (let i = 0; i < fretCount; i += 1) {
        const fretNumber = startFret + i;
        const x = left + fretWidth * (i + .5);
        const markerY = top + boardHeight / 2;
        const radius = size === "large" ? 5 : 3.4;

        if ([3, 5, 7, 9].includes(fretNumber)) {
          svg.appendChild(svgElement("circle", { cx: x, cy: markerY, r: radius, fill: colors.marker }));
        }
        if (fretNumber === 12) {
          svg.appendChild(svgElement("circle", { cx: x, cy: markerY - boardHeight * .18, r: radius, fill: colors.marker }));
          svg.appendChild(svgElement("circle", { cx: x, cy: markerY + boardHeight * .18, r: radius, fill: colors.marker }));
        }
      }

      voicing.strings.forEach((stringNumber, index) => {
        const fret = voicing.frets[index];
        if (fret === null || fret === undefined || fret === "x") return;

        const y = noteY(stringNumber, top, boardHeight);
        let x;

        if (Number(fret) === 0) {
          x = left - (size === "large" ? 22 : 14);
        } else {
          x = left + fretWidth * (Number(fret) - startFret + .5);
        }

        if (x < left - 30 || x > left + boardWidth + 2) return;

        const degree = voicing.degrees[index] ?? "";
        const isRoot = degree === "R";
        const radius = size === "large" ? 15 : 10.5;

        svg.appendChild(svgElement("circle", {
          cx: x, cy: y, r: radius,
          fill: isRoot ? colors.root : colors.note
        }));

        if (showDegrees && degree) {
          svg.appendChild(svgElement("text", {
            x, y: y + .5,
            fill: "#fff",
            "font-size": size === "large" ? 12 : 8.2,
            "font-weight": 800,
            "text-anchor": "middle",
            "dominant-baseline": "middle"
          }, degree));
        }
      });
    } else {
      const fretHeight = boardHeight / fretCount;
      const stringWidth = boardWidth / 5;

      for (let i = 0; i <= fretCount; i += 1) {
        const y = top + fretHeight * i;
        const isNut = startFret === 1 && i === 0;
        svg.appendChild(svgElement("line", {
          x1: left, y1: y, x2: left + boardWidth, y2: y,
          stroke: colors.fret,
          "stroke-width": isNut ? (size === "large" ? 6 : 4) : (size === "large" ? 2 : 1.3),
          "stroke-linecap": "round"
        }));
      }

      STRING_NUMBERS.forEach((stringNumber, index) => {
        const x = left + stringWidth * index;
        const thickness = (size === "large" ? 1.3 : .8) + (6 - index) * (size === "large" ? .22 : .13);
        svg.appendChild(svgElement("line", {
          x1: x, y1: top, x2: x, y2: top + boardHeight,
          stroke: colors.string,
          "stroke-width": thickness,
          "stroke-linecap": "round"
        }));
      });

      for (let i = 0; i < fretCount; i += 1) {
        const fretNumber = startFret + i;
        const y = top + fretHeight * (i + .5);
        const markerX = left + boardWidth / 2;
        const radius = size === "large" ? 5 : 3.4;

        if ([3, 5, 7, 9].includes(fretNumber)) {
          svg.appendChild(svgElement("circle", { cx: markerX, cy: y, r: radius, fill: colors.marker }));
        }
        if (fretNumber === 12) {
          svg.appendChild(svgElement("circle", { cx: markerX - boardWidth * .18, cy: y, r: radius, fill: colors.marker }));
          svg.appendChild(svgElement("circle", { cx: markerX + boardWidth * .18, cy: y, r: radius, fill: colors.marker }));
        }
      }

      voicing.strings.forEach((stringNumber, index) => {
        const fret = voicing.frets[index];
        if (fret === null || fret === undefined || fret === "x") return;

        const stringIndex = STRING_NUMBERS.indexOf(stringNumber);
        const x = left + stringWidth * stringIndex;
        let y;

        if (Number(fret) === 0) {
          y = top - (size === "large" ? 22 : 14);
        } else {
          y = top + fretHeight * (Number(fret) - startFret + .5);
        }

        if (y < top - 30 || y > top + boardHeight + 2) return;

        const degree = voicing.degrees[index] ?? "";
        const isRoot = degree === "R";
        const radius = size === "large" ? 15 : 10.5;

        svg.appendChild(svgElement("circle", {
          cx: x, cy: y, r: radius,
          fill: isRoot ? colors.root : colors.note
        }));

        if (showDegrees && degree) {
          svg.appendChild(svgElement("text", {
            x, y: y + .5,
            fill: "#fff",
            "font-size": size === "large" ? 12 : 8.2,
            "font-weight": 800,
            "text-anchor": "middle",
            "dominant-baseline": "middle"
          }, degree));
        }
      });
    }

    host.replaceChildren(svg);
    return svg;
  }

  window.GuitarFretboard = {
    render: renderFretboard,
    chooseWindow,
    parseStringSet
  };
})();
