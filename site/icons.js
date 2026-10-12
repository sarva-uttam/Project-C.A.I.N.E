// Pixel-art icons (Owner, 2026-10-01), drawn from character grids into crisp SVG elements (built
// node by node, never from markup) in the phosphor's own green: the icon view of `dir` (a vintage PC's folders and files) and the glyphs on the pixel
// buttons (play, pause, skip, arrows). Each character is one pixel; colour comes from CSS
// (currentColor), so every palette works.
//   # outline   o fill   h highlight   d dark   . or space: nothing

/** Fill opacity of each shade; every pixel is the current text colour. */
const SHADE                         = { "#": "1", o: "0.38", h: "0.7", d: "0.16" };
const SVG = "http://www.w3.org/2000/svg";

/** Builds an SVG element from a pixel grid. Runs of one shade in a row become one rect. */
export function pixelSvg(rows          , className = "pixel-icon")                {
  const w = Math.max(...rows.map((r) => r.length));
  const svg = document.createElementNS(SVG, "svg");
  for (const [k, v] of [["class", className], ["viewBox", `0 0 ${w} ${rows.length}`], ["shape-rendering", "crispEdges"], ["aria-hidden", "true"], ["focusable", "false"]]) svg.setAttribute(k, v);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === c) end++;
      if (SHADE[c]) {
        const rect = document.createElementNS(SVG, "rect");
        for (const [k, v] of [["x", x], ["y", y], ["width", end - x], ["height", 1], ["fill", "currentColor"], ["fill-opacity", SHADE[c]]]) rect.setAttribute(String(k), String(v));
        svg.appendChild(rect);
      }
      x = end;
    }
  });
  return svg;
}

// ---------------------------------------------------------------- the icon view (20 x 16)

const FOLDER = [
  "                    ",
  " #######            ",
  "#ooooooo#           ",
  "#oooooooo##########.",
  "#ooooooooooooooooo#.",
  "#ooooooooooooooooo#.",
  "#o#################.",
  "#o#hhhhhhhhhhhhhhhh#",
  "#o#hhhhhhhhhhhhhhhh#",
  "#o#hhhhhhhhhhhhhhh#.",
  "##hhhhhhhhhhhhhhhh#.",
  "##hhhhhhhhhhhhhhhh#.",
  "#hhhhhhhhhhhhhhhh#..",
  "#hhhhhhhhhhhhhhhh#..",
  "##################..",
  "                    ",
];

const FILE = [
  "   ##########       ",
  "   #dddddddd##      ",
  "   #dddddddd#h#     ",
  "   #dddddddd####    ",
  "   #ddddddddddd#    ",
  "   #d##h#hhh#dd#    ",
  "   #ddddddddddd#    ",
  "   #d#hhh##h#dd#    ",
  "   #ddddddddddd#    ",
  "   #d##h#hhhh#d#    ",
  "   #ddddddddddd#    ",
  "   #d#hh###hdd##    ",
  "   #ddddddddddd#    ",
  "   #d##hh#ddddd#    ",
  "   #ddddddddddd#    ",
  "   #############    ",
];

const SONG = [
  "   ##########       ",
  "   #dddddddd##      ",
  "   #dddddddd#h#     ",
  "   #dddddddd####    ",
  "   #ddd#####ddd#    ",
  "   #ddd#ddd#ddd#    ",
  "   #ddd#ddd#ddd#    ",
  "   #ddd#ddd#ddd#    ",
  "   #d###d###ddd#    ",
  "   #########ddd#    ",
  "   ####d####ddd#    ",
  "   #ddddddddddd#    ",
  "   #dddd#ddddd##    ",
  "   #dddd###dd#h#    ",
  "   #dddd#ddddd##    ",
  "   #############    ",
];

const PICTURE = [
  "####################",
  "#dddddddddddddddddd#",
  "#ddddddddddddd##ddd#",
  "#dddddddddddd####dd#",
  "#ddddddddddddd##ddd#",
  "#dddddddddddddddddd#",
  "#ddddd#dddddddddddd#",
  "#dddd###ddddddddddd#",
  "#ddd#####ddd#dddddd#",
  "#dd#######d###ddddd#",
  "#d##################",
  "#hhhhhhhhhhhhhhhhhh#",
  "#hhhhhhhhhhhhhhhhhh#",
  "####################",
  "                    ",
  "                    ",
];

const PROGRAM = [
  "####################",
  "#hhhhhhhhhhhh#h#h#h#",
  "####################",
  "#dddddddddddddddddd#",
  "#d#d#dddddddddddddd#",
  "#dd#ddddddddddddddd#",
  "#d#d##hhhhddddddddd#",
  "#dddddddddddddddddd#",
  "#dddddddddddddddddd#",
  "#dddddddddddddddddd#",
  "#dddddddddddddddddd#",
  "#dddddddddddddddddd#",
  "####################",
  "                    ",
  "                    ",
  "                    ",
];

                                                                          
const ICONS                             = { folder: FOLDER, file: FILE, song: SONG, picture: PICTURE, program: PROGRAM };

export function fileIcon(kind          )                {
  return pixelSvg(ICONS[kind], `pixel-icon icon-${kind}`);
}

// ---------------------------------------------------------------- button glyphs (9 x 9)

const GLYPHS = {
  play: [
    "  #      ",
    "  ##     ",
    "  ###    ",
    "  ####   ",
    "  #####  ",
    "  ####   ",
    "  ###    ",
    "  ##     ",
    "  #      ",
  ],
  pause: [
    " ##   ## ",
    " ##   ## ",
    " ##   ## ",
    " ##   ## ",
    " ##   ## ",
    " ##   ## ",
    " ##   ## ",
    " ##   ## ",
    " ##   ## ",
  ],
  skip: [
    "#   #  ##",
    "##  ##  #",
    "### ### #",
    "#########",
    "#########",
    "#########",
    "### ### #",
    "##  ##  #",
    "#   #  ##",
  ],
  left: [
    "         ",
    "   #     ",
    "  ##     ",
    " ####### ",
    "######## ",
    " ####### ",
    "  ##     ",
    "   #     ",
    "         ",
  ],
  right: [
    "         ",
    "     #   ",
    "     ##  ",
    " ####### ",
    " ########",
    " ####### ",
    "     ##  ",
    "     #   ",
    "         ",
  ],
  lock: [
    "  #####  ",
    " ##   ## ",
    " #     # ",
    "#########",
    "####o####",
    "###ooo###",
    "####o####",
    "####o####",
    "#########",
  ],
}         ;

/** ⏭ is the skip sign; ⏮ is it mirrored. */
const EXTRA = {
  next: GLYPHS.skip,
  prev: GLYPHS.skip.map((row) => [...row].reverse().join("")),
};

                                                             

export function glyph(name       )                {
  const rows = name in EXTRA ? EXTRA[name                      ] : GLYPHS[name                       ];
  return pixelSvg([...rows], `pixel-glyph glyph-${name}`);
}
