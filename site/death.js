// The fake terminal's death (Owner, 2026-10-01, rebuilt): the symbols that pop up in the virus bomb,
// drawn from the Owner's references in the game's palette only (green, white, black), built node by
// node. They are not full screens: each is one element, any size, that flickers in, grows or shrinks,
// and goes. The words are the game's own.

import { pixelSvg } from "./icons.js";

const SVG = "http://www.w3.org/2000/svg";

function el                                       (tag   , cls        , text         )                           {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function svg(viewBox        , cls        , shapes                                                  )                {
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("class", cls);
  s.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of shapes) {
    const shape = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, String(v));
    s.appendChild(shape);
  }
  return s;
}

// ---------------------------------------------------------------- pixel art (# full, h bright, o dim)

const CRAB = [
  "  #        #  ",
  "   #      #   ",
  "#  ########  #",
  " ## #hhhh# ## ",
  "   ##hhhh##   ",
  "#####hhhh#####",
  "   ########   ",
  "  # #    # #  ",
  " #  #    #  # ",
  "#  #      #  #",
];

const SKULL = [
  "   ########   ",
  "  ##########  ",
  " ############ ",
  " ##  ####  ## ",
  " ##  ####  ## ",
  " ############ ",
  "  #####  ###  ",
  "   ########   ",
  "   # # # #    ",
  "#            #",
  " ##        ## ",
  "   ###  ###   ",
  "     ####     ",
  "   ###  ###   ",
  " ##        ## ",
  "#            #",
];

const GAS_MASK = [
  "   ########   ",
  "  ##########  ",
  " ###oo##oo### ",
  " ##oooo#oooo# ",
  " ###oo##oo### ",
  "  ##########  ",
  "   ###oo###   ",
  "  ##o####o##  ",
  " ##  #oo#  ## ",
  "##   ####   ##",
  "#     ##     #",
];

/** Two frames of a small pixel figure, arms down and arms up: it dances. */
const FIGURE_A = [
  "   ###   ",
  "   ###   ",
  "    #    ",
  "  #####  ",
  " # ### # ",
  "#  ###  #",
  "   # #   ",
  "  #   #  ",
  " #     # ",
];
const FIGURE_B = [
  "#  ###  #",
  " # ### # ",
  "  # # #  ",
  "  #####  ",
  "   ###   ",
  "   ###   ",
  "   # #   ",
  "  #   #  ",
  "  #   #  ",
];

const BOMB = [
  "        h#  ",
  "       #  # ",
  "      #     ",
  "   ######   ",
  "  ########  ",
  " ##h####### ",
  " #h######## ",
  " ########## ",
  " ########## ",
  "  ########  ",
  "   ######   ",
];

// ---------------------------------------------------------------- the symbols

                                                                                                                             

function triangle()              {
  const box = el("div", "sym sym-triangle");
  box.append(svg("0 0 200 180", "sym-art", [
    ["path", { d: "M100 12 L188 166 L12 166 Z", fill: "none", stroke: "currentColor", "stroke-width": 10, "stroke-linejoin": "round" }],
    ["rect", { x: 91, y: 60, width: 18, height: 60, rx: 4, fill: "currentColor" }],
    ["circle", { cx: 100, cy: 141, r: 10, fill: "currentColor" }],
  ]));
  return box;
}

function malware()              {
  const box = el("div", "sym sym-malware");
  box.append(pixelSvg(CRAB, "sym-art sym-crab"), el("div", "sym-word", "MALWARE!"));
  return box;
}

function danger()              {
  const box = el("div", "sym sym-danger");
  const trefoil = svg("0 0 100 100", "sym-art", [
    ["circle", { cx: 50, cy: 50, r: 44, fill: "none", stroke: "currentColor", "stroke-width": 5 }],
    ...[0, 120, 240].map((deg)                                            => ["path", { d: "M50 50 L30 15.36 A40 40 0 0 1 70 15.36 Z", fill: "currentColor", transform: `rotate(${deg} 50 50)` }]),
    ["circle", { cx: 50, cy: 50, r: 9, fill: "#000" }],
    ["circle", { cx: 50, cy: 50, r: 6, fill: "currentColor" }],
  ]);
  box.append(el("div", "sym-stripes"), el("div", "sym-word", "DANGER!"), trefoil, el("div", "sym-stripes"));
  return box;
}

function bolt()              {
  const box = el("div", "sym sym-bolt");
  box.append(svg("0 0 200 180", "sym-art", [
    ["path", { d: "M100 12 L188 166 L12 166 Z", fill: "none", stroke: "currentColor", "stroke-width": 10, "stroke-linejoin": "round" }],
    ["path", { d: "M108 58 L82 112 L100 112 L90 146 L122 96 L104 96 L116 58 Z", fill: "currentColor" }],
  ]));
  return box;
}

function eye()              {
  const box = el("div", "sym sym-eye");
  box.append(svg("0 0 120 70", "sym-art", [
    ["path", { d: "M8 35 Q60 -12 112 35 Q60 82 8 35 Z", fill: "none", stroke: "currentColor", "stroke-width": 5 }],
    ["circle", { cx: 60, cy: 35, r: 14, fill: "currentColor" }],
    ["line", { x1: 22, y1: 66, x2: 98, y2: 4, stroke: "currentColor", "stroke-width": 6, "stroke-linecap": "round" }],
  ]));
  return box;
}

function figure()              {
  const box = el("div", "sym sym-figure");
  box.append(pixelSvg(FIGURE_A, "sym-art frame-a"), pixelSvg(FIGURE_B, "sym-art frame-b"));
  return box;
}

function crash()              {
  const box = el("div", "sym sym-crash");
  const percent = el("div", "sym-crash-percent", "0% complete");
  box.append(
    el("div", "sym-crash-face", ":("),
    el("div", "sym-crash-text", "Your connection ran into a problem and has to end. We're collecting what is left of it."),
    percent,
    el("div", "sym-crash-code"),
  );
  return box;
}

export function symbol(kind            )              {
  switch (kind) {
    case "triangle": return triangle();
    case "malware": return malware();
    case "danger": return danger();
    case "skull": { const b = el("div", "sym sym-skull"); b.append(pixelSvg(SKULL, "sym-art")); return b; }
    case "mask": { const b = el("div", "sym sym-mask"); b.append(pixelSvg(GAS_MASK, "sym-art")); return b; }
    case "bolt": return bolt();
    case "eye": return eye();
    case "figure": return figure();
    case "bomb": { const b = el("div", "sym sym-bomb"); b.append(pixelSvg(BOMB, "sym-art"), el("div", "sym-burst")); return b; }
    case "crash": return crash();
  }
}

/** The reference symbols, in the order they first appear; after that, any of them. */
export const SYMBOLS               = ["triangle", "malware", "danger", "skull", "eye", "crash", "mask", "bolt", "figure", "bomb"];
