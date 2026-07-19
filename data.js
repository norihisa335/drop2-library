/* Demo data for the fretboard component.
   Replace or expand this file with your Standard / Practical libraries. */
window.GVL_DATA = {
  roots: ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"],
  qualities: ["Maj7", "7", "m7", "m7b5"],
  inversions: ["Root", "1st", "2nd", "3rd"],
  stringSets: ["2-5", "1-4"],
  libraries: ["Standard", "Practical"],

  forms: [
    {
      id: "M7-25-R-01",
      library: "Standard",
      category: "Drop2",
      quality: "Maj7",
      inversion: "Root",
      stringSet: "2-5",
      frets: [3, 5, 4, 5],
      degrees: ["R", "5", "7", "3"],
      useCase: "Balanced root-position Drop 2 form."
    },
    {
      id: "M7-25-1-01",
      library: "Standard",
      category: "Drop2",
      quality: "Maj7",
      inversion: "1st",
      stringSet: "2-5",
      frets: [7, 7, 9, 8],
      degrees: ["3", "7", "R", "5"],
      useCase: "Smooth connection from nearby root-position forms."
    },
    {
      id: "M7-25-2-01",
      library: "Standard",
      category: "Drop2",
      quality: "Maj7",
      inversion: "2nd",
      stringSet: "2-5",
      frets: [10, 9, 9, 8],
      degrees: ["5", "R", "3", "7"],
      useCase: "Compact upper-position form."
    },
    {
      id: "M7-25-3-01",
      library: "Standard",
      category: "Drop2",
      quality: "Maj7",
      inversion: "3rd",
      stringSet: "2-5",
      frets: [2, 2, 1, 1],
      degrees: ["7", "3", "5", "R"],
      useCase: "Low-position leading-tone voicing."
    },

    {
      id: "7-25-R-01",
      library: "Standard",
      category: "Drop2",
      quality: "7",
      inversion: "Root",
      stringSet: "2-5",
      frets: [3, 5, 3, 5],
      degrees: ["R", "5", "b7", "3"],
      useCase: "Core dominant Drop 2 sound."
    },
    {
      id: "7-25-1-01",
      library: "Standard",
      category: "Drop2",
      quality: "7",
      inversion: "1st",
      stringSet: "2-5",
      frets: [7, 6, 8, 8],
      degrees: ["3", "b7", "R", "5"],
      useCase: "Useful for chromatic dominant movement."
    },
    {
      id: "7-25-2-01",
      library: "Standard",
      category: "Drop2",
      quality: "7",
      inversion: "2nd",
      stringSet: "2-5",
      frets: [10, 9, 8, 8],
      degrees: ["5", "R", "3", "b7"],
      useCase: "Clear top-note dominant voicing."
    },
    {
      id: "7-25-3-01",
      library: "Standard",
      category: "Drop2",
      quality: "7",
      inversion: "3rd",
      stringSet: "2-5",
      frets: [1, 2, 1, 1],
      degrees: ["b7", "3", "5", "R"],
      useCase: "Compact low-position dominant form."
    },

    {
      id: "m7-25-R-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7",
      inversion: "Root",
      stringSet: "2-5",
      frets: [3, 5, 3, 4],
      degrees: ["R", "5", "b7", "b3"],
      useCase: "Fundamental minor-seventh Drop 2 form."
    },
    {
      id: "m7-25-1-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7",
      inversion: "1st",
      stringSet: "2-5",
      frets: [6, 6, 8, 8],
      degrees: ["b3", "b7", "R", "5"],
      useCase: "Warm first-inversion minor sound."
    },
    {
      id: "m7-25-2-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7",
      inversion: "2nd",
      stringSet: "2-5",
      frets: [10, 8, 8, 8],
      degrees: ["5", "R", "b3", "b7"],
      useCase: "Convenient upper-register minor form."
    },
    {
      id: "m7-25-3-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7",
      inversion: "3rd",
      stringSet: "2-5",
      frets: [1, 1, 1, 1],
      degrees: ["b7", "b3", "5", "R"],
      useCase: "Simple low-position minor-seventh shape."
    },

    {
      id: "m7b5-25-R-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7b5",
      inversion: "Root",
      stringSet: "2-5",
      frets: [3, 4, 3, 4],
      degrees: ["R", "b5", "b7", "b3"],
      useCase: "Essential half-diminished root position."
    },
    {
      id: "m7b5-25-1-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7b5",
      inversion: "1st",
      stringSet: "2-5",
      frets: [6, 6, 7, 8],
      degrees: ["b3", "b7", "R", "b5"],
      useCase: "Smooth minor ii–V voice leading."
    },
    {
      id: "m7b5-25-2-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7b5",
      inversion: "2nd",
      stringSet: "2-5",
      frets: [9, 8, 8, 8],
      degrees: ["b5", "R", "b3", "b7"],
      useCase: "Compact upper-register half-diminished form."
    },
    {
      id: "m7b5-25-3-01",
      library: "Standard",
      category: "Drop2",
      quality: "m7b5",
      inversion: "3rd",
      stringSet: "2-5",
      frets: [1, 1, 0, 1],
      degrees: ["b7", "b3", "b5", "R"],
      useCase: "Open-string example for component testing."
    }
  ]
};
