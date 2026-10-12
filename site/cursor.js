// Pixel-art cursors (Owner, 2026-10-01): an old arrow, a pointing hand, a text I-beam and an hourglass,
// drawn pixel by pixel in the palette's phosphor with a dark outline, at the size of a 1990s cursor.
// They are set as CSS custom properties on <html>, which the style sheet uses everywhere, so the
// system cursor never shows. Redrawn when the palette changes.

// o: outline, #: phosphor, +: dim phosphor, .: clear.
const ARROW = [
  "o...........",
  "oo..........",
  "o#o.........",
  "o##o........",
  "o###o.......",
  "o####o......",
  "o#####o.....",
  "o######o....",
  "o#######o...",
  "o########o..",
  "o#########o.",
  "o######ooooo",
  "o###o##o....",
  "o##oo##o....",
  "o#o..o##o...",
  "oo...o##o...",
  "o.....o##o..",
  "......o##o..",
  ".......oo...",
];

const HAND = [
  ".....oo.........",
  "....o##o........",
  "....o##o........",
  "....o##o........",
  "....o##ooo......",
  "....o##o##ooo...",
  "....o##o##o##oo.",
  ".oo.o##o##o##o#o",
  "o##oo#########o#",
  "o###o##########o",
  ".o#############o",
  ".o#############o",
  "..o###########o.",
  "..o###########o.",
  "...o#########o..",
  "...o#########o..",
  "....ooooooooo...",
];

const IBEAM = [
  "ooo.ooo",
  "o##o##o",
  "ooo#ooo",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "..o#o..",
  "ooo#ooo",
  "o##o##o",
  "ooo.ooo",
];

const HOURGLASS = [
  "oooooooooooo",
  "o##########o",
  "oooooooooooo",
  ".o++++++++o.",
  ".o########o.",
  "..o######o..",
  "...o####o...",
  "....o##o....",
  "....o++o....",
  "...o++++o...",
  "..o++##++o..",
  ".o+######+o.",
  ".o########o.",
  "oooooooooooo",
  "o##########o",
  "oooooooooooo",
];

const SCALE = 2;

function svg(grid          , fill        , dim        , outline        )         {
  const w = Math.max(...grid.map((r) => r.length));
  let rects = "";
  grid.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const color = c === "o" ? outline : c === "#" ? fill : c === "+" ? dim : null;
      if (color) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
    });
  });
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * SCALE}" height="${grid.length * SCALE}" viewBox="0 0 ${w} ${grid.length}" shape-rendering="crispEdges">${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(doc)}")`;
}

/** Draws the four cursors in the given phosphor colour ("r, g, b") and installs them. */
export function applyCursors(rgb        )       {
  const [r, g, b] = rgb.split(",").map((v) => Number(v.trim()));
  const fill = `rgb(${r},${g},${b})`;
  const dim = `rgb(${Math.round(r * 0.45)},${Math.round(g * 0.45)},${Math.round(b * 0.45)})`;
  const outline = "#010a01";
  const root = document.documentElement.style;
  root.setProperty("--cur-arrow", `${svg(ARROW, fill, dim, outline)} 0 0, default`);
  root.setProperty("--cur-hand", `${svg(HAND, fill, dim, outline)} ${5 * SCALE} 0, pointer`);
  root.setProperty("--cur-text", `${svg(IBEAM, fill, dim, outline)} ${3 * SCALE} ${8 * SCALE}, text`);
  root.setProperty("--cur-wait", `${svg(HOURGLASS, fill, dim, outline)} ${6 * SCALE} ${8 * SCALE}, wait`);
}
