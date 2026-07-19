(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  // Conventional diagram order: high E (1) at the top, low E (6) at the bottom.
  const STRING_NUMBERS = [1, 2, 3, 4, 5, 6];

  function svgElement(name, attrs = {}, text = "") {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (text !== "") element.textContent = text;
    return element;
  }

  function parseStringSet(stringSet) {
    const parts = String(stringSet).replace("–", "-").split("-").map(Number);
    if (parts.length !== 2 || parts.some((value) => !Number.isInteger(value))) {
      throw new Error(`Invalid string set: ${stringSet}`);
    }

    const highString = Math.min(...parts);
    const lowString = Math.max(...parts);
    const strings = [];
    for (let stringNumber = lowString; stringNumber >= highString; stringNumber -= 1) {
      strings.push(stringNumber);
    }
    return strings;
  }

  function normalizeVoicing(voicing) {
    const strings = Array.isArray(voicing.strings)
      ? voicing.strings.map(Number)
      : parseStringSet(voicing.stringSet);
    const frets = Array.isArray(voicing.frets) ? voicing.frets : [];
    const degrees = Array.isArray(voicing.degrees) ? voicing.degrees : [];

    if (strings.length !== frets.length) {
      throw new Error("strings and frets must contain the same number of entries.");
    }

    return { ...voicing, strings, frets, degrees };
  }

  function chooseWindow(frets, fretCount = 5) {
    const pressed = frets
      .map(Number)
      .filter((fret) => Number.isFinite(fret) && fret > 0);

    if (!pressed.length) return { startFret: 1, fretCount };

    const minFret = Math.min(...pressed);
    const maxFret = Math.max(...pressed);

    if (maxFret <= fretCount) return { startFret: 1, fretCount };

    let startFret = minFret;
    if (maxFret - startFret + 1 > fretCount) {
      startFret = maxFret - fretCount + 1;
    }

    return { startFret, fretCount };
  }

  function stringPosition(stringNumber, start, length) {
    const index = STRING_NUMBERS.indexOf(Number(stringNumber));
    if (index < 0) throw new Error(`Invalid string number: ${stringNumber}`);
    return start + (length / 5) * index;
  }

  function getColors() {
    const style = getComputedStyle(document.documentElement);
    const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;

    return {
      board: read("--board", "#fafafa"),
      string: read("--string", "#71717a"),
      fret: read("--fret", "#a1a1aa"),
      marker: read("--marker", "#d4d4d8"),
      note: read("--note", "#1d1d1f"),
      root: read("--root-note", "#007aff"),
      secondary: read("--secondary", "#6e6e73")
    };
  }

  function renderHorizontal(svg, voicing, layout, colors, options) {
    const { left, top, boardWidth, boardHeight, fretCount, startFret, size, showDegrees } = layout;
    const fretWidth = boardWidth / fretCount;

    for (let index = 0; index <= fretCount; index += 1) {
      const x = left + fretWidth * index;
      const isNut = startFret === 1 && index === 0;
      svg.appendChild(svgElement("line", {
        x1: x,
        y1: top,
        x2: x,
        y2: top + boardHeight,
        stroke: colors.fret,
        "stroke-width": isNut ? (size === "large" ? 5 : 3.5) : (size === "large" ? 1.7 : 1.1),
        "stroke-linecap": "round"
      }));
    }

    STRING_NUMBERS.forEach((stringNumber) => {
      const y = stringPosition(stringNumber, top, boardHeight);
      const thickness = (size === "large" ? 1.1 : 0.7) + stringNumber * (size === "large" ? 0.18 : 0.1);
      svg.appendChild(svgElement("line", {
        x1: left,
        y1: y,
        x2: left + boardWidth,
        y2: y,
        stroke: colors.string,
        "stroke-width": thickness,
        "stroke-linecap": "round"
      }));
    });

    for (let index = 0; index < fretCount; index += 1) {
      const fretNumber = startFret + index;
      const x = left + fretWidth * (index + 0.5);
      const markerY = top + boardHeight / 2;
      const radius = size === "large" ? 4.5 : 3;

      if ([3, 5, 7, 9, 15, 17, 19, 21].includes(fretNumber)) {
        svg.appendChild(svgElement("circle", { cx: x, cy: markerY, r: radius, fill: colors.marker }));
      }

      if ([12, 24].includes(fretNumber)) {
        svg.appendChild(svgElement("circle", {
          cx: x, cy: markerY - boardHeight * 0.18, r: radius, fill: colors.marker
        }));
        svg.appendChild(svgElement("circle", {
          cx: x, cy: markerY + boardHeight * 0.18, r: radius, fill: colors.marker
        }));
      }
    }

    voicing.strings.forEach((stringNumber, index) => {
      const fret = voicing.frets[index];
      if (fret === null || fret === undefined || String(fret).toLowerCase() === "x") return;

      const fretNumber = Number(fret);
      const y = stringPosition(stringNumber, top, boardHeight);
      const x = fretNumber === 0
        ? left - (size === "large" ? 20 : 12)
        : left + fretWidth * (fretNumber - startFret + 0.5);

      if (x < left - 28 || x > left + boardWidth + 2) return;

      const degree = String(voicing.degrees[index] ?? "");
      const radius = size === "large" ? 14 : 9.5;
      const fill = degree === "R" ? colors.root : colors.note;

      svg.appendChild(svgElement("circle", { cx: x, cy: y, r: radius, fill }));

      if (showDegrees && degree) {
        svg.appendChild(svgElement("text", {
          x,
          y: y + 0.5,
          fill: "#ffffff",
          "font-size": size === "large" ? 11 : 7.5,
          "font-weight": 800,
          "text-anchor": "middle",
          "dominant-baseline": "middle"
        }, degree));
      }
    });
  }

  function renderVertical(svg, voicing, layout, colors) {
    const { left, top, boardWidth, boardHeight, fretCount, startFret, size, showDegrees } = layout;
    const fretHeight = boardHeight / fretCount;

    for (let index = 0; index <= fretCount; index += 1) {
      const y = top + fretHeight * index;
      const isNut = startFret === 1 && index === 0;
      svg.appendChild(svgElement("line", {
        x1: left,
        y1: y,
        x2: left + boardWidth,
        y2: y,
        stroke: colors.fret,
        "stroke-width": isNut ? (size === "large" ? 5 : 3.5) : (size === "large" ? 1.7 : 1.1),
        "stroke-linecap": "round"
      }));
    }

    STRING_NUMBERS.forEach((stringNumber) => {
      const x = stringPosition(stringNumber, left, boardWidth);
      const thickness = (size === "large" ? 1.1 : 0.7) + stringNumber * (size === "large" ? 0.18 : 0.1);
      svg.appendChild(svgElement("line", {
        x1: x,
        y1: top,
        x2: x,
        y2: top + boardHeight,
        stroke: colors.string,
        "stroke-width": thickness,
        "stroke-linecap": "round"
      }));
    });

    for (let index = 0; index < fretCount; index += 1) {
      const fretNumber = startFret + index;
      const y = top + fretHeight * (index + 0.5);
      const markerX = left + boardWidth / 2;
      const radius = size === "large" ? 4.5 : 3;

      if ([3, 5, 7, 9, 15, 17, 19, 21].includes(fretNumber)) {
        svg.appendChild(svgElement("circle", { cx: markerX, cy: y, r: radius, fill: colors.marker }));
      }

      if ([12, 24].includes(fretNumber)) {
        svg.appendChild(svgElement("circle", {
          cx: markerX - boardWidth * 0.18, cy: y, r: radius, fill: colors.marker
        }));
        svg.appendChild(svgElement("circle", {
          cx: markerX + boardWidth * 0.18, cy: y, r: radius, fill: colors.marker
        }));
      }
    }

    voicing.strings.forEach((stringNumber, index) => {
      const fret = voicing.frets[index];
      if (fret === null || fret === undefined || String(fret).toLowerCase() === "x") return;

      const fretNumber = Number(fret);
      const x = stringPosition(stringNumber, left, boardWidth);
      const y = fretNumber === 0
        ? top - (size === "large" ? 20 : 12)
        : top + fretHeight * (fretNumber - startFret + 0.5);

      if (y < top - 28 || y > top + boardHeight + 2) return;

      const degree = String(voicing.degrees[index] ?? "");
      const radius = size === "large" ? 14 : 9.5;
      const fill = degree === "R" ? colors.root : colors.note;

      svg.appendChild(svgElement("circle", { cx: x, cy: y, r: radius, fill }));

      if (showDegrees && degree) {
        svg.appendChild(svgElement("text", {
          x,
          y: y + 0.5,
          fill: "#ffffff",
          "font-size": size === "large" ? 11 : 7.5,
          "font-weight": 800,
          "text-anchor": "middle",
          "dominant-baseline": "middle"
        }, degree));
      }
    });
  }

  function renderFretboard(target, rawVoicing, options = {}) {
    const host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) throw new Error("Fretboard target was not found.");

    const voicing = normalizeVoicing(rawVoicing);
    const size = options.size === "large" ? "large" : "small";
    const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
    const showDegrees = options.showDegrees !== false;
    const fretCount = Number(options.fretCount) || 5;
    const { startFret } = chooseWindow(voicing.frets, fretCount);

    const dimensions = orientation === "vertical"
      ? (size === "large"
        ? { width: 300, height: 470, left: 42, right: 24, top: 34, bottom: 28 }
        : { width: 180, height: 250, left: 28, right: 18, top: 24, bottom: 18 })
      : (size === "large"
        ? { width: 520, height: 250, left: 46, right: 18, top: 35, bottom: 28 }
        : { width: 260, height: 132, left: 28, right: 12, top: 24, bottom: 18 });

    const { width, height, left, right, top, bottom } = dimensions;
    const boardWidth = width - left - right;
    const boardHeight = height - top - bottom;
    const colors = getColors();

    const svg = svgElement("svg", {
      class: "fretboard-svg",
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": `${voicing.quality ?? "Chord"} ${voicing.inversion ?? ""} voicing`
    });

    svg.appendChild(svgElement("rect", {
      x: left,
      y: top,
      width: boardWidth,
      height: boardHeight,
      rx: size === "large" ? 12 : 8,
      fill: colors.board
    }));

    if (startFret > 1) {
      svg.appendChild(svgElement("text", {
        x: orientation === "horizontal" ? left - 6 : left,
        y: orientation === "horizontal" ? top + 5 : top - 8,
        fill: colors.secondary,
        "font-size": size === "large" ? 14 : 10,
        "font-weight": 700,
        "text-anchor": orientation === "horizontal" ? "end" : "start",
        "dominant-baseline": "middle"
      }, `${startFret}fr`));
    }

    const layout = {
      left, top, boardWidth, boardHeight, fretCount, startFret, size, showDegrees
    };

    if (orientation === "vertical") {
      renderVertical(svg, voicing, layout, colors);
    } else {
      renderHorizontal(svg, voicing, layout, colors, options);
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
