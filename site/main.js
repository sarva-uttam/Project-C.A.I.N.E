// Browser screen for Level 1: one green phosphor monitor. Engine logic lives in ../src; this file
// draws, plays sound, and forwards typed lines. Phases: the boot (once per page load), the locked
// opening (John's conversation fills the screen; tap through, then a YES/NO choice), and the
// command center (commands on the left, John floating on the right with a chat input for
// questions). Both inputs edit like a DOS prompt; the command center keeps a command history.
// A file opens as a manual page. Text is set with textContent only.
// The page opens on the menu (menu.ts); the game starts only from NEW GAME, CONTINUE or a level's
// launch. Progress is saved at attempt starts, file reads, attempt ends and level clears (save.ts).

import { Session } from "./session.js";
import { assembleLevel1FromData } from "./level1.js";
                                                                 
import { DOT_MS, JOHN_NORMAL_MS, JOHN_SLOW_MS, present, promptFor, resetIntro } from "./presenter.js";
                                                                
                                                             
import { LEVELS, canLaunch, levelStatus } from "./levels.js";
import { RESUME_SCHEMA, SaveStore, browserStorage, memoryForResume, progressOf, withAttempt, withClear, withMemory } from "./save.js";
                                                            
import { SCREEN_DATE, SCREEN_TIME, SONG_TEXT, TRAP_MESSAGE, TRAP_TAUNTS, VIRUS_TAUNTS } from "./ui-text.js";
import { Sounds } from "./audio.js";
import { Menu } from "./menu.js";
import { Prefs } from "./prefs.js";
import { applyCursors } from "./cursor.js";
import { fileIcon, glyph } from "./icons.js";
import { SYMBOLS, symbol } from "./death.js";
                                             
                                                      

                
                                              
                                                                        
 

const $ = (id        ) => document.getElementById(id) ;
const crt = $("crt");
const screen = $("screen");
const log = $("log");
const promptEl = $("prompt");
const typedEl = $("typed");
const cursorEl = $("cursor");
const typedAfter = $("typed-after");
const line = $("line");
const chatLog = $("chat-log");
const chatPrompt = $("chat-prompt");
const chatTyped = $("chat-typed");
const chatCursor = $("chat-cursor");
const chatAfter = $("chat-after");
const bootEl = $("boot");
const keys = $("keys")                    ;
const surge = $("surge")                     ;
const flashEl = $("flash");
const pager = { l: $("pager-name-l"), r: $("pager-name-r"), title: $("pager-title"), body: $("pager-body"), foot: $("pager-foot") };
const sounds = new Sounds();
const { storage, writable } = browserStorage();
const store = new SaveStore(storage, () => new Date(), writable);
const prefs = new Prefs(store);
sounds.setEnabled(prefs.current.sound === "on");
sounds.setMusic(prefs.current.music === "on", prefs.current.ambientVolume);
sounds.setEffects(prefs.current.effectsVolume);
const drawCursors = () => applyCursors(getComputedStyle(document.documentElement).getPropertyValue("--glow-rgb") || "51, 255, 51");
drawCursors();
prefs.onChange((s) => {
  drawCursors();
  sounds.setEffects(s.effectsVolume);
  // Turning sound on in the menu is a key press or tap, so audio may start now (never otherwise).
  if (s.sound === "on" && navigator.userActivation?.isActive) sounds.start();
  sounds.setEnabled(s.sound === "on");
  sounds.setMusic(s.music === "on", s.ambientVolume);
});

// ?speed=N shortens every delay for automated checks only; players get the real timings.
const speed = Math.max(1, Number(new URLSearchParams(location.search).get("speed")) || 1);

// --- Game time (Owner, 2026-10-01: ESC pauses) ------------------------------------------------------
// Every wait, animation frame, glitch, typing delay and timer of the game runs on this clock, which
// stops while the game is paused. Nothing advances behind the pause menu.

let paused = false;
let pausedAt = 0;
let pausedTotal = 0;
let resumeWaiters                    = [];
/** Milliseconds of game time: page time less the time spent paused. */
const gameNow = () => (paused ? pausedAt : performance.now()) - pausedTotal;
const whenRunning = () => (paused ? new Promise      ((r) => resumeWaiters.push(r)) : Promise.resolve());
/** Waits `ms` of game time; a pause stops the wait. */
function sleep(ms        )                {
  const until = gameNow() + ms / speed;
  return new Promise      ((resolve) => {
    const check = () => {
      const left = until - gameNow();
      if (left <= 0 && !paused) resolve();
      else setTimeout(check, paused ? 100 : Math.min(left, 100));
    };
    check();
  });
}
const nextFrame = async () => {
  await whenRunning();
  await new Promise      ((r) => requestAnimationFrame(() => r()));
};
/** Runs `fn` after `ms` of game time unless cancelled first. Returns the cancel. */
function after(ms        , fn            )             {
  let live = true;
  void sleep(ms).then(() => {
    if (live) fn();
  });
  return () => {
    live = false;
  };
}

const level = assembleLevel1FromData(globalThis.LEVEL1_DATA.files);
const endings = globalThis.LEVEL1_DATA.endings;
const openingSteps                = level.dialogue.opening ?? [];

// --- The engine's journal (Owner, 2026-10-06: CONTINUE resumes where the player left off) ----------
// Every call the screen makes to the engine is noted, in order. Replayed into a new session with the
// same seed, they rebuild the same John, folder, choices, moment and flicker count.

const JOURNALED = ["startConnection", "restoreMemory", "endConnection", "input", "ask", "askPrepared", "notice", "timerMark", "setMoment"]         ;
let sessionSeed = `play-${Date.now()}`;
let journal                             = [];

function journaled(s         )          {
  const calls = s                                                              ;
  for (const name of JOURNALED) {
    const call = calls[name].bind(s);
    calls[name] = (...args           ) => {
      journal.push([name, structuredClone(args)]);
      return call(...args);
    };
  }
  let reactions = s.reactionsOn;
  Object.defineProperty(s, "reactionsOn", {
    get: () => reactions,
    set: (on         ) => {
      journal.push(["reactionsOn", [on]]);
      reactions = on;
    },
  });
  return s;
}

/** The engine as it stood at a resume point. Throws if the journal no longer fits the game. */
function replayed(point             )          {
  const s = new Session(level.dialogue, level.world, { seed: point.seed });
  const calls = s                                                              ;
  for (const [name, args] of point.journal) {
    if (name === "reactionsOn") s.reactionsOn = args[0] === true;
    else if ((JOURNALED                     ).includes(name)) calls[name](...args);
    else throw new Error(`unknown journal entry ${name}`);
  }
  return s;
}

let session = journaled(new Session(level.dialogue, level.world, { seed: sessionSeed }));

                                                                                      
let phase        = "waiting";
let busy = true;
let over = false;
let commandCenterOpen = false;

function setPhase(next       )       {
  phase = next;
  const b = document.body.classList;
  b.toggle("booting", next === "boot");
  b.toggle("opening", !commandCenterOpen && next !== "boot" && next !== "waiting");
  b.toggle("command", commandCenterOpen);
  b.toggle("choosing", next === "choice");
  b.toggle("file", next === "file");
  b.toggle("viewing", next === "image");
}

// --- The glass ---------------------------------------------------------------------------------------

function drawBarrelMap()       {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d") ;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const r2 = nx * nx + ny * ny;
      const i = (y * size + x) * 4;
      img.data[i] = 128 + nx * r2 * 60;
      img.data[i + 1] = 128 + ny * r2 * 60;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  $("barrel-map").setAttribute("href", c.toDataURL());
}

function startNoise()       {
  const canvas = $("noise")                     ;
  const g = canvas.getContext("2d") ;
  const img = g.createImageData(canvas.width, canvas.height);
  const tick = () => {
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v * 0.5;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 0.5;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };
  tick();
  // Reduce motion: the static holds still. So does a paused game.
  setInterval(() => {
    if (!prefs.reduceMotion && !paused && !document.body.classList.contains("frozen")) tick();
  }, 90);
}

// --- Flicker: a digital glitch in the phosphor's own green (Owner, 2026-09-30; redesigned 2026-10-01) --
// One vocabulary for every glitch: horizontal slice displacement, chromatic aberration, datamosh,
// pixel sorting, frame drops, bloom, scan-line distortion, one-frame blackouts and shake, all drawn
// in the palette's green. Every effect rises and falls smoothly with one envelope; nothing snaps on
// or off. Story glitches (a spoken name, the fake terminal, the timer) last 2–4 s by size. Between
// them, quieter ambient glitches follow how close Caine is to a terminal (see "Ambient" below).

                                                                                                                                                                      
/** Most telling first: a small glitch uses the head of this list, a large one nearly all of it. */
const EFFECTS           = ["slices", "aberration", "static", "shake", "rollingBar", "datamosh", "bloom", "colorBars", "scanlines", "pixelSort", "frameDrop", "blackout"];
const GLITCH                                                                               = {
  small: { ms: 2000, effects: [2, 3], peak: 0.45 },
  medium: { ms: 3000, effects: [4, 7], peak: 0.75 },
  large: { ms: 4000, effects: [8, 12], peak: 1 },
};

/** The palette's phosphor as [r, g, b] (default green 51, 255, 51). */
function phosphor()           {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--glow-rgb").split(",").map(Number);
  return v.length === 3 && v.every(Number.isFinite) ? v : [51, 255, 51];
}
/** A shade of the phosphor: toward white (k > 0) or black (k < 0), as an rgba() prefix. */
function shade(base          , k        )         {
  const [r, g, b] = base.map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)));
  return `rgba(${r},${g},${b},`;
}

/** The displacement map: horizontal slices, and (datamosh) blocks that also slide up and down. */
function drawTearMap(strength        , blocks = false)       {
  const w = 32;
  const h = 96;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d") ;
  for (let y = 0; y < h;) {
    const band = 1 + Math.floor(Math.random() * 7);
    const shift = Math.random() < 0.55 ? (Math.random() * 2 - 1) * 127 * strength : 0;
    g.fillStyle = `rgb(${Math.round(128 + shift)},128,128)`;
    g.fillRect(0, y, w, band);
    y += band;
  }
  if (blocks) {
    for (let k = 0; k < 10; k++) {
      g.fillStyle = `rgb(${Math.round(128 + (Math.random() * 2 - 1) * 127 * strength)},${Math.round(128 + (Math.random() * 2 - 1) * 110 * strength)},128)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 3 + Math.random() * 14);
    }
  }
  $("tear-map").setAttribute("href", c.toDataURL());
}

/** Datamosh smears, pixel sorting and scan-line bands, drawn over the glass in shades of the phosphor. */
/** The bars of an old test card, in the game's own palette only (Owner, 2026-10-01: green, pale
 *  green, white-green, white, black; no other colour): k is how far toward white, -1 is black. */
const COLOR_BARS = [1, 0.75, 0.45, 0, 0.25, -1];
const COLOR_BARS_LOW = [-1, 0.85, -1, 0, -1, 0.5];
const barColour = (base          , k        ) => (k < 0 ? "#000" : `rgb(${base.map((c) => Math.round(c + (255 - c) * k)).join(",")})`);

/** `p`: how far through the glitch (0–1), for the rolling bar. */
function drawGlitchLayer(e        , fx             , p = 0.5)       {
  const g = surge.getContext("2d") ;
  const W = surge.width;
  const H = surge.height;
  g.clearRect(0, 0, W, H);
  const base = phosphor();
  const hues = [shade(base, 0), shade(base, 0.55), shade(base, -0.45), shade(base, 0.85)];
  if (fx.has("colorBars")) {
    // Bright bars flash across the screen, torn sideways in bands, with the test card's low strip.
    const top = H * 0.72;
    for (let y = 0; y < H; y += 3 + Math.floor(Math.random() * 6)) {
      const band = Math.min(H - y, 3 + Math.floor(Math.random() * 6));
      const shift = Math.random() < 0.3 ? (Math.random() * 2 - 1) * W * 0.08 * e : 0;
      const bars = y < top ? COLOR_BARS : COLOR_BARS_LOW;
      for (let i = 0; i < bars.length; i++) {
        g.fillStyle = barColour(base, bars[i]);
        g.globalAlpha = Math.min(1, 0.95 * e);
        g.fillRect(Math.round((i * W) / bars.length + shift), y, Math.ceil(W / bars.length) + 1, band);
      }
    }
    g.globalAlpha = 1;
  }
  if (fx.has("static")) {
    // TV static: green and white noise on black.
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      if (Math.random() > 0.6) continue;
      const v = Math.random();
      // Black, the phosphor's green, or white (a little green in it).
      const [r, gr, b] = v < 0.4 ? [0, 0, 0] : v < 0.8 ? base : [235, 255, 235];
      img.data[i] = r;
      img.data[i + 1] = gr;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.max(img.data[i + 3], Math.round(255 * e * (0.45 + 0.5 * Math.random())));
    }
    g.putImageData(img, 0, 0);
  }
  if (fx.has("rollingBar")) {
    // A bright band rolls up the screen, like an old TV losing its hold.
    const y = H * (1.1 - 1.3 * p);
    const h = H * 0.16;
    const grad = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    grad.addColorStop(0, `${hues[0]}0)`);
    grad.addColorStop(0.45, `${hues[3]}${0.55 * e})`);
    grad.addColorStop(0.5, `${hues[3]}${0.85 * e})`);
    grad.addColorStop(1, `${hues[0]}0)`);
    g.fillStyle = grad;
    g.fillRect(0, y - h / 2, W, h);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = `${hues[1]}${0.5 * e})`;
      g.fillRect(0, y - h / 2 + Math.random() * h, W, 1);
    }
  }
  if (fx.has("datamosh")) {
    // Blocks of pixels smeared across each other: a row of pixels stretched sideways.
    for (let k = 0; k < Math.round(14 * e); k++) {
      const bx = Math.random() * W;
      const by = Math.random() * H;
      const bw = 8 + Math.random() * 60;
      const bh = 4 + Math.random() * 26;
      for (let yy = 0; yy < bh; yy += 2) {
        g.fillStyle = hues[Math.floor(Math.random() * hues.length)] + (0.25 + Math.random() * 0.5) * e + ")";
        g.fillRect(bx, by + yy, bw * (0.3 + Math.random() * 0.7), 2);
      }
    }
    // Pixel clutter.
    for (let k = 0; k < Math.round(900 * e); k++) {
      g.fillStyle = hues[Math.floor(Math.random() * hues.length)] + (0.5 + Math.random() * 0.5) * e + ")";
      g.fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1);
    }
  }
  if (fx.has("pixelSort")) {
    // Lines of pixels stretch vertically, then snap back.
    for (let k = 0; k < Math.round(40 * e); k++) {
      const x = Math.floor(Math.random() * W);
      const y = Math.random() * H * 0.7;
      const len = (0.1 + Math.random() * 0.6) * H * e;
      const grad = g.createLinearGradient(0, y, 0, y + len);
      grad.addColorStop(0, `${hues[3]}${0.9 * e})`);
      grad.addColorStop(1, `${hues[0]}0)`);
      g.fillStyle = grad;
      g.fillRect(x, y, 1, len);
    }
  }
  if (fx.has("scanlines")) {
    // Vertical bands of brightness drift across.
    for (let k = 0; k < 4; k++) {
      g.fillStyle = `${hues[1]}${(0.05 + Math.random() * 0.12) * e})`;
      g.fillRect(Math.random() * W, 0, 4 + Math.random() * 30, H);
    }
  }
}

function shake(px        )       {
  crt.style.transform = px > 0 ? `translate(${(Math.random() * 2 - 1) * px}px, ${(Math.random() * 2 - 1) * px * 0.6}px)` : "";
}

function settleAll()       {
  shake(0);
  surge.style.opacity = "0";
  surge.getContext("2d") .clearRect(0, 0, surge.width, surge.height);
  document.body.classList.remove("aberration", "tearing", "bloom", "blackout");
  document.body.style.removeProperty("--ab");
  document.body.style.removeProperty("--bloom");
  $("tear-scale").setAttribute("scale", "0");
}

/** 0 → 1 → 0 over a glitch: a smooth rise over the first 30%, a hold, a smooth fall over the last 30%. */
function envelope(p        )         {
  const smooth = (x        ) => x * x * (3 - 2 * x);
  return p < 0.3 ? smooth(p / 0.3) : p < 0.7 ? 1 : smooth(Math.max(0, (1 - p) / 0.3));
}

/**
 * Draws one glitch: `ms` of game time, rising to `peak` and falling back, with the chosen effects.
 * Every effect follows the envelope, so it fades in and out. `abort` ends it early (settled cleanly).
 */
async function renderGlitch(ms        , peak        , fx             , abort                = () => false)                {
  const total = ms / speed;
  const start = gameNow();
  const b = document.body.classList;
  let lastMap = -Infinity;
  let blackedOut = false;
  let frozen = 0;
  if (fx.has("aberration")) b.add("aberration");
  if (fx.has("bloom")) b.add("bloom");
  if (fx.has("slices") || fx.has("datamosh")) b.add("tearing");
  for (let now = start; now - start < total && !abort(); now = gameNow()) {
    const p = (now - start) / total;
    const e = peak * envelope(p);
    // Frame drop: hold the last frame, then jump ahead.
    if (fx.has("frameDrop") && frozen === 0 && Math.random() < 0.06 * e) frozen = 2;
    if (frozen > 0) {
      frozen--;
      await nextFrame();
      continue;
    }
    // A one-frame blackout at the height of it.
    if (fx.has("blackout") && !blackedOut && p >= 0.5) {
      blackedOut = true;
      b.add("blackout");
      await nextFrame();
      b.remove("blackout");
    }
    surge.style.opacity = String(Math.min(1, e * 1.25));
    if (fx.has("shake")) shake(10 * e);
    if (fx.has("aberration")) document.body.style.setProperty("--ab", `${(2 + Math.random() * 3) * e}px`);
    if (fx.has("bloom")) document.body.style.setProperty("--bloom", String(1 + 0.9 * e));
    if ((fx.has("slices") || fx.has("datamosh")) && now - lastMap > 55 / speed) {
      $("tear-scale").setAttribute("scale", String(Math.round(140 * e)));
      drawTearMap(0.35 + 0.65 * e, fx.has("datamosh"));
      lastMap = now;
    }
    drawGlitchLayer(e, fx, p);
    await nextFrame();
  }
  settleAll();
}

/** Story glitches running now; ambient glitches wait for them. */
let storyGlitches = 0;

/**
 * A story glitch (a spoken name, the fake terminal, the timer, the opening's beats). Small 2 s, medium
 * 3 s, large 4 s. Settings > Danger effects changes only how it looks: it lasts just as long in every
 * mode, so nothing in the story moves earlier or later. The notice is read aloud in every mode.
 */
async function glitch(size             , msOverride         )                {
  const plan = msOverride ? { ...GLITCH[size], ms: msOverride } : GLITCH[size];
  const [lo, hi] = plan.effects;
  const fx = new Set(EFFECTS.slice(0, lo + Math.floor(Math.random() * (hi - lo + 1))));
  storyGlitches++;
  await quietAmbient();
  document.documentElement.dataset.flicker = size;
  document.documentElement.dataset.effects = [...fx].join(" ");
  sounds.glitch(plan.ms / 1000 / speed, plan.peak);
  const disturbance = $("disturbance");
  disturbance.textContent = DISTURBANCE;
  document.body.classList.add("disturbed");
  if (prefs.current.dangerEffects !== "full") await sleep(plan.ms);
  else await renderGlitch(plan.ms, plan.peak, fx);
  document.body.classList.remove("disturbed");
  disturbance.textContent = "";
  delete document.documentElement.dataset.flicker;
  storyGlitches--;
}

/** The still, non-flashing danger cue (reduced or off danger effects, and screen readers). */
const DISTURBANCE = "Signal disturbance detected.";

// --- Ambient glitches (Owner, 2026-10-01, rewritten the same day) ----------------------------------
// Only time drives them: the 10-minute connection timer. Terminals no longer matter. Glass normal,
// a small flicker, normal, a small one, normal, a big one... in no fixed order, at no fixed time,
// so the player never knows when the next is coming, and more of them, and stronger, as time runs out:
//   10:00–7:00 small only, rare · 7:00–4:00 small and medium, more often · 4:00–1:00 all, often ·
//   1:00–0:00 constant, the screen barely readable.
// Each flicker is one or more of six kinds: static, VHS tearing, colour bars, pixel sorting,
// chromatic aberration, a rolling bar. Presentation only: never a flicker to the engine, never
// counted, no meter. The glass still holds at a terminal and just after leaving one (see below).

                                                 
                                              
                                                                                          
// Final.md, THE 10-MINUTE TIMER, Part 6 (it replaces the random spacing of 2026-10-01): 10:00–7:00 one flicker
// every 90 s, subtle; 7:00–4:00 every 60 s, medium; 4:00–1:00 every 30 s, strong; 1:00–0:00 continuous.
const TIERS                                                                                 = {
  early: { every: [90000, 90000], sizes: ["small"], sound: 0.08 },
  middle: { every: [60000, 60000], sizes: ["medium"], sound: 0.15 },
  late: { every: [30000, 30000], sizes: ["big"], sound: 0.28 },
  last: { every: [150, 600], sizes: ["medium", "big", "big"], sound: 0.35 },
};
const SIZES                                                                             = {
  small: { ms: [450, 900], peak: 0.35, kinds: 1 },
  medium: { ms: [1100, 1800], peak: 0.62, kinds: 2 },
  big: { ms: [2000, 3000], peak: 0.95, kinds: 3 },
};
const KINDS                                = {
  static: ["static"],
  vhs: ["slices", "scanlines"],
  colorBars: ["colorBars"],
  pixelSort: ["pixelSort"],
  chroma: ["aberration"],
  rollingBar: ["rollingBar"],
};

/** Where the timer stands. Before the command center opens there is no timer, and no glitch. */
function tier()       {
  return timeLeft > 420 ? "early" : timeLeft > 240 ? "middle" : timeLeft > 60 ? "late" : "last";
}

const between = ([lo, hi]                  ) => lo + Math.random() * (hi - lo);
const pick =    (items              ) => items[Math.floor(Math.random() * items.length)];
let ambientGen = 0;
let ambientStop = false;
let ambientPlaying                       = null;

/** Starts the ambient glitches for this connection (the command center has just opened). */
function startAmbient()       {
  const gen = ++ambientGen;
  void (async () => {
    while (gen === ambientGen) {
      // Wait a random while; if the timer crosses into a worse band meanwhile, the next comes sooner.
      const at = tier();
      const due = gameNow() + between(TIERS[at].every) / speed;
      while (gen === ambientGen && gameNow() < due && tier() === at) await sleep(Math.min(400, (due - gameNow()) * speed));
      if (gen !== ambientGen) return;
      // At a terminal, and for a few seconds after leaving one, the glass holds still (Owner, 2026-10-01:
      // no flicker at the real terminal, none on cd ..). The fake terminal's own flickers still play.
      if (storyGlitches > 0 || over || !commandCenterOpen || stillNearTerminal()) continue;
      const band = TIERS[tier()];
      const size = pick(band.sizes);
      const plan = SIZES[size];
      const ms = between(plan.ms);
      const kinds = [...(Object.keys(KINDS)                 )].sort(() => Math.random() - 0.5).slice(0, plan.kinds);
      sounds.glitch(ms / 1000 / speed, band.sound * (size === "big" ? 1.4 : size === "medium" ? 1 : 0.6));
      const mode = prefs.current.dangerEffects;
      if (mode === "off") continue; // no picture at all; the sound stays with the Sound setting
      document.documentElement.dataset.ambient = `${tier()} ${size} ${kinds.join(" ")}`;
      ambientStop = false;
      ambientPlaying = mode === "reduced" ? stillGlitch(ms, plan.peak) : renderGlitch(ms, plan.peak, new Set(kinds.flatMap((k) => KINDS[k])), () => ambientStop || gen !== ambientGen);
      await ambientPlaying;
      ambientPlaying = null;
      delete document.documentElement.dataset.ambient;
    }
  })();
}

/** How long the glass stays still after Caine leaves a terminal with cd .. */
const AFTER_TERMINAL_MS = 6000;
/** When Caine last left a terminal (set by submit). */
let terminalLeftAt = -Infinity;
function stillNearTerminal()          {
  return session.connectionSnapshot().atTerminal || gameNow() - terminalLeftAt < AFTER_TERMINAL_MS / speed;
}

/** Reduced danger effects: a still colour fringe on the text for the glitch's length. No motion. */
async function stillGlitch(ms        , peak        )                {
  document.body.style.setProperty("--still", `${(1 + 3 * peak).toFixed(1)}px`);
  document.body.classList.add("still-glitch");
  const end = gameNow() + ms / speed;
  while (gameNow() < end && !ambientStop) await sleep(100);
  document.body.classList.remove("still-glitch");
}

/** A story glitch takes over: any ambient glitch ends at once, cleanly. */
async function quietAmbient()                {
  ambientStop = true;
  await ambientPlaying;
}

function stopAmbient()       {
  ambientGen++;
  ambientStop = true;
}

/**
 * The command center opens (Owner, 2026-09-30), 1.5 s: a scan line sweeps left to right, the command
 * center fades in from the left, and John's chat slides to the right edge, shrinking slightly.
 */
async function openCommandCenterTransition()                {
  const chatEl = $("chat");
  const first = chatEl.getBoundingClientRect();
  commandCenterOpen = true;
  setPhase("command");
  const last = chatEl.getBoundingClientRect();
  const dur = 1500 / speed;
  sounds.play("whoosh");
  if (prefs.reduceMotion) {
    // Same pause, no movement: the panels are simply there.
    await sleep(1500);
    sounds.play("click");
    chatScroll();
    return;
  }
  const sweep = document.createElement("div");
  sweep.className = "sweep";
  crt.appendChild(sweep);
  sweep.animate([{ width: "0%", opacity: 1 }, { width: "100%", opacity: 1, offset: 0.85 }, { width: "100%", opacity: 0 }], { duration: dur * 0.6, easing: "ease-in-out", fill: "forwards" });
  screen.animate([{ opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)" }], { duration: dur * 0.75, delay: dur * 0.15, easing: "ease-out", fill: "backwards" });
  chatEl.animate([
    { transformOrigin: "top left", transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})` },
    { transformOrigin: "top left", transform: "none" },
  ], { duration: dur * 0.8, delay: dur * 0.1, easing: "cubic-bezier(.6,0,.2,1)", fill: "backwards" });
  await sleep(1500);
  sweep.remove();
  sounds.play("click");
  chatScroll();
}

// --- Connection terminated (Owner, 2026-10-01) ------------------------------------------------------
// A virus attack covers the screen: boxes of every shape, red, white and black, each with pixelated
// taunting text that dances. They multiply for five seconds, then settle, and the terminated message
// holds in the centre for four. Then the TV switches off. The green is over; the background is silent.

const virusEl = $("virus");

                                                                                                              

/** One box: small, large, wide or tall; its text drawn into a tiny canvas that is scaled up (pixelated). */
function virusBox()           {
  const shapes = [
    () => [6 + Math.random() * 8, 6 + Math.random() * 8], // small
    () => [24 + Math.random() * 22, 20 + Math.random() * 24], // large
    () => [38 + Math.random() * 42, 5 + Math.random() * 7], // wide
    () => [6 + Math.random() * 7, 28 + Math.random() * 34], // tall
  ];
  const [w, h] = shapes[Math.floor(Math.random() * shapes.length)]();
  const el = document.createElement("div");
  const tone = Math.floor(Math.random() * 3);
  el.className = `virus-box tone-${tone}`;
  Object.assign(el.style, { left: `${Math.random() * (100 - w)}%`, top: `${Math.random() * (100 - h)}%`, width: `${w}%`, height: `${h}%` });
  const canvas = document.createElement("canvas");
  const rect = crt.getBoundingClientRect();
  canvas.width = Math.max(16, Math.round((rect.width * w) / 100 / 5));
  canvas.height = Math.max(8, Math.round((rect.height * h) / 100 / 5));
  el.appendChild(canvas);
  return { el, canvas, text: VIRUS_TAUNTS[Math.floor(Math.random() * VIRUS_TAUNTS.length)], tone, seed: Math.random() * 10 };
}

/** The box's text, letter by letter; `t` makes each letter bob (the dance). Tall boxes stack letters. */
function drawVirusText(box          , t        , dancing         )       {
  const g = box.canvas.getContext("2d") ;
  const W = box.canvas.width;
  const H = box.canvas.height;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, W, H);
  // The fake terminal's bomb is green, white and black (Owner, 2026-10-01); the other endings keep theirs.
  g.fillStyle = (virusGreen ? ["#33ff33", "#000000", "#063306"] : ["#ffffff", "#ff2020", "#000000"])[box.tone];
  const tall = H > W * 1.5;
  const chars = [...box.text];
  const size = Math.max(5, Math.floor(tall ? Math.min(W * 0.8, H / (chars.length + 1)) : Math.min(H * 0.6, W / (chars.length * 0.62 + 1))));
  g.font = `bold ${size}px monospace`;
  g.textBaseline = "middle";
  g.textAlign = "center";
  const rows = tall ? 1 : Math.max(1, Math.floor(H / (size * 1.4)));
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < chars.length; i++) {
      const bob = dancing ? Math.sin(t * 9 + i * 0.9 + box.seed + r) * size * 0.25 : 0;
      const x = tall ? W / 2 : (W - chars.length * size * 0.62) / 2 + (i + 0.5) * size * 0.62;
      const y = tall ? (i + 1) * (H / (chars.length + 1)) + bob * 0.4 : ((r + 0.5) * H) / rows + bob;
      g.fillText(chars[i], x + (dancing ? Math.sin(t * 5 + i) * 0.6 : 0), y);
    }
  }
}

/** Clears the virus attack once the screen is dark. */
function clearVirus()       {
  virusEl.textContent = "";
  virusEl.hidden = true;
  document.body.classList.remove("terminated");
}

/**
 * An old TV switching off (Owner, 2026-10-01): the picture collapses to a horizontal line, the line
 * shrinks to a bright dot, the dot throws a brief four-pointed star and vanishes. Then darkness.
 */
async function tvOff()                {
  sounds.tvOff();
  crt.classList.add("tv-off");
  const ms = 900;
  if (!prefs.reduceMotion) {
    crt.animate([
      { transform: "scale(1, 1)", filter: "brightness(1)" },
      { transform: "scale(1, 0.006)", filter: "brightness(2.5)", offset: 0.45 },
      { transform: "scale(0.01, 0.006)", filter: "brightness(4)", offset: 0.75 },
      { transform: "scale(0, 0)", filter: "brightness(4)" },
    ], { duration: ms / speed, easing: "ease-in", fill: "forwards" });
    const star = document.createElement("div");
    star.className = "tv-star";
    document.body.appendChild(star);
    star.animate([
      { transform: "translate(-50%, -50%) scale(0) rotate(0deg)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1) rotate(20deg)", opacity: 1, offset: 0.4 },
      { transform: "translate(-50%, -50%) scale(0) rotate(45deg)", opacity: 0 },
    ], { duration: 420 / speed, delay: (ms * 0.62) / speed, easing: "ease-out", fill: "both" });
    await sleep(ms + 420 * 0.62);
    star.remove();
  } else await sleep(ms);
  crt.classList.add("blank");
  for (const a of crt.getAnimations()) a.cancel();
  crt.classList.remove("tv-off");
}

/** The dark screen flickers back on. */
async function tvOn()                {
  crt.classList.remove("blank");
  clearVirus();
  sounds.restore();
  if (!prefs.calm) {
    crt.animate([{ opacity: 0 }, { opacity: 0.7, offset: 0.2 }, { opacity: 0.15, offset: 0.35 }, { opacity: 1 }], { duration: 450 / speed });
  }
  await sleep(450);
}

// --- Boot (Owner, 2026-09-30; reworked 2026-10-01 twice) ---------------------------------------------
// Windows of code appear one by one at an ordinary size, slowly, then faster, then overwhelming, until
// they cover the screen: small, medium and large; wide, tall and square; assembly, hex, ASCII art and
// a few silly ones; some with title bars. Then the machine overloads (2 s): the windows keep coming
// and their light builds, aggressively, to an almost blinding fluorescent green. A hard cut to black;
// one second of dark and silence; the glass flickers back on (0.5 s) and the opening begins.
// Sound: a Matrix-style mix (low hum, rising swell, distant typing) builds with the windows and the
// light, is loudest at the peak, and cuts to silence with the picture. Once per game start.

function gibberish()         {
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  const ops = ["mov", "xor", "jmp", "call", "push", "pop", "cmp", "lea", "and", "shl", "ret", "int"];
  const regs = ["eax", "ebx", "ecx", "edx", "esi", "edi", "ebp", "esp"];
  const pick =    (a     ) => a[Math.floor(Math.random() * a.length)];
  switch (Math.floor(Math.random() * 4)) {
    case 0: return `${hex()}:${hex()}  ${pick(ops).padEnd(5)}${pick(regs)}, [${pick(regs)}+0x${hex()}]`;
    case 1: return Array.from({ length: 8 }, hex).join(" ");
    case 2: return `${pick(["::", "<<", ">>", "=>", "&&", "||", "##"])} ${hex()}${hex()} ${"#$%&*+=/\\|~^".split("").sort(() => Math.random() - 0.5).join("").slice(0, 6)} ${hex()}`;
    default: return `0x${hex()}${hex()}  ${Array.from({ length: 6 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join("")}  ${hex()}`;
  }
}

const ASCII_ART = [
  ["   .-----.", "  / () () \\", " |   /\\    |", "  \\ '--' /", "   '-----'"],
  ["  /\\  /\\  /\\  /\\", " /  \\/  \\/  \\/  \\", "/                \\"],
  ["+--------+", "|##::##::|", "|::##::##|", "|##::##::|", "+--------+"],
  ["  _____", " |ERROR|", " |_____|", "  |   |", " /_____\\"],
  ["░▒▓█▓▒░▒▓█", "▓▒░▒▓█▓▒░▒", "█▓▒░▒▓█▓▒░"],
  ["   <>", "  <<>>", " <<<>>>", "<<<<>>>>", " <<<>>>", "  <<>>", "   <>"],
];

/** The silly ones: a cat, a rocket, a smiling disk, a beeping robot. */
const SILLY_ART = [
  ["  /\\_/\\", " ( o.o )", "  > ^ <", " MEOW.EXE"],
  ["    /\\", "   |==|", "   |  |", "  /|/\\|\\", " LIFTOFF!"],
  [" ________", "|  ____  |", "| |^  ^| |", "| | \\/ | |", "|________|", " HELLO :)"],
  ["  [o_o]", " /|___|\\", "  d   b", " BEEP BOOP"],
  ["LOADING", "[#####.....]", "[######....]", "[#######...]", "PLEASE WAIT"],
];

function hexDump()         {
  const addr = Math.floor(Math.random() * 0xfffff).toString(16).padStart(8, "0");
  const bytes = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
  return `${addr}  ${bytes.map((x) => x.toString(16).padStart(2, "0")).join(" ")}  ${bytes.map((x) => (x > 32 && x < 127 ? String.fromCharCode(x) : ".")).join("")}`;
}

                                                         
                                                                                 

/** One window, already at its size: small, medium or large; wide, tall or square. */
function makePop()      {
  const el = document.createElement("div");
  const shapes                        = [
    () => [9 + Math.random() * 6, 9 + Math.random() * 7], // small square
    () => [16 + Math.random() * 10, 14 + Math.random() * 10], // medium
    () => [17 + Math.random() * 9, 15 + Math.random() * 9], // medium
    () => [28 + Math.random() * 14, 24 + Math.random() * 14], // large
    () => [30 + Math.random() * 22, 7 + Math.random() * 6], // wide
    () => [9 + Math.random() * 6, 28 + Math.random() * 18], // tall
  ];
  const [w, h] = shapes[Math.floor(Math.random() * shapes.length)]();
  const left = Math.random() * (100 - w);
  const top = Math.random() * (100 - h);
  const kind          = (["asm", "hex", "art", "silly", "mixed", "asm", "hex"]         )[Math.floor(Math.random() * 7)];
  const framed = Math.random() < 0.6;
  el.className = `pop${framed ? " framed" : ""}`;
  Object.assign(el.style, { left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%` });
  if (framed) {
    const bar = document.createElement("div");
    bar.className = "bar";
    const title = document.createElement("span");
    title.textContent = kind === "silly"
      ? ["fun.exe", "cat.exe", "hello.com", "robot.bat", "wait.exe"][Math.floor(Math.random() * 5)]
      : `${["proc", "sys", "mem", "kernel", "dump", "task"][Math.floor(Math.random() * 6)]}_${Math.floor(Math.random() * 0xfff).toString(16)}.exe`;
    const buttons = document.createElement("span");
    buttons.className = "buttons";
    buttons.textContent = "_ □ ×";
    bar.append(title, buttons);
    el.appendChild(bar);
  }
  const pool = kind === "silly" ? SILLY_ART : ASCII_ART;
  const art = pool[Math.floor(Math.random() * pool.length)];
  return { el, kind, art, artAt: 0 };
}

function popLine(p     )         {
  switch (p.kind) {
    case "asm": return gibberish();
    case "hex": return hexDump();
    case "art":
    case "silly": return p.art[p.artAt++ % p.art.length];
    default: return Math.random() < 0.5 ? hexDump() : gibberish();
  }
}

const BOOT_SPAWN_MS = 8200;
/** Steps 1–5: the windows keep compiling while the light builds to overload. */
const OVERLOAD_MS = 2000;
/** Step 7: dark and silent. */
const DARK_MS = 1000;
/** Step 8: the glass flickers back on. */
const WAKE_MS = 500;

async function bootSequence()                {
  setPhase("boot");
  log.textContent = "";
  bootEl.textContent = "";
  sounds.bootStart();
  const pops        = [];
  const add = (pop     ) => {
    bootEl.appendChild(pop.el);
    pops.push(pop);
    // It appears cleanly, at its size: a quick fade, no zoom.
    pop.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140 / speed, easing: "ease-out" });
  };
  const scroll = () => {
    for (const pop of pops.slice(-40)) {
      const row = document.createElement("div");
      row.textContent = popLine(pop);
      pop.el.appendChild(row);
      const first = pop.el.firstElementChild?.classList.contains("bar") ? 1 : 0;
      while (pop.el.childNodes.length > 30) pop.el.removeChild(pop.el.childNodes[first]);
    }
  };
  const start = gameNow();
  const spawn = BOOT_SPAWN_MS / speed;
  const overload = OVERLOAD_MS / speed;
  let nextPop = 0;
  let lastLine = -Infinity;
  let nextKey = 0;
  let lastMix = -Infinity;
  // Calm (Settings): the light builds only part of the way, so nothing approaches white.
  const peak = prefs.calm ? 0.4 : 0.94;
  const [r, g, b] = phosphor();
  bootEl.style.removeProperty("filter");
  flashEl.style.opacity = "0";
  for (let now = start; now - start < spawn + overload; now = gameNow()) {
    const t = now - start;
    const p = Math.min(1, t / spawn);
    // 0 → 1 across the overload, steep: slow to start, then aggressive.
    const o = Math.max(0, (t - spawn) / overload);
    const surge = o ** 1.6;
    // One at a time, about one a second at first, then faster, then a flood that does not stop.
    if (t >= nextPop) {
      add(makePop());
      nextPop += Math.max(28, 950 * (1 - p) ** 2.4) / speed;
    }
    if (now - lastLine > 90 / speed) {
      scroll();
      lastLine = now;
    }
    // The old keyboard, distant: a few keys a second at first, a torrent at the peak.
    if (t >= nextKey) {
      sounds.bootKey();
      nextKey += ((260 - 236 * p ** 1.4) * (0.6 + Math.random() * 0.8)) / speed;
    }
    if (now - lastMix > 100 / speed) {
      sounds.bootLevel(0.75 * p ** 1.3 + 0.25 * surge);
      lastMix = now;
    }
    if (o > 0) {
      // The windows' light builds together: brighter, greener, then fluorescent, almost white.
      bootEl.style.filter = `brightness(${1 + 2.2 * surge}) saturate(${1 + 1.5 * surge})`;
      const k = surge * 0.75;
      flashEl.style.background = `radial-gradient(ellipse at 50% 50%, rgb(${[r, g, b].map((c) => Math.round(c + (255 - c) * Math.min(1, k + 0.2))).join(",")}) 0%, rgb(${[r, g, b].map((c) => Math.round(c + (255 - c) * k)).join(",")}) 70%)`;
      flashEl.style.opacity = String(peak * surge);
    }
    await nextFrame();
  }
  bootEl.dataset.count = String(pops.length);
  // The hard cut: complete darkness, complete silence.
  sounds.bootCut();
  bootEl.textContent = "";
  bootEl.style.removeProperty("filter");
  flashEl.style.opacity = "0";
  flashEl.style.background = "";
  crt.classList.add("blank");
  await sleep(DARK_MS);
  // The glass wakes: a slight flicker and the soft turn-on of a CRT. Then the story begins.
  crt.classList.remove("blank");
  crt.classList.add("boot-rest");
  sounds.restore();
  sounds.holdMusic(false, 1.5);
  if (!prefs.calm) crt.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.3 }, { opacity: 0.35, offset: 0.5 }, { opacity: 1 }], { duration: WAKE_MS / speed });
  else crt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: WAKE_MS / speed });
  await sleep(WAKE_MS);
  crt.classList.remove("boot-rest");
}

// --- Drawing ---------------------------------------------------------------------------------------

/**
 * The commands of Level 1 (Final.md, THE AMBER SETTING, Part 2): dir, cd, type, open, play, choose, yes, exit, and
 * EXIT with the code. Anything else typed is not a command and keeps the standard colour.
 */
const COMMAND_WORDS = /^\s*(dir|cd|cd\.\.|type|open|play|choose|yes|exit)(\s|$)/i;

/** A typed line as the screen shows it: the prompt, then the command, which turns amber in amber mode. */
function appendEcho(prompt        , typed        )                 {
  const div = append(prompt + typed, "echo");
  const command = document.createElement("span");
  command.className = COMMAND_WORDS.test(typed) ? "typed-command" : "typed-text";
  command.textContent = typed;
  div.replaceChildren(prompt, command);
  return div;
}

function append(text        , style        )                 {
  const div = document.createElement("div");
  div.className = style;
  div.textContent = text;
  log.appendChild(div);
  toBottom();
  announce(text);
  return div;
}

/** Screen readers hear each line once, whole, however it is typed on screen. */
const srLog = $("sr-log");
function announce(text        )       {
  if (!text.trim()) return;
  const div = document.createElement("div");
  div.textContent = text;
  srLog.appendChild(div);
  while (srLog.childNodes.length > 40) srLog.removeChild(srLog.firstChild );
}

/** The chat always shows its newest line. */
function chatScroll()       {
  chatLog.scrollTop = chatLog.scrollHeight;
}

// The panel changes size when the input line, the "..." or the command center appears; keep the newest line in view.
new ResizeObserver(chatScroll).observe(chatLog);

function chatAppend(text        , style        )                 {
  const div = document.createElement("div");
  div.className = style;
  div.textContent = text;
  chatLog.appendChild(div);
  chatScroll();
  return div;
}

// One thing at a time in the chat: a reaction, an answer and the tutorial never type over each other.
let chatQueue                = Promise.resolve();
/** Raised when the chat is cut short (the opening skipped): lines queued or typing before it stop. */
let chatGen = 0;
/** Chat turns queued or under way: John is talking while this is above zero. */
let chatPending = 0;
function chatTurn(fn                     )                {
  chatPending++;
  const turn = chatQueue.then(fn).finally(() => {
    chatPending--;
  });
  chatQueue = turn.catch(() => {});
  return turn;
}

// --- Interrupting John (Owner, 2026-10-06) -------------------------------------------------------------
// In the command center the player can type and send at any time, even while John is talking. When what
// the player sends brings a new answer from John, he breaks off: his line ends with "—" where it stood,
// whatever he still meant to say is dropped (never saved, never resumed), and his answer begins "— ".
// The opening's conversation (Stage 1, Moments 1–4) still holds the keys. In the tutorial (Moments 5–7, in
// the command center) a broken-off line is dropped and the tutorial goes on with its next step.

/** John's line being typed now, or null. */
let typing                     = null;
/** The next line John starts follows a broken-off one: it begins with a dash. */
let dashNext = false;
/** John's own typing in the command center, about 30% faster than before (Owner, 2026-10-06). */
const JOHN_FASTER = 0.7;

function interruptible()          {
  return commandCenterOpen && !over;
}

/** Breaks John off if he is talking: the line being typed ends with "—", the rest of what he meant to say is gone. */
function cutJohn()       {
  if (!interruptible() || chatPending === 0) return;
  if (typing) {
    typing.append("—");
    typing = null;
    dashNext = true;
  }
  chatGen++;
  chatScroll();
}

/** A wait between John's lines that ends early when he is broken off. */
async function chatSleep(ms        , gen        )                {
  const until = gameNow() + ms / speed;
  while (gen === chatGen && gameNow() < until) await sleep(Math.min(100, (until - gameNow()) * speed));
}

/** John starts to answer and does not: three dots appear, stop, appear again, stop, disappear. */
function unanswered()                {
  const gen = chatGen;
  return chatTurn(async () => {
    if (gen !== chatGen) return;
    document.body.classList.remove("idle");
    const d = chatAppend("", "dots");
    for (let round = 0; round < 2 && gen === chatGen; round++) {
      for (let i = 0; i < 3; i++) {
        await sleep(DOT_MS);
        d.textContent += ".";
        sounds.play("johnKey");
      }
      await sleep(900);
      d.textContent = "";
      await sleep(round === 0 ? 700 : 200);
    }
    d.remove();
    if (commandCenterOpen) document.body.classList.add("idle");
  });
}

/** `onTyped`: called with the text so far after each letter (a flicker can fire on a word). */
function chatType(text        , style                  , msPerChar        , dots         , onTyped                          )                {
  const gen = chatGen;
  return chatTurn(() => (gen === chatGen ? chatWrite(text, style, msPerChar, dots, gen, onTyped) : Promise.resolve()));
}

async function chatWrite(text        , style                  , msPerChar        , dots         , gen        , onTyped                          )                {
  document.body.classList.remove("idle");
  // After a broken-off line John goes straight on, "— " first.
  if (style === "john" && dashNext) {
    dashNext = false;
    dots = false;
    text = `— ${text}`;
  }
  if (dots) {
    const d = chatAppend("", "dots");
    for (let i = 0; i < 3 && gen === chatGen; i++) {
      await chatSleep(300, gen);
      d.textContent += ".";
    }
    await chatSleep(300, gen);
    d.remove();
    if (gen !== chatGen) return;
  }
  if (style === "john" && commandCenterOpen) msPerChar *= JOHN_FASTER;
  const div = chatAppend("", style);
  if (style === "john") typing = div;
  const chars = [...text];
  // A command in John's line (the script's `dir`, `cd ..`) is shown as a command, without the backticks.
  let into              = div;
  let sofar = "";
  for (let i = 0; i < chars.length; i++) {
    if (gen !== chatGen) {
      if (typing === div) typing = null;
      return;
    }
    if (chars[i] === "`") {
      into = into === div ? div.appendChild(Object.assign(document.createElement("span"), { className: "cmd" })) : div;
      continue;
    }
    into.append(chars[i]);
    sofar += chars[i];
    if (style === "john" && chars[i].trim()) sounds.play("johnKey");
    onTyped?.(sofar);
    chatScroll();
    if (i < chars.length - 1) await sleep(msPerChar * prefs.textSpeedFactor); // ready for a tap as soon as the last letter lands
  }
  if (typing === div) typing = null;
  announce(text.replace(/`/g, ""));
  saveResume();
  if (commandCenterOpen) document.body.classList.add("idle"); // John silent: the panel shows "..."
}

let closeFile                      = null;
function openFile(header        , title        , body        , warning         )                {
  pager.l.textContent = header;
  pager.r.textContent = header;
  pager.title.textContent = title;
  pager.body.textContent = body;
  pager.body.classList.toggle("warning", warning);
  pager.body.scrollTop = 0;
  pager.foot.textContent = "Press q to close. Press space to continue reading.";
  announce(`${header}. ${title}.`);
  announce(body);
  setPhase("file");
  return new Promise      ((resolve) => {
    closeFile = () => {
      closeFile = null;
      setPhase("command");
      resolve();
    };
  });
}
/** A picture, full screen, its caption below (Owner, 2026-09-30). Closes with q, Esc, Enter, space or a tap. */
let closeImage                      = null;
function openImage(name        , image        , caption        )                {
  viewerImg.src = `images/${image}.jpg`;
  $("viewer-name").textContent = name;
  $("viewer-caption").textContent = caption;
  zoomAt = ZOOMS.indexOf(1);
  panX = 0;
  panY = 0;
  announce(`${name}. ${caption}`);
  setPhase("image");
  fitPicture();
  return new Promise      ((resolve) => {
    closeImage = () => {
      closeImage = null;
      setPhase("command");
      resolve();
    };
  });
}

// --- Looking closely at a picture (Owner, 2026-10-06) ------------------------------------------------
// + or the wheel up zooms in, − or the wheel down zooms out, 50% to 400%, a step at a time. Zoomed past
// 100% the arrow keys move around the picture, 20 pixels a press, up, down, left or right, never past its
// edges: the picture stays inside its window, the size it has at 100%. The clocks of Clue 3 are small.

const viewerImg = $("viewer-img")                    ;
const viewerFrame = $("viewer-frame");
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
const PAN_STEP = 20;
let zoomAt = ZOOMS.indexOf(1);
let panX = 0;
let panY = 0;

/** The picture at 100%: as large as fits the screen above its caption, as before. */
function fitPicture()       {
  const w = viewerImg.naturalWidth;
  const h = viewerImg.naturalHeight;
  const viewer = $("viewer");
  const k = Math.min((viewer.clientWidth * 0.88) / w, (viewer.clientHeight * 0.72) / h);
  if (w && h && k > 0) {
    for (const el of [viewerFrame, viewerImg]) {
      el.style.width = `${Math.round(w * k)}px`;
      el.style.height = `${Math.round(h * k)}px`;
    }
  }
  drawZoom();
}
viewerImg.addEventListener("load", fitPicture);
new ResizeObserver(() => {
  if (phase === "image") fitPicture();
}).observe($("viewer"));

/** Applies the zoom and keeps the picture inside its window: no moving at all at 100% or below. */
function drawZoom()       {
  const z = ZOOMS[zoomAt];
  const maxX = Math.max(0, ((z - 1) * viewerFrame.clientWidth) / 2);
  const maxY = Math.max(0, ((z - 1) * viewerFrame.clientHeight) / 2);
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
  viewerImg.style.transform = `translate(${panX}px, ${panY}px) scale(${z})`;
  $("viewer-zoom").textContent = `${Math.round(z * 100)}%`;
}

function zoomBy(step        )       {
  zoomAt = Math.max(0, Math.min(ZOOMS.length - 1, zoomAt + step));
  drawZoom();
}

/** An arrow moves the view that way: the picture slides the other way, 20 pixels. */
function panBy(dx        , dy        )       {
  if (ZOOMS[zoomAt] <= 1) return;
  panX -= dx * PAN_STEP;
  panY -= dy * PAN_STEP;
  drawZoom();
}

/** One wheel notch is one step, however finely the wheel reports. */
let wheelSum = 0;
$("viewer").addEventListener("wheel", (e) => {
  e.preventDefault();
  if (phase !== "image" || paused) return;
  wheelSum += e.deltaY;
  if (Math.abs(wheelSum) < 50) return;
  zoomBy(wheelSum < 0 ? 1 : -1);
  wheelSum = 0;
}, { passive: false });

// --- Songs in folders (Owner, 2026-10-01; redesigned the same day) ---------------------------------
// A folder may hold a song. Its line in `dir` is the song itself, the same height as any other file:
// "♪ NAME.MP3  ▶", with ⏸ while it plays; a click plays or pauses it. `play NAME.MP3`, `pause` and
// `play` work too. It plays under the exploring, shown on a bar at the bottom of the command center
// (♪ Playing: title, beat bars, one play/pause button), and stops when the connection ends or the
// player leaves for the menu.

                                                                            
const songBar = $("song-bar");
const songTitle = $("song-title");
const songToggle = $("song-toggle")                     ;
/** The waveform: 28 bars, about 4 cm long (Owner, 2026-10-01: "like a real audio waveform"). */
const BEAT_BARS = 28;
const beatBars = Array.from({ length: BEAT_BARS }, () => $("song-beat").appendChild(document.createElement("i")));
$("pause-btn").querySelector(".pause-glyph") .replaceChildren(glyph("pause"));
// The video overlay: PLAY ▶ at the top left; the frozen time and the date at the bottom left.
$("osd-play").querySelector(".osd-glyph") .replaceChildren(glyph("play"));
$("osd-clock").textContent = `${SCREEN_TIME}\n${SCREEN_DATE}`;
/** Every 15–20 s of game time PLAY and the time glitch for 1–2 s, then settle back (Owner, 2026-10-01). */
function osdGlitches()       {
  after(15000 + Math.random() * 5000, () => {
    for (const id of ["osd-play", "osd-clock"]) {
      const el = $(id);
      el.classList.remove("osd-glitch");
      void el.offsetWidth; // restart the animation
      el.classList.add("osd-glitch");
      setTimeout(() => el.classList.remove("osd-glitch"), 1700);
    }
    osdGlitches();
  });
}
osdGlitches();
$("skip-btn").querySelector(".skip-glyph") .replaceChildren(glyph("skip"));
// ⏮ and ⏭: shown in the Archive, which has a list of songs to step through (menu.ts drives them).
$("song-prev").replaceChildren(glyph("prev"));
$("song-next").replaceChildren(glyph("next"));

/** A song's own line: "♪ NAME.MP3  ▶". It plays, pauses or resumes that song. */
function songButton(item          )                    {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "song-file";
  b.dataset.song = item.song;
  b.dataset.title = item.title;
  const name = document.createElement("span");
  name.textContent = `♪ ${item.name}`;
  const symbol = document.createElement("span");
  symbol.className = "song-symbol";
  b.append(name, symbol);
  b.dataset.cmd = `play ${item.path.slice(2)}`;
  drawSongButton(b);
  return b;
}

/**
 * The buttons in the command center's lines (icons, songs, thumbnails) carry the command they stand for,
 * answered here, so a screen restored by CONTINUE works like a fresh one. A song that is already
 * playing pauses or resumes instead.
 */
log.addEventListener("click", (e) => {
  const b = (e.target           ).closest?.             ("button[data-cmd]");
  if (!b || phase !== "command" || over) return;
  const state = sounds.songState;
  if (b.dataset.song && state?.id === b.dataset.song) {
    if (state.playing) sounds.pauseSong();
    else sounds.resumeSong();
    return;
  }
  if (!busy) void submit(b.dataset.cmd );
});

/**
 * ▶ or ⏸. The pause sign is drawn as two bars: the terminal fonts have no ⏸ and show a dot instead.
 * data-symbol carries which one is shown.
 */
function drawSymbol(el             , playing         )       {
  if (el.dataset.symbol === (playing ? "pause" : "play")) return;
  el.dataset.symbol = playing ? "pause" : "play";
  el.replaceChildren(glyph(playing ? "pause" : "play"));
}

function drawSongButton(b             )       {
  const state = sounds.songState;
  const playing = state?.id === b.dataset.song && state?.playing === true;
  drawSymbol(b.querySelector             (".song-symbol") , playing);
  b.classList.toggle("playing", playing);
  b.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${b.dataset.title}`);
}

function songCommand(s                                                                                                )       {
  if (s.action === "play") {
    remember("song", s.path);
    sounds.playSong(s.song, s.title);
  } else if (s.action === "pause") {
    if (sounds.songState?.playing) sounds.pauseSong();
    else append(SONG_TEXT.nothing, "system");
  } else if (!sounds.resumeSong()) append(SONG_TEXT.nothing, "system");
}

/** The bar shows the song, its beat, and one button: ⏸ while it plays, ▶ while it is paused. */
function drawSongBar()       {
  // The Archive (menu.ts) follows the song too.
  document.dispatchEvent(new Event("caine:song"));
  const state = sounds.songState;
  songBar.hidden = !state;
  document.body.classList.toggle("song-on", !!state);
  for (const b of Array.from(document.querySelectorAll             (".song-file"))) drawSongButton(b);
  if (!state) return;
  songTitle.textContent = state.playing ? SONG_TEXT.playing(state.title) : SONG_TEXT.paused(state.title);
  drawSymbol(songToggle.firstElementChild               , state.playing);
  songToggle.setAttribute("aria-label", state.playing ? `Pause ${state.title}` : `Play ${state.title}`);
  songBar.classList.toggle("playing", state.playing);
  if (state.playing) beat();
}
sounds.onSong = drawSongBar;
songToggle.addEventListener("click", () => {
  if (sounds.songState?.playing) sounds.pauseSong();
  else sounds.resumeSong();
});

/**
 * The beat (Owner, 2026-10-01): small bars beside the title that bounce with the song, read from the
 * music itself; where the music cannot be read (sound off), they pulse on a beat timer instead.
 * Paused, they lie flat. Reduce motion: they hold still at a middle height.
 */
let beating = false;
function beat()       {
  if (beating) return;
  beating = true;
  // ▁▃▅▇▅▃▁▃▅▇▅…: humps, for the beat timer and reduce motion.
  const shape = beatBars.map((_, i) => 0.35 + 0.65 * Math.abs(Math.sin((i / 7) * Math.PI)));
  const tick = () => {
    const state = sounds.songState;
    if (!state?.playing || songBar.hidden) {
      for (const bar of beatBars) bar.style.transform = "scaleY(0.12)";
      beating = false;
      return;
    }
    if (prefs.reduceMotion) for (const [i, bar] of beatBars.entries()) bar.style.transform = `scaleY(${0.25 + 0.35 * shape[i]})`;
    else {
      const levels = sounds.songLevels(beatBars.length);
      const heard = levels.some((v) => v > 0.02);
      const t = gameNow() / 1000;
      // About 100 beats a minute when the music cannot be read.
      const pulse = Math.max(0, Math.sin(t * Math.PI * (100 / 60))) ** 2;
      for (const [i, bar] of beatBars.entries()) {
        // Higher bands are quieter in any song: lift them, and compress, so every bar moves.
        const v = heard ? Math.min(1, Math.sqrt(levels[i]) * (1.05 + 0.05 * i)) : shape[i] * (0.25 + 0.75 * pulse) * (0.8 + 0.2 * Math.sin(t * 7 + i));
        bar.style.transform = `scaleY(${(0.12 + 0.88 * v).toFixed(3)})`;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// --- Keeping the newest line in view (Owner, 2026-10-01) ---------------------------------------------
// After anything is written, the command center scrolls so its last line sits at the bottom of the
// glass with the prompt right below: always, also when a picture or the song bar appears later. A
// listing taller than the glass (or than 30 lines) is paged: [MORE], and any key or tap goes on.

// Fixed components (Owner, 2026-10-06): the page and the glass never scroll, so pause, PLAY, the timer,
// the song bar and the date stay put; only the command center's lines and John's panel scroll inside.
window.addEventListener("scroll", () => window.scrollTo(0, 0));
crt.addEventListener("scroll", () => {
  crt.scrollTop = 0;
  crt.scrollLeft = 0;
});

function toBottom()       {
  screen.scrollTop = screen.scrollHeight;
}
const follow = new ResizeObserver(() => {
  if (phase === "command" || phase === "choice") toBottom();
});
for (const el of [log, line, songBar, $("return-hint")]) follow.observe(el);

/** At most this many lines of a listing at once. */
const MORE_LINES = 30;
let moreWaiter                      = null;

/** How many lines of text fit on the glass above the prompt. */
function linesThatFit()         {
  const style = getComputedStyle(screen);
  const lineHeight = parseFloat(getComputedStyle(log).lineHeight) || 33;
  // The song bar's room is already in the padding (body.song-on).
  const room = screen.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  return Math.floor(room / lineHeight) - 1;
}

/** "[MORE]": waits for a key or a tap, then makes way for the next page. */
function more()                {
  const row = append("[MORE]", "more");
  toBottom();
  return new Promise      ((resolve) => {
    moreWaiter = () => {
      moreWaiter = null;
      row.remove();
      resolve();
    };
  });
}

/**
 * Icon view (Owner, 2026-10-01; Settings > Display > View mode): the same listing as pixel-art icons
 * of an old PC, our names under them, between the listing's own header and totals. A folder opens
 * with cd, a file with type, INPUT.EXE with open, a song plays, as if typed.
 * Nothing is ever cut off (Owner, 2026-10-06): the icons shrink until the whole listing fits on the
 * glass with the prompt below it; if it still does not, the icons scroll inside their own box (the
 * mouse wheel, Page Up / Page Down, or Shift with the up and down arrows). A picture's tile shows the
 * picture itself, so the listing needs no separate row of thumbnails.
 */
function showIcons(text        , path        , songs            , entries                                           , pictures                                        )       {
  const rows = text.split("\n");
  const here = path === session.connectionSnapshot().cwd;
  const target = (name        ) => (here ? name : `${path.slice(2)}/${name}`);
  for (const row of rows.slice(0, 2)) append(row, "system");
  const grid = document.createElement("div");
  grid.className = "icon-grid";
  for (const e of entries) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `icon-tile kind-${e.kind}`;
    const picture = e.kind === "picture" ? pictures.find((p) => p.name === e.name) : undefined;
    if (picture) {
      const img = document.createElement("img");
      img.className = "pixel-icon icon-thumb";
      img.src = `images/thumbs/${picture.image}.jpg`;
      img.alt = "";
      b.appendChild(img);
    } else b.appendChild(fileIcon(e.kind));
    const label = document.createElement("span");
    label.className = "icon-name";
    label.textContent = e.name;
    b.appendChild(label);
    b.setAttribute("aria-label", `${e.kind === "folder" ? "Folder" : e.kind === "song" ? "Song" : e.kind === "picture" ? "Picture" : e.kind === "program" ? "Program" : "File"} ${e.name}`);
    const song = songs.find((item) => item.name === e.name);
    if (song) b.dataset.song = song.song;
    b.dataset.cmd = e.kind === "folder" ? `cd ${target(e.name)}` : e.kind === "program" ? `open ${target(e.name)}` : e.kind === "song" ? `play ${target(e.name)}` : `type ${target(e.name)}`;
    grid.appendChild(b);
  }
  log.appendChild(grid);
  for (const row of rows.slice(2).filter((r) => !entries.some((e) => r.endsWith(` ${e.name}`)))) append(row, "system");
  announce(text);
  fitIcons(grid);
  toBottom();
}

/** Icon sizes tried, largest first, before the icons scroll in their own box. */
const ICON_SCALES = [1, 0.85, 0.72, 0.6, 0.5];
let newestGrid                     = null;

/** Shrinks the newest listing's icons until the listing and the prompt fit the glass; else its box scrolls. */
function fitIcons(grid                     = newestGrid)       {
  newestGrid = grid;
  if (!grid || !grid.isConnected) return;
  const lineHeight = parseFloat(getComputedStyle(log).lineHeight) || 33;
  grid.classList.remove("scrolls");
  grid.style.maxHeight = "";
  let fits = 0;
  for (const scale of ICON_SCALES) {
    grid.style.setProperty("--icon-scale", String(scale));
    // Everything of the listing but the icons: the two rows above them, and all below down to the prompt.
    let above = parseFloat(getComputedStyle(screen).paddingTop) + parseFloat(getComputedStyle(grid).marginTop);
    for (let n = grid.previousElementSibling, i = 0; n && i < 2; n = n.previousElementSibling, i++) above += (n               ).offsetHeight;
    const bottom = grid.getBoundingClientRect().bottom - screen.getBoundingClientRect().top + screen.scrollTop;
    const below = screen.scrollHeight - bottom;
    fits = Math.max(lineHeight * 3, screen.clientHeight - above - below);
    if (grid.offsetHeight <= fits) return;
  }
  grid.classList.add("scrolls");
  grid.style.maxHeight = `${Math.floor(fits)}px`;
}
// The glass changes size (the window, the song bar): the newest listing fits again.
new ResizeObserver(() => fitIcons()).observe(screen);

/** Page Up / Page Down (or Shift + arrows): the newest icons scroll if they have to, else the command center does. */
function scrollListing(direction        , page         )       {
  const box = newestGrid?.isConnected && newestGrid.classList.contains("scrolls") ? newestGrid : screen;
  box.scrollTop += direction * (page ? box.clientHeight * 0.85 : 40);
}

/** A `dir` listing, one line per row. A song's row is only "♪ NAME.MP3  ▶", so it fits one line. */
async function showListing(text        , path        , songs            , entries                                           , pictures                                        )                {
  if (prefs.iconView) return showIcons(text, path, songs, entries, pictures);
  const rows = text.split("\n");
  const page = Math.max(4, Math.min(MORE_LINES, linesThatFit() - 1));
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && i % page === 0) await more();
    const div = document.createElement("div");
    div.className = "system";
    const song = songs.find((item) => rows[i].endsWith(` ${item.name}`));
    if (song) div.appendChild(songButton(song));
    else div.textContent = rows[i];
    log.appendChild(div);
    toBottom();
  }
  announce(text);
}

// --- The Archive (Owner, 2026-10-01): every song, photo and document met, kept across attempts ------

function remember(kind                               , path        )       {
  store.archive({ kind, path, level: LEVEL });
}

function showGallery(items                                                      )       {
  const strip = document.createElement("div");
  strip.className = "gallery";
  for (const item of items) {
    const b = document.createElement("button");
    b.className = "thumb";
    b.type = "button";
    const img = document.createElement("img");
    img.src = `images/thumbs/${item.image}.jpg`;
    img.alt = "";
    const label = document.createElement("span");
    label.textContent = item.name;
    b.append(img, label);
    b.dataset.cmd = `type ${item.path.slice(2)}`;
    strip.appendChild(b);
  }
  log.appendChild(strip);
  toBottom();
}

function pageOn()       {
  const b = pager.body;
  if (b.scrollTop + b.clientHeight >= b.scrollHeight - 2) closeFile?.();
  else b.scrollTop += Math.max(1, b.clientHeight - 24);
}

/** What John says, as opposed to what the terminal shows. */
const isChat = (s             ) => (s.op === "type" && (s.style === "john" || s.style === "caine")) || s.op === "pause" || s.op === "dots" || s.op === "unanswered";

/**
 * Plays the steps. `interrupt` (something the player sent, in the command center after the tutorial):
 * John's answer breaks off whatever he is still saying, and the answer's last stretch of talk is left to
 * the chat, so the command line is free again at once while he types it.
 */
async function run(steps               , interrupt = false)                                                        {
  if (interrupt && interruptible()) {
    let from = steps.length;
    while (from > 0 && isChat(steps[from - 1])) from--;
    const talk = steps.slice(from);
    if (talk.some((s) => s.op === "type" || s.op === "unanswered")) {
      const ended = await run(steps.slice(0, from), true);
      if (ended) return ended;
      cutJohn();
      const gen = chatGen;
      for (const s of talk) {
        if (s.op === "type") void chatType(s.text, s.style                    , s.msPerChar, s.style === "john");
        else if (s.op === "pause") void chatTurn(() => chatSleep(s.ms, gen));
        else if (s.op === "unanswered") void unanswered();
      }
      return null;
    }
  }
  let cut = !interrupt;
  for (const s of steps) {
    if (!cut && s.op === "type" && s.style === "john") {
      cut = true;
      cutJohn();
    }
    switch (s.op) {
      case "dots":
        break; // John's pause is drawn with his line in the chat panel.
      case "unanswered":
        await unanswered();
        break;
      case "type":
        if (s.style === "john" || s.style === "caine") await chatType(s.text, s.style, s.msPerChar, s.style === "john");
        else {
          const div = append("", s.style);
          for (const ch of s.text) {
            div.textContent += ch;
            toBottom();
            await sleep(s.msPerChar * prefs.textSpeedFactor);
          }
          announce(s.text);
        }
        break;
      case "print":
        append(s.text, s.style);
        break;
      case "file":
        remember("document", s.path);
        await openFile(s.header, s.title, s.body, s.warning);
        break;
      case "image":
        remember("photo", s.path);
        await openImage(s.name, s.image, s.caption);
        break;
      case "gallery":
        // In the icon view the pictures are already tiles of the listing.
        if (!prefs.iconView) showGallery(s.items);
        break;
      case "listing": {
        for (const item of s.songs) remember("song", item.path);
        const gallery = steps.find((g)                                               => g.op === "gallery");
        await showListing(s.text, s.path, s.songs, s.entries, gallery?.items ?? []);
        break;
      }
      case "song":
        songCommand(s);
        break;
      case "glitch":
        await glitch(s.size, s.ms);
        break;
      case "sound":
        sounds.play(s.name);
        break;
      case "prompt":
        promptEl.textContent = s.text;
        break;
      case "pause":
        await sleep(s.ms);
        break;
      case "clear":
        log.textContent = "";
        break;
      case "tvOff":
        await tvOff();
        break;
      case "tvOn":
        await tvOn();
        break;
      case "ended":
        return s;
    }
  }
  return null;
}

// --- Taps, the choice, and the tutorial's waits ------------------------------------------------------

let tapWaiter                      = null;
function waitForTap()                {
  return new Promise      ((resolve) => {
    tapWaiter = () => {
      tapWaiter = null;
      resolve();
    };
  });
}

/** The opening's reply: a typed line (its text), or a prepared question already asked and answered (null). */
let replyDone                                           = null;
function waitForReply()                         {
  return new Promise               ((resolve) => {
    replyDone = (answer) => {
      replyDone = null;
      lineWaiter = null;
      resolve(answer);
    };
    const listen = () => {
      lineWaiter = (text) => {
        if (text.trim()) replyDone?.(text);
        else listen();
      };
    };
    listen();
  });
}

let lineWaiter                                  = null;
function waitForChoiceLine()                  {
  return new Promise        ((resolve) => {
    lineWaiter = (text) => {
      lineWaiter = null;
      resolve(text);
    };
  });
}

let commandWaiter                                               = null;
function waitForCommand(want        )                {
  return new Promise      ((resolve) => {
    commandWaiter = { want, resolve };
  });
}

// --- The opening (locked, Owner 2026-09-30) ----------------------------------------------------------
// SKIP (Owner, 2026-10-01): a button at the top right while the opening plays (moments 1–5). The
// first time it is greyed out ("Watch the story first."); once the player has watched the whole
// opening, every later opening can be skipped. Skipping lands where the opening ends: the command
// center open, in C:\ARCHIVE, the five folders listed. It never skips chat with John or play.

const skipBtn = $("skip-btn")                     ;
let skipOpening                      = null;
/** The step waiting for a command the tutorial asked for (registered as John starts asking). */
let awaiting                       = null;
/** The command center's opening for this connection, started once (by the opening or by a skip). */
let centerOpening                       = null;

function drawSkip()       {
  const live = skipOpening !== null;
  document.body.classList.toggle("skippable", live);
  const allowed = store.openingSeen(LEVEL);
  skipBtn.setAttribute("aria-disabled", String(!allowed));
  skipBtn.classList.toggle("locked", !allowed);
  skipBtn.dataset.tip = allowed ? "" : "Watch the story first.";
  skipBtn.title = allowed ? "Skip the opening" : "Watch the story first.";
}
skipBtn.addEventListener("click", () => {
  if (paused || !skipOpening || !store.openingSeen(LEVEL)) return;
  skipOpening();
});

/**
 * The command center opens, once per connection: the transition, the prompt, the clocks. `resume`: the
 * timer and play clock carry on from a resume point instead of starting over (CONTINUE).
 */
function enterCommandCenter(resume                                       )                {
  centerOpening ??= (async () => {
    clearLine();
    await openCommandCenterTransition();
    promptEl.textContent = promptFor(session.connectionSnapshot().cwd, false);
    chatPrompt.textContent = "> ";
    line.classList.remove("hidden");
    busy = false;
    armLinger();
    startTimer(resume?.timeLeft);
    startPlayClock(resume?.playMs);
    startAmbient();
    drawPrepared();
    // 10:00 (Final.md): "We have ten minutes. Not much. Let's move." — as the command center opens, in its place
    // in the conversation, before John goes on.
    if (!resume && TIMER_MARKS.has(timeLeft)) await timerEvent(timeLeft);
  })();
  return centerOpening;
}

/** A new connection: a new John, an empty screen, no command history. */
function newConnection()       {
  stopFakeTerminal();
  // A new attempt: the last one's resume point is gone; this one writes its own once play begins.
  if (saveMode === "campaign") store.clearResume();
  session.startConnection();
  attemptStarted();
  newConnectionMoments();
  session.reactionsOn = false; // the tutorial (or the return) speaks for John until it ends
  commandCenterOpen = false;
  centerOpening = null;
  awaiting = null;
  history.length = 0; // a new connection starts with no command history
  historyAt = 0;
  focusOn("command");
  saved.command = { value: "", pos: 0 };
  saved.chat = { value: "", pos: 0 };
  drawLine("chat", "", null);
  clearLine();
  stopTimers();
  chatLog.textContent = "";
  log.textContent = "";
  promptEl.textContent = "";
  chatPrompt.textContent = "";
  document.body.classList.remove("idle");
  setPhase("opening");
  drawPrepared();
}

/** The first attempt: the opening, scripted moments 1–5 (Owner rewrite, 2026-10-01). */
async function playOpening()                {
  newConnection();
  const skipped = new Promise        ((resolve) => {
    skipOpening = () => resolve("skip");
  });
  drawSkip();
  tutorial = "talking";
  let skip = false;
  for (let i = 0; i < openingSteps.length && !skip; i++) {
    skip = (await Promise.race([openingStep(i), skipped])) === "skip";
  }
  skipOpening = null;
  drawSkip();
  if (skip) await finishSkipped();
  else store.markOpeningSeen(LEVEL);
  passedChoice = false;
  inPlay();
}
let passedChoice = false;
/** The opening's tutorial (Stage 1, Moments 5–7): John talking, or waiting for the command he asked for. Linger only while it waits. */
let tutorial                                = "off";
/** A flicker started by a word of the line being typed (John's name), awaited by its own step. */
let wordFlicker                       = null;
/** A numbered choice is on screen: 1 and 2 pick at once. */
let choosing = false;

function inPlay()       {
  tutorial = "off";
  session.reactionsOn = true;
  document.body.classList.add("idle");
  armLinger();
  drawPrepared();
}

/**
 * Every attempt after a reset (Owner, 2026-10-03: "If TRY AGAIN: boot sequence plays. New attempt."):
 * the opening plays again, Stage 1 from the start. SKIP works once it has been watched.
 */
async function playReturn()                {
  await playOpening();
}

async function openingStep(i        )                {
  const step = openingSteps[i];
  const next = openingSteps[i + 1];
  // A skip leaves the running step behind: from then on it must not touch the screen.
  const gen = chatGen;
  const stale = () => gen !== chatGen;
  switch (step.kind) {
    case "say": {
      // Listen for the requested command from the moment John starts asking for it (past the moment's change).
      const ask = openingSteps.slice(i + 1).find((s) => s.kind !== "moment");
      if (ask?.kind === "await" && openingSteps.slice(i + 1, openingSteps.indexOf(ask)).every((s) => s.kind === "moment")) awaiting = waitForCommand(ask.command);
      const slow = step.line.delivery === "slow";
      // A flicker tied to a word of this line fires the moment that word appears (John's name).
      const onWord = next?.kind === "flicker" && next.atWord ? next : null;
      const fire = onWord ? (sofar        ) => {
        if (!wordFlicker && new RegExp(`\\b${onWord.atWord}\\b`).test(sofar)) wordFlicker = glitch(onWord.size ?? "medium", onWord.ms);
      } : undefined;
      await chatType(step.line.text, step.line.speaker === "caine" ? "caine" : "john", slow ? JOHN_SLOW_MS : JOHN_NORMAL_MS, false, fire);
      if (stale()) return;
      if (onWord) break; // the flicker step waits for it to end
      // Before the choice the player taps through; after it, the scene moves on by itself.
      // A flicker marked immediate fires the moment the line is written.
      if (next?.kind === "flicker" && next.immediate) break;
      // Caine's question hangs for a moment, then John's dots start by themselves.
      if (next?.kind === "unanswered") {
        await sleep(600);
        break;
      }
      // The lines flow by themselves (Owner rewrite, 2026-10-01); the script's own pauses space them.
      if (next?.kind !== "pause") await sleep(900);
      break;
    }
    case "reply": {
      // The player answers in the chat: anything at all.
      chatPrompt.textContent = "> ";
      setPhase("choice");
      drawPrepared();
      const answer = await waitForReply();
      if (stale()) return;
      if (answer !== null) chatAppend(answer, "caine");
      chatPrompt.textContent = "";
      setPhase("opening");
      drawPrepared();
      await sleep(700);
      break;
    }
    case "pause":
      document.body.classList.add("cursor-on");
      chatCursor.classList.toggle("still", step.cursor === "still");
      await sleep(step.ms);
      if (stale()) return;
      chatCursor.classList.remove("still");
      document.body.classList.remove("cursor-on");
      break;
    case "unanswered":
      // The cursor blinks, John's dots start and stop, and nothing comes. The player moves on.
      document.body.classList.add("cursor-on");
      await sleep(1200);
      await unanswered();
      if (stale()) return;
      await waitForTap();
      document.body.classList.remove("cursor-on");
      break;
    case "flicker":
      // Fired already by its word, or now: its own size and length, or by strength (Owner sizes, 2026-09-30).
      if (wordFlicker) {
        await wordFlicker;
        wordFlicker = null;
      } else await glitch(step.size ?? (step.strength === "violent" ? "medium" : "small"), step.ms);
      break;
    case "choice": {
      // A numbered choice (Owner, 2026-10-01: "Do you understand?" — 1. YES / 2. NO, no typing). A key
      // 1 or 2, or a click on the line, picks at once. NO: a subtle flicker, then the same prompt.
      const lines = step.text.split("\n");
      const box = chatAppend("", "choice");
      lines.forEach((text, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "choice-option";
        b.textContent = text;
        b.addEventListener("click", () => {
          if (phase === "choice" && choosing && !answering) lineWaiter?.(String(i + 1));
        });
        box.appendChild(b);
      });
      chatPrompt.textContent = "> ";
      choosing = true;
      setPhase("choice");
      drawPrepared();
      let declined = 0;
      let refusal                        = null;
      for (;;) {
        const typed = await waitForChoiceLine();
        if (stale()) return;
        const answer = typed.trim().toLowerCase();
        const option = step.options.find((o) => o.accept.includes(answer));
        if (option?.continues) {
          chatAppend(`> ${lines[step.options.indexOf(option)] ?? typed}`, "caine");
          break;
        }
        if (option) {
          // Refused, with no word: John says nothing. Nothing pressed meanwhile counts.
          choosing = false;
          setPhase("opening");
          drawPrepared();
          await glitch("small");
          const denied = step.denied ? chatAppend(step.denied.text, "denied") : null;
          if (step.denied) await sleep(step.denied.holdMs);
          denied?.remove();
          if (stale()) return;
          // After the third NO, a small line above the prompt, and it stays (Owner, 2026-10-03).
          if (step.refusal && ++declined >= step.refusal.after && !refusal) refusal = chatAppend(step.refusal.text, "denied");
          clearLine();
          choosing = true;
          setPhase("choice");
          drawPrepared();
        }
      }
      choosing = false;
      for (const b of Array.from(box.querySelectorAll("button"))) b.disabled = true;
      chatPrompt.textContent = "";
      passedChoice = true;
      setPhase("opening");
      drawPrepared();
      break;
    }
    case "openCommandCenter":
      // The conversation is over: SKIP leaves with it (Owner, 2026-10-01); the tutorial plays on.
      skipOpening = null;
      drawSkip();
      await enterCommandCenter();
      break;
    case "await":
      tutorial = "waiting";
      armLinger();
      await (awaiting ?? waitForCommand(step.command));
      tutorial = "talking";
      awaiting = null;
      if (step.thenList) await play(present(session.input("dir").outputs, endings));
      break;
    case "moment":
      // The flow's moment moves on: its prepared questions and linger pool (Owner, 2026-10-03).
      session.setMoment(step.moment              );
      drawPrepared();
      break;
  }
}

/**
 * The opening was skipped: whatever step was running stops where it is, and Caine is put where the
 * opening ends, in C:\ARCHIVE with the five folders listed, the commands shown as if typed.
 */
async function finishSkipped()                {
  chatGen++;
  tapWaiter = null;
  lineWaiter = null;
  replyDone = null;
  commandWaiter = null;
  awaiting = null;
  passedChoice = true;
  choosing = false;
  wordFlicker = null;
  document.body.classList.remove("cursor-on");
  chatLog.textContent = "";
  chatPrompt.textContent = "";
  clearLine();
  if (phase === "choice") setPhase("opening");
  busy = true;
  await enterCommandCenter();
  busy = true;
  const archive = `${level.world.root}/ARCHIVE`;
  line.classList.add("hidden");
  for (const command of session.connectionSnapshot().cwd === archive ? ["dir"] : ["cd ARCHIVE", "dir"]) {
    appendEcho(promptEl.textContent ?? "", command);
    const outputs = session.input(command).outputs.filter((o) => o.kind === "cwd" || o.kind === "listing");
    await run(present(outputs, endings));
  }
  line.classList.remove("hidden");
  chatPrompt.textContent = "> ";
  busy = false;
  // Skipped to where the opening ends: inside the archive, Moment 7.
  session.setMoment("s1m7");
  drawPrepared();
  armLinger();
}

async function play(steps               , hideLine = true, interrupt = false)                {
  if (hideLine) line.classList.add("hidden");
  const ended = await run(steps, interrupt);
  if (ended?.how === "level_clear") {
    over = true;
    stopTimers();
    // "The screen fades. Level clear." (Owner, 2026-10-03, Stage 4 Moment 2). John says nothing. The
    // menu follows until Level 2 ships; then the game will go straight on.
    await sleep(2000);
    sounds.stopSong();
    document.body.classList.add("fading");
    await sleep(2500);
    returnReady = true;
    // Automated checks (?speed=N only) read what the screen said across the reload to the menu.
    if (speed > 1) sessionStorage.setItem("caine:lastScreen", Array.from(log.children).map((c) => c.textContent).join("\n"));
    location.reload();
    return;
  }
  if (ended?.how === "reset") {
    stopTimers();
    sounds.stopSong();
    stopFakeTerminal();
    if (ended.trap) {
      await deathSequence();
      return;
    }
    // The connection is gone. Caine wakes at 11:47 PM; a new John begins again. No boot, no opening.
    promptEl.textContent = "";
    commandCenterOpen = false;
    commandWaiter = null;
    chatLog.textContent = "";
    setPhase("opening");
    await run(resetIntro(false, ended.at));
    busy = true;
    await playReturn();
    return;
  }
  line.classList.remove("hidden");
}

async function submit(text        )                {
  appendEcho(promptEl.textContent ?? "", text);
  if (text.trim() && history[history.length - 1] !== text) history.push(text);
  historyAt = history.length;
  busy = true;
  const wasAtTerminal = session.connectionSnapshot().atTerminal;
  const result = session.input(text);
  if (wasAtTerminal && !session.connectionSnapshot().atTerminal) terminalLeftAt = gameNow();
  afterStep();
  if (result.trace.parsed === "command") sounds.play("bip");
  // The fake terminal speaks over a constant flicker while the player keeps the prompt (see below). Its
  // script's own flickers ("Flicker. Flicker. Flicker.") come in their place; John's broken-off line keeps its own.
  const fakeLines             = result.outputs.flatMap((o)             => (o.kind === "speech" && o.speaker === "fake_terminal" ? [o.text]
    : o.kind === "flicker" && o.source.startsWith("fake_terminal_arrival") && o.source !== "fake_terminal_arrival:Terminal opens. The screen flickers once." ? [FLICKER] : []));
  const shown = fakeLines.length > 0 ? result.outputs.filter((o) => !(o.kind === "speech" && o.speaker === "fake_terminal") && !(o.kind === "flicker" && o.source !== "john_cut")) : result.outputs;
  const snap = session.connectionSnapshot();
  if (!snap.atTerminal || snap.ended) stopFakeTerminal();
  await play(present(shown, endings), true, true);
  if (fakeLines.some((l) => l !== FLICKER)) startFakeTerminal(fakeLines);
  busy = false;
  armLinger();
  drawPrepared();
  saveResume();
  if (commandWaiter && text.trim().toLowerCase().replace(/\s+/g, " ") === commandWaiter.want.toLowerCase()) {
    const w = commandWaiter;
    commandWaiter = null;
    w.resolve();
  }
}

// --- The fake terminal (Owner, 2026-10-01): no bursts. While Caine is inside it the glass flickers
// constantly, low; its lines come one by one with pauses; the prompt stays his the whole time. cd ..
// leaves and the flicker stops; EXIT 1147 springs the trap. The engine's arrival flickers are uncounted
// and are drawn as this constant flicker instead.

let fakeGen = 0;
const FAKE_KINDS             = [["slices", "aberration"], ["static"], ["scanlines", "aberration"], ["rollingBar"], ["slices", "static"]];

/** A line of the fake terminal, or one of its script's flickers. */
const FLICKER = Symbol("flicker");
                                        

function startFakeTerminal(lines            )       {
  const gen = ++fakeGen;
  sounds.play("arrival");
  document.documentElement.dataset.fake = "on";
  void (async () => {
    while (gen === fakeGen) {
      const ms = 900 + Math.random() * 800;
      sounds.glitch(ms / 1000 / speed, 0.07);
      const mode = prefs.current.dangerEffects;
      if (mode === "full") await renderGlitch(ms, 0.2 + Math.random() * 0.08, new Set(pick(FAKE_KINDS)), () => gen !== fakeGen);
      else {
        if (mode === "reduced") {
          document.body.style.setProperty("--still", "1.6px");
          document.body.classList.add("still-glitch");
        }
        await sleep(ms);
        document.body.classList.remove("still-glitch");
      }
    }
    document.body.classList.remove("still-glitch");
    delete document.documentElement.dataset.fake;
  })();
  void (async () => {
    await sleep(700);
    for (const text of lines) {
      if (gen !== fakeGen) return;
      if (text === FLICKER) {
        // "Flicker. Flicker. Flicker.": a sharp one over the constant low flicker.
        await glitch("small", 700);
        continue;
      }
      const div = append("", "fake");
      for (const ch of text) {
        if (gen !== fakeGen) return;
        div.textContent += ch;
        toBottom();
        await sleep(28);
      }
      await sleep(1000 + Math.random() * 900);
    }
  })();
}

function stopFakeTerminal()       {
  fakeGen++;
}

// --- The fake terminal's death (Owner, 2026-10-01, rebuilt) ----------------------------------------
// The trap's words have been shown. Then (Owner, 2026-10-06): the screen freezes for 1 s; the virus bomb
// in green, white and black for about 6.5 s (boxes from one, then two, then a flood; taunts big and
// small, never in the same order; the reference symbols popping up one by one, flickering, growing and
// shrinking; figures dancing; bombs bursting); then only "CONNECTION TERMINATED / STATUS: FAILED", 3 s;
// the TV switches off; the choice.

const deathEl = $("death-choice");
/** The bomb's colours: set while the fake terminal's bomb runs. */
let virusGreen = false;
const TRAP_MS = 6500;
const FREEZE_MS = 1000;
const TRAP_HOLD_MS = 3000;
/** A breath of dark after the switch-off, before the choice. */
const TRAP_DARK_MS = 500;

/** The taunts in a new order each time, never the same one twice in a row. */
function* tauntOrder()                    {
  let last = "";
  for (;;) {
    const bag = [...TRAP_TAUNTS].sort(() => Math.random() - 0.5);
    if (bag[0] === last) bag.push(bag.shift() );
    for (const t of bag) yield (last = t);
  }
}

/** One popped-up symbol: a size (small to huge), a place, a way to come and go. */
function popSymbol(kind            , calm         )              {
  const el = symbol(kind);
  const size = [8, 12, 18, 26, 36, 48][Math.floor(Math.random() * 6)];
  el.style.setProperty("--size", `${size}vmin`);
  el.style.left = `${Math.random() * (100 - size * 0.9)}%`;
  el.style.top = `${Math.random() * 82}%`;
  if (!calm) {
    el.classList.add(["sym-grow", "sym-shrink", "sym-flicker", "sym-pulse"][Math.floor(Math.random() * 4)]);
    el.style.animationDuration = `${(700 + Math.random() * 900) / speed}ms`;
  }
  return el;
}

function popTaunt(text        , calm         )              {
  const el = document.createElement("div");
  el.className = `taunt tone-${Math.floor(Math.random() * 3)}${calm ? "" : " taunt-dance"}`;
  el.textContent = text;
  el.style.fontSize = `${[2, 3, 4.5, 7, 11][Math.floor(Math.random() * 5)]}vmin`;
  el.style.left = `${Math.random() * 78}%`;
  el.style.top = `${Math.random() * 88}%`;
  el.style.setProperty("--tilt", `${(Math.random() * 2 - 1) * 8}deg`);
  return el;
}

async function trapBomb()                {
  const calm = prefs.calm;
  virusGreen = true;
  virusEl.textContent = "";
  virusEl.hidden = false;
  virusEl.classList.add("trap");
  document.body.classList.add("terminated");
  sounds.trapBomb(TRAP_MS / 1000 / speed);
  const boxes             = [];
  const total = TRAP_MS / speed;
  const start = gameNow();
  const taunts = tauntOrder();
  let nextBox = 0;
  let nextTaunt = 300 / speed;
  let nextSymbol = 500 / speed;
  let symbolAt = 0;
  let lastDraw = -Infinity;
  for (let now = start; now - start < total; now = gameNow()) {
    const t = now - start;
    const p = t / total;
    // Boxes: one, then two, then more and more at once.
    if (t >= nextBox) {
      const count = t === 0 ? 1 : 1 + Math.floor(p * p * 7);
      for (let k = 0; k < count; k++) {
        const box = virusBox();
        box.text = taunts.next().value;
        virusEl.appendChild(box.el);
        boxes.push(box);
        drawVirusText(box, t / 1000, !calm);
        if (!calm) box.el.animate([{ transform: "scale(0.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 160 / speed, easing: "ease-out" });
      }
      nextBox += (t === 0 ? 650 : 520 - 470 * p) / speed;
    }
    // Taunting words over everything: big, small, overlapping.
    if (t >= nextTaunt) {
      const w = popTaunt(taunts.next().value, calm);
      virusEl.appendChild(w);
      setTimeout(() => w.remove(), (900 + Math.random() * 1400) / speed);
      nextTaunt += (380 - 300 * p) / speed;
    }
    // The symbols: first each one in turn, then any; they come, flicker, grow or shrink, and go.
    if (t >= nextSymbol) {
      const kind = symbolAt < SYMBOLS.length ? SYMBOLS[symbolAt] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      symbolAt++;
      const sym = popSymbol(kind, calm);
      virusEl.appendChild(sym);
      setTimeout(() => sym.remove(), (calm ? 1600 : 700 + Math.random() * 1300) / speed);
      // Sometimes one blots out much of the screen.
      if (!calm && Math.random() < 0.18) sym.style.setProperty("--size", "70vmin");
      nextSymbol += (calm ? 600 : 420 - 300 * p) / speed;
    }
    if (!calm && now - lastDraw > 110 / speed) {
      for (const box of boxes.slice(-60)) drawVirusText(box, (t * speed) / 1000, true);
      lastDraw = now;
    }
    await nextFrame();
  }
}

/** Only one message remains, centred: CONNECTION TERMINATED in white, STATUS: FAILED in red. */
function trapMessage()       {
  virusEl.textContent = "";
  const message = document.createElement("div");
  message.className = "virus-message trap-message";
  message.setAttribute("role", "alert");
  const [headline, status] = TRAP_MESSAGE;
  const a = document.createElement("div");
  a.className = "headline";
  a.textContent = headline;
  const b = document.createElement("div");
  b.className = "failed";
  b.textContent = status;
  message.append(a, b);
  virusEl.appendChild(message);
  announce(TRAP_MESSAGE.join(" "));
}

/**
 * The screen freezes (Owner, 2026-10-06): the command center and John's chat hold their last frame — the
 * text stops, the cursor stops blinking, nothing sounds — and stay so under the error animation until the
 * TV switches off.
 */
let unfreeze                      = null;
function freezeScreen()       {
  chatGen++;
  sounds.stopSong();
  stopAmbient();
  stopTimers();
  const still = document.getAnimations().filter((a) => a.playState === "running");
  for (const a of still) a.pause();
  document.body.classList.add("frozen");
  unfreeze = () => {
    unfreeze = null;
    document.body.classList.remove("frozen");
    for (const a of still) a.cancel();
  };
}

/** The death's screen, the same for every failure: frozen 1 s, the error animation over it, the message held 3 s. */
async function deathScreen()                {
  freezeScreen();
  await sleep(FREEZE_MS);
  await trapBomb();
  trapMessage();
  await sleep(TRAP_HOLD_MS);
}

/**
 * Death (Owner, 2026-10-06, rewritten; every death: the fake terminal, the timer at 0:00, John's name, a
 * capture): the screen freezes for 1 s; the error animation; the terminated message alone, held 3 s; the
 * TV switches off; TRY AGAIN / RETURN TO MAIN MENU. TRY AGAIN stays on screen while the boot plays over
 * it; the menu fades as the boot ends; then the opening.
 */
async function deathSequence()                {
  busy = true;
  await deathScreen();
  // The TV switches off, just before the choice.
  await tvOff();
  unfreeze?.();
  clearVirus();
  virusEl.classList.remove("trap");
  virusGreen = false;
  log.textContent = "";
  chatLog.textContent = "";
  promptEl.textContent = "";
  commandCenterOpen = false;
  commandWaiter = null;
  setPhase("opening");
  await sleep(TRAP_DARK_MS);
  const choice = await deathChoice();
  if (choice === "menu") {
    await sleep(600);
    location.reload();
    return;
  }
  // TRY AGAIN stays; the boot plays over it, and it fades as the boot reaches its end.
  crt.classList.remove("blank");
  sounds.restore();
  document.body.classList.add("reboot");
  const boot = bootSequence();
  await sleep(BOOT_SPAWN_MS);
  deathEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OVERLOAD_MS / speed, fill: "forwards" });
  await boot;
  for (const a of deathEl.getAnimations()) a.cancel();
  deathEl.hidden = true;
  deathEl.classList.remove("chosen");
  document.body.classList.remove("reboot");
  await playReturn();
}

/** TRY AGAIN or RETURN TO MAIN MENU, on the dark glass: arrows and Enter, the keys 1 and 2, or a click. */
let deathPick                                              = null;
function deathChoice()                            {
  const items = Array.from(deathEl.querySelectorAll                   ("button"));
  let at = 0;
  const draw = () => items.forEach((b, i) => b.classList.toggle("is-selected", i === at));
  draw();
  deathEl.hidden = false;
  return new Promise((resolve) => {
    const done = (choice                  ) => {
      deathPick = null;
      // TRY AGAIN stays on screen, chosen, while the boot plays over it.
      if (choice === "retry") {
        at = 0;
        draw();
        deathEl.classList.add("chosen");
      } else deathEl.hidden = true;
      document.removeEventListener("keydown", onKey, true);
      sounds.play("click");
      resolve(choice);
    };
    const onKey = (e               ) => {
      if (paused) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        at = (at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
        sounds.play("tick");
        draw();
      } else if (e.key === "Enter" || e.key === " ") done(items[at].dataset.choice                    );
      else if (e.key === "1" || e.key === "2") done(items[Number(e.key) - 1].dataset.choice                    );
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener("keydown", onKey, true);
    deathPick = done;
  });
}
for (const b of Array.from(deathEl.querySelectorAll                   ("button"))) {
  b.addEventListener("click", () => deathPick?.(b.dataset.choice                    ));
  b.addEventListener("pointerenter", () => {
    for (const o of Array.from(deathEl.querySelectorAll("button"))) o.classList.toggle("is-selected", o === b);
  });
}

/** A question typed in John's chat panel. He answers, or his dots start and stop. */
async function askJohn(text        )                {
  if (!text.trim()) return;
  busy = true;
  drawPrepared();
  // A question sent while John talks breaks him off; the question shows at once.
  cutJohn();
  await chatType(text, "caine", 0, false);
  const result = session.ask(text);
  afterStep();
  await play(present(result.outputs, endings), false, true);
  busy = false;
  drawPrepared();
  saveResume();
}

// --- Prepared questions (Owner, 2026-10-01; Level 1 flow, 2026-10-03) --------------------------------
// Below John's chat input: the questions of the moment the flow is at, as buttons, bright on hover. A
// question has no answer of its own: John answers from the cluster it names. Once asked, it is gone;
// a new moment brings its own. They fade while the player types or John answers, and come back after.
// Shown only in the command center, never at a terminal.

const preparedEl = $("prepared");
const FLOW = level.dialogue.flow;
/** Questions asked, per moment. */
const usedQuestions = new Map                         ();
/** John is answering a Moment 2 question at the YES/NO choice: the choice waits for him. */
let answering = false;

function newConnectionMoments()       {
  usedQuestions.clear();
}

function currentMoment()                    {
  if (!FLOW || over) return null;
  // Moment 2 (Owner, 2026-10-04): John's three questions sit with the first YES/NO, before the command center.
  if (session.moment() === "s1m2") return phase === "choice" ? "s1m2" : null;
  if (!commandCenterOpen) return null;
  const snap = session.connectionSnapshot();
  if (snap.atTerminal || snap.ended) return null;
  return session.moment();
}

function drawPrepared()       {
  // At Moment 2's choice the opening holds `busy`; there only John's answer makes the questions wait.
  const waiting = phase === "choice" ? answering : busy;
  preparedEl.classList.toggle("waiting", waiting);
  preparedEl.classList.toggle("faded", waiting || (phase === "command" && keys.value !== ""));
  const moment = currentMoment();
  const used = (moment && usedQuestions.get(moment)) || new Set        ();
  // Redrawn only when the questions change, so a click is never lost to a redraw.
  const shown = moment ? `${moment}:${[...used].join(",")}` : "";
  if (preparedEl.dataset.shown === shown) return;
  preparedEl.dataset.shown = shown;
  preparedEl.dataset.moment = moment ?? "";
  preparedEl.textContent = "";
  if (!moment || !FLOW) return;
  for (const [i, q] of FLOW.moments[moment].prepared.entries()) {
    if (used.has(i)) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "prepared-q";
    b.textContent = q.text;
    b.addEventListener("click", () => void askPrepared(moment, i));
    preparedEl.appendChild(b);
  }
}

async function askPrepared(moment            , i        )                {
  if (!FLOW || over || paused) return;
  // Moment 2 (Owner, 2026-10-04): asked at the first YES/NO, while the opening holds the command line.
  const atChoice = phase === "choice" && moment === "s1m2";
  if (atChoice ? answering : phase !== "command" || busy) return;
  const q = FLOW.moments[moment].prepared[i];
  if (!usedQuestions.has(moment)) usedQuestions.set(moment, new Set());
  usedQuestions.get(moment) .add(i);
  if (atChoice) answering = true;
  else {
    armLinger();
    busy = true;
  }
  drawPrepared();
  if (!atChoice) cutJohn();
  await chatType(q.text, "caine", 0, false);
  const result = session.askPrepared(q.text, q.cluster);
  afterStep();
  await play(present(result.outputs, endings), !atChoice, !atChoice);
  if (atChoice) answering = false;
  else {
    busy = false;
    armLinger();
  }
  drawPrepared();
  saveResume();
}

// --- Linger (Owner, 2026-10-03): six seconds without typing, John repeats the current instruction ------
// A line from the moment's pool, never the same one twice in a row; every six seconds after, another.
// Typing starts the count again. Game time: a pause stops it.

const LINGER_MS = 6000;
/** Seconds left on the timer below which John no longer repeats (Final.md: "Below 3:00 — linger system off"). */
const LINGER_UNTIL = 180;
let lingerTimer                          ;

async function linger()                {
  lingerTimer = undefined;
  if (over || !commandCenterOpen) return;
  // Final.md, the timer: above 3:00 John repeats; below 3:00 he stops repeating and just watches.
  if (phase === "command" && !busy && chatPending === 0 && tutorial !== "talking" && timeLeft >= LINGER_UNTIL) {
    const result = session.notice("linger");
    // John's repeats go to his panel and never block the command line.
    if (result.outputs.length > 0) await run(present(result.outputs, endings));
  }
  if (!lingerTimer) armLinger();
}
function armLinger()       {
  lingerTimer?.();
  lingerTimer = commandCenterOpen && !over ? after(LINGER_MS, () => void linger()) : undefined;
}
function stopTimers()       {
  lingerTimer?.();
  lingerTimer = undefined;
  clock?.();
  clock = undefined;
  stopAmbient();
}

// --- The connection timer (Owner, 2026-09-30): 10:00 from the moment the command center opens -----

const params = new URLSearchParams(location.search);
/** ?timer=N (seconds) exists for automated checks only, like ?speed. */
const TIMER_SECONDS = speed > 1 && params.get("timer") ? Number(params.get("timer")) : level.dialogue.timer?.seconds ?? 600;
const timerEl = $("timer");
let clock                          ;
let timeLeft = 0;

/** The marks where the timer speaks or glitches (Final.md, THE 10-MINUTE TIMER, Parts 3 and 4). */
const TIMER_MARKS = new Set(Object.keys(FLOW?.timer.marks ?? {}).map(Number).filter((m) => m > 0));

/**
 * Small, dim, top right, below the song bar when one plays (Final.md, Part 3). The colon blinks every second.
 * 10:00–7:00 green; 7:00–4:00 slightly brighter; 4:00–1:00 amber; 1:00–0:00 bright red, blinking.
 */
function drawTimer()       {
  const part = (text        , cls         ) => {
    const span = document.createElement("span");
    span.textContent = text;
    if (cls) span.className = cls;
    return span;
  };
  timerEl.replaceChildren(part(String(Math.floor(timeLeft / 60)).padStart(2, "0")), part(":", "colon"), part(String(timeLeft % 60).padStart(2, "0")));
  const band = timeLeft > 420 ? "green" : timeLeft > 240 ? "bright" : timeLeft > 60 ? "amber" : "red";
  timerEl.dataset.band = band;
  timerEl.classList.toggle("blink", timeLeft % 2 === 1);
}
/** Owner, 2026-10-06: at 7:00, 5:00, 3:00, 1:00 and 0:30 the timer flashes bright red for a second. */
const TIMER_FLASHES = new Set([420, 300, 180, 60, 30]);
let unflash                          ;
function flashTimer()       {
  unflash?.();
  timerEl.classList.add("flash");
  unflash = after(1000, () => timerEl.classList.remove("flash"));
}
/** A soft tick: every minute crossed; every 30 s below 3:00; every 10 s below 1:00 (Final.md, Part 10). */
function timerTick()       {
  if (timeLeft === 0) return;
  if (timeLeft % 60 === 0 || (timeLeft < 180 && timeLeft % 30 === 0) || (timeLeft < 60 && timeLeft % 10 === 0)) sounds.play("tick");
}
function startTimer(from = TIMER_SECONDS)       {
  clock?.();
  timeLeft = from;
  drawTimer();
  const tick = () => {
    if (over) return stopTimers();
    timeLeft = Math.max(0, timeLeft - 1);
    drawTimer();
    timerTick();
    if (TIMER_FLASHES.has(timeLeft)) flashTimer();
    if (timeLeft % 5 === 0) saveResume();
    if (TIMER_MARKS.has(timeLeft)) void timerEvent(timeLeft);
    if (timeLeft === 0) {
      clock = undefined;
      void timerEvent("timeout");
    } else clock = after(1000, tick);
  };
  clock = after(1000, tick);
}
/** A mark plays alongside play (John's line, a glitch); 0:00 waits for the current command, then ends. */
async function timerEvent(kind                    )                {
  if (kind !== "timeout") {
    const r = session.timerMark(kind);
    if (r.outputs.length > 0) await run(present(r.outputs, endings));
    return;
  }
  while (busy || phase === "file" || phase === "image") {
    if (phase === "file") closeFile?.();
    if (phase === "image") closeImage?.();
    await new Promise((r) => setTimeout(r, 50));
  }
  const r = session.notice("timeout");
  afterStep();
  if (r.outputs.length === 0) return;
  busy = true;
  await play(present(r.outputs, endings));
  if (!over && phase === "command") busy = false;
}

// --- Saving (front end, 2026-10-01) -------------------------------------------------------------
// campaign: the story save. replay: a completed level played again; only its records are written,
// never the story. session: storage is unavailable, so nothing is written and nothing claims to be.
// Saves happen after engine steps (attempt start, file reads, attempt ends, a clear), never per letter.

/** This screen plays Level 1. */
const LEVEL = 1;
let saveMode                                    = "session";
let clearRecorded = false;

function persist(change                                      )       {
  if (saveMode === "session") return;
  try {
    store.update(change);
  } catch {
    // A save that fails its own checks is not written; play goes on and the menu reports it.
    store.lastWriteFailed = { ok: false, reason: "unavailable" };
  }
}

function attemptStarted()       {
  clearRecorded = false;
  if (saveMode === "campaign") persist((c, now) => withMemory(withAttempt(c, LEVEL, now), session.exportMemory(), now));
  else persist((c, now) => withAttempt(c, LEVEL, now));
}

/** After every engine step: keep Caine's memory, or record the clear the moment the code is accepted. */
function afterStep()       {
  if (saveMode === "campaign" && session.connectionSnapshot().ended) store.clearResume();
  if (session.connectionSnapshot().ended === "exit_accepted") {
    if (clearRecorded) return;
    clearRecorded = true;
    const ms = activeMs();
    if (saveMode === "campaign") persist((c, now) => withClear(withMemory(c, session.exportMemory(), now), LEVEL, ms, true, now));
    else persist((c, now) => withClear(c, LEVEL, ms, false, now));
  } else if (saveMode === "campaign") persist((c, now) => withMemory(c, session.exportMemory(), now));
}

// Active play time: from the command center opening to the clear, on game time, so time spent
// paused (including a hidden tab, which pauses the game) is left out.
let clockStart = 0;
function startPlayClock(playedMs = 0)       {
  clockStart = gameNow() - playedMs / speed;
}
function activeMs()         {
  return (gameNow() - clockStart) * speed;
}

let returnReady = false;

// --- Resume points (Owner, 2026-10-06) -------------------------------------------------------------
// Written after every command, every line John finishes and every question, while the command center is
// open after the tutorial, and when the player leaves (the menu, the tab, the window). Never while a
// command is still being shown, never at a terminal, never once the connection has ended: CONTINUE then
// goes back to the last point written, or, with none, starts the next attempt as before.

/** The newest lines kept in a resume point, so it stays small. */
const RESUME_LINES = 150;

/** The player is leaving (the menu, the tab, the window): a paused game may be saved then. */
let leaving = false;

function canResumeHere()          {
  if (saveMode !== "campaign" || !gameActive || over || (paused && !leaving) || !commandCenterOpen || tutorial !== "off" || busy) return false;
  const snap = session.connectionSnapshot();
  return snap.ended === null && !snap.atTerminal && phase === "command";
}

// The screen is kept as a plain tree of known elements and attributes, and rebuilt node by node (never
// from markup): text stays text, a picture's source stays one of the game's own images.
                                                                                   
const SAVED_TAGS = new Set(["div", "span", "button", "img", "i", "p", "svg", "rect"]);
const SAVED_ATTRS = new Set(["class", "type", "disabled", "alt", "src", "aria-label", "aria-hidden", "focusable", "viewBox", "shape-rendering",
  "x", "y", "width", "height", "fill", "fill-opacity", "data-cmd", "data-song", "data-title", "data-symbol"]);
const SVG_NS = "http://www.w3.org/2000/svg";

function savedNode(n      )                   {
  if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? "";
  if (!(n instanceof Element) || !SAVED_TAGS.has(n.localName)) return null;
  const a                         = {};
  for (const attr of Array.from(n.attributes)) if (SAVED_ATTRS.has(attr.name)) a[attr.name] = attr.value;
  return { t: n.localName, a, c: Array.from(n.childNodes).map(savedNode).filter((c)                 => c !== null) };
}

function builtNode(d         )              {
  if (typeof d === "string") return document.createTextNode(d);
  if (typeof d !== "object" || d === null) return null;
  const { t, a, c } = d                                             ;
  if (typeof t !== "string" || !SAVED_TAGS.has(t)) return null;
  const el = t === "svg" || t === "rect" ? document.createElementNS(SVG_NS, t) : document.createElement(t);
  for (const [k, v] of Object.entries(typeof a === "object" && a !== null ? a : {})) {
    if (SAVED_ATTRS.has(k) && typeof v === "string" && (k !== "src" || /^images\/[\w./-]+$/.test(v))) el.setAttribute(k, v);
  }
  for (const child of Array.isArray(c) ? c : []) {
    const n = builtNode(child);
    if (n) el.appendChild(n);
  }
  return el;
}

/** The newest lines of a panel, without anything only half there ([MORE], John's dots). */
function keptLines(el             )              {
  return Array.from(el.children).filter((c) => !c.classList.contains("more") && !c.classList.contains("dots")).slice(-RESUME_LINES)
    .map(savedNode).filter((c)                 => c !== null);
}

function restoreLines(el             , lines           )       {
  el.replaceChildren(...lines.map(builtNode).filter((n)            => n !== null));
}

function saveResume()       {
  if (!canResumeHere()) return;
  store.saveResume({
    schema: RESUME_SCHEMA,
    level: LEVEL,
    seed: sessionSeed,
    journal,
    screen: { log: keptLines(log), chat: keptLines(chatLog), prompt: promptEl.textContent ?? "" },
    timeLeft,
    playMs: Math.round(activeMs()),
    history: [...history],
    asked: [...usedQuestions].map(([moment, asked]) => [moment, [...asked]]),
    savedAt: new Date().toISOString(),
  });
}
addEventListener("pagehide", () => {
  leaving = true;
  saveResume();
  leaving = false;
});

/**
 * CONTINUE with a resume point: the screen is dark, then John, full screen as in the opening ("Caine! You
 * are back!"); the command center opens as it was left (John's panel, the commands and what they showed,
 * the prompt, the timer), and John goes on: "We don't have much time, let's hurry."
 */
async function resumeAt(point             )                {
  session = journaled(replayed(point));
  sessionSeed = point.seed;
  journal = point.journal.slice();
  history.splice(0, history.length, ...point.history);
  historyAt = history.length;
  usedQuestions.clear();
  for (const [moment, asked] of point.asked) usedQuestions.set(moment              , new Set(asked));
  passedChoice = true;
  busy = true;
  setPhase("opening");
  const scene = FLOW?.resume;
  await sleep(1500);
  for (const text of scene?.lines ?? []) {
    await chatType(text, "john", text === "..." ? JOHN_SLOW_MS : JOHN_NORMAL_MS, false);
    await sleep(900);
  }
  restoreLines(chatLog, point.screen.chat);
  restoreLines(log, point.screen.log);
  drawSongBar();
  await enterCommandCenter({ timeLeft: point.timeLeft, playMs: point.playMs });
  fitIcons(Array.from(log.querySelectorAll             (".icon-grid")).at(-1) ?? null);
  toBottom();
  inPlay();
  if (scene?.after) await chatType(scene.after, "john", JOHN_NORMAL_MS, true);
  saveResume();
}

// --- Input: two DOS-style lines sharing one hidden text box -------------------------------------

                                 
let focus         = "command";
const saved                                                 = { command: { value: "", pos: 0 }, chat: { value: "", pos: 0 } };
const history           = [];
let historyAt = 0;

/** Which line the keys edit now: the chat during the choice, the focused line in the command center. */
function target()                {
  if (phase === "choice") return "chat";
  return phase === "command" ? focus : null;
}

/** Draws one line; `pos` places the cursor (null: no cursor, e.g. the unfocused line). */
function drawLine(t        , value        , pos               )       {
  const [before, cur, after] = t === "command" ? [typedEl, cursorEl, typedAfter] : [chatTyped, chatCursor, chatAfter];
  const at = pos ?? value.length;
  const inside = pos !== null && at < value.length;
  before.textContent = value.slice(0, at);
  // Amber mode: the line turns amber once it reads as a command.
  if (t === "command") line.classList.toggle("is-command", COMMAND_WORDS.test(value));
  cur.textContent = inside ? value[at] : "\u2588";
  cur.classList.toggle("on-char", inside);
  after.textContent = inside ? value.slice(at + 1) : "";
}

function render()       {
  const t = target();
  if (!t) return;
  drawLine(t, keys.value, keys.selectionStart ?? keys.value.length);
  if (t === "command") toBottom();
  else chatScroll();
}

function setValue(value        )       {
  keys.value = value;
  keys.setSelectionRange(value.length, value.length);
  render();
}

function clearLine()       {
  setValue("");
}

/** Tab or a click moves between the command center and John's chat; each keeps its half-typed line. */
function focusOn(t        )       {
  if (focus === t) return;
  saved[focus] = { value: keys.value, pos: keys.selectionStart ?? keys.value.length };
  drawLine(focus, saved[focus].value, null);
  focus = t;
  keys.value = saved[t].value;
  keys.setSelectionRange(saved[t].pos, saved[t].pos);
  document.body.classList.toggle("chat-focus", t === "chat");
  render();
}

/** Up and down walk the command history, as in DOS; past the newest entry the line is empty. */
function recall(step        )       {
  if (history.length === 0) return;
  historyAt = Math.max(0, Math.min(history.length, historyAt + step));
  setValue(history[historyAt] ?? "");
}

function tapOrKey()       {
  if (phase === "opening") tapWaiter?.();
  else if (phase === "file") pageOn();
  else if (phase === "image") closeImage?.();
}

keys.addEventListener("input", () => {
  if (target()) render();
  else keys.value = "";
  drawPrepared();
});
keys.addEventListener("keyup", () => render());
keys.addEventListener("keydown", (e) => {
  if (!gameActive || paused) return;
  if (returnReady) {
    // The level is over: Enter (or a tap) goes back to the menu, which reads the fresh save.
    e.preventDefault();
    if (e.key === "Enter" || e.key === "Escape") location.reload();
    return;
  }
  if (phase === "waiting" || phase === "boot") {
    e.preventDefault();
    return;
  }
  if (phase === "opening") {
    // No typing during the opening; a key advances like a tap once the line has finished.
    e.preventDefault();
    tapOrKey();
    return;
  }
  // Esc pauses (below); q closes a picture or a file.
  if (phase === "image") {
    e.preventDefault();
    if (["q", "Q", "Enter", " "].includes(e.key)) closeImage?.();
    else if (e.key === "+" || e.key === "=") zoomBy(1);
    else if (e.key === "-" || e.key === "_") zoomBy(-1);
    else if (e.key === "ArrowLeft") panBy(-1, 0);
    else if (e.key === "ArrowRight") panBy(1, 0);
    else if (e.key === "ArrowUp") panBy(0, -1);
    else if (e.key === "ArrowDown") panBy(0, 1);
    return;
  }
  if (phase === "file") {
    e.preventDefault();
    if (e.key === "q" || e.key === "Q") closeFile?.();
    else if (e.key === " " || e.key === "Enter" || e.key === "PageDown") pageOn();
    return;
  }
  // A numbered choice: 1 or 2 picks at once; nothing is typed.
  if (phase === "choice" && choosing) {
    e.preventDefault();
    if (answering) return;
    if (/^[1-9]$/.test(e.key)) {
      sounds.play("key");
      lineWaiter?.(e.key);
    }
    return;
  }
  // [MORE] under a long listing: any key shows the next page.
  if (moreWaiter) {
    e.preventDefault();
    moreWaiter();
    return;
  }
  armLinger();
  const t = target() ;
  // A folder taller than the glass (Owner, 2026-10-06): Page Up / Page Down, or Shift with an arrow.
  if (e.key === "PageUp" || e.key === "PageDown" || (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown"))) {
    e.preventDefault();
    if (phase === "command") scrollListing(e.key === "PageUp" || e.key === "ArrowUp" ? -1 : 1, e.key.startsWith("Page"));
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    if (phase === "command") focusOn(focus === "command" ? "chat" : "command");
    return;
  }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    if (t === "command") recall(e.key === "ArrowUp" ? -1 : 1);
    return;
  }
  if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete" || e.key === "Enter") sounds.play("key");
  // Left, right, Home, End, Backspace and Delete edit the hidden box; the line is redrawn after.
  if (e.key !== "Enter") {
    setTimeout(render, 0);
    return;
  }
  e.preventDefault();
  const text = keys.value;
  if (phase === "choice") {
    if (!lineWaiter || choosing) return;
    clearLine();
    lineWaiter(text);
    return;
  }
  if (busy || over) return;
  clearLine();
  if (t === "chat") void askJohn(text);
  else void submit(text);
});
document.addEventListener("pointerdown", (e) => {
  if (!gameActive || paused || (e.target           ).closest?.("#pause-btn, #skip-btn")) return;
  if (returnReady) {
    location.reload();
    return;
  }
  if (moreWaiter) {
    moreWaiter();
    return;
  }
  keys.focus();
  // A button (a question, a song) is pressed, not typed into: the focused line stays as it is.
  if (phase === "command" && !(e.target           ).closest?.("button")) {
    const on = e.target        ;
    if ($("chat").contains(on)) focusOn("chat");
    else if (screen.contains(on)) focusOn("command");
  }
  tapOrKey();
});
// A click would otherwise move focus off the hidden input and swallow the next keystroke.
document.addEventListener("mousedown", (e) => {
  if (gameActive && !paused) e.preventDefault();
});
document.addEventListener("pointerup", () => {
  if (gameActive && !paused) keys.focus();
});
document.addEventListener("keydown", (e) => {
  if (gameActive && !paused && document.activeElement !== keys && !e.metaKey && !e.ctrlKey) keys.focus();
});

// --- Pause (Owner, 2026-10-01) -------------------------------------------------------------------
// Esc, the on-screen button, or leaving the tab pauses. Paused, the game clock stops: no wait, timer,
// glitch, animation or sound advances, no input reaches the engine, so no flicker can be counted.
// Esc again (or RESUME) carries on exactly where it stopped.

const pauseBtn = $("pause-btn")                     ;
let frozen              = [];

function canPause()          {
  return gameActive && !paused && !returnReady;
}

function pauseGame()       {
  if (!canPause()) return;
  paused = true;
  pausedAt = performance.now();
  frozen = document.getAnimations().filter((a) => a.playState === "running");
  for (const a of frozen) a.pause();
  sounds.setPaused(true);
  document.body.classList.add("paused");
  menu.showPause({
    resume: resumeGame,
    save: saveNow,
    leaveText,
    leave: leaveToMenu,
  });
}

function resumeGame()       {
  if (!paused) return;
  pausedTotal += performance.now() - pausedAt;
  paused = false;
  for (const a of frozen.splice(0)) a.play();
  sounds.setPaused(false);
  document.body.classList.remove("paused");
  for (const wake of resumeWaiters.splice(0)) wake();
  keys.focus();
}

/**
 * SAVE GAME. Progress already saves itself as you play; this writes it again and says what a save
 * holds: in the command center CONTINUE picks up where the player is (Owner, 2026-10-06); elsewhere (the
 * opening, a terminal) at the start of the next attempt.
 */
function saveNow()                                {
  if (saveMode === "replay") return { ok: false, text: "Replays are not saved. Your story save is unchanged." };
  if (saveMode === "session") return { ok: false, text: "This browser isn't letting the game save." };
  store.lastWriteFailed = null;
  persist((c, now) => withMemory(c, session.exportMemory(), now));
  const here = resumable();
  if (here) saveResumeLeaving();
  return store.canSave
    ? { ok: true, text: here ? "Saved.\nCONTINUE picks up where you left off." : "Saved.\nCONTINUE picks up at the start of your next attempt." }
    : { ok: false, text: "Could not save. This browser isn't letting the game save." };
}

/** Paused in the command center: the attempt can be left and come back to. */
function resumable()          {
  leaving = true;
  const ok = canResumeHere();
  leaving = false;
  return ok;
}
function saveResumeLeaving()       {
  leaving = true;
  saveResume();
  leaving = false;
}

function leaveText()                                  {
  if (saveMode === "replay") return { title: "Leave this replay?", text: "Your story save is not affected." };
  if (saveMode === "session" || !store.canSave) return { title: "Leave without saving?", text: "This browser isn't letting the game save, so leaving now loses your progress." };
  if (resumable()) return { title: "Leave for the menu?", text: "Your story is saved. CONTINUE picks up where you left off." };
  return { title: "Leave this attempt?", text: "Your story is saved. This attempt ends here, and CONTINUE starts the next one." };
}

/**
 * EXIT TO MAIN MENU: in the command center the attempt is kept where it stands (CONTINUE resumes it);
 * anywhere else it ends as a voluntary exit (saved), as before. The page reopens on the menu.
 */
function leaveToMenu()       {
  sounds.stopSong();
  if (resumable()) {
    saveResumeLeaving();
    location.reload();
    return;
  }
  if (saveMode === "campaign" && session.connectionSnapshot().ended === null) {
    session.endConnection("voluntary_exit");
    afterStep();
  }
  location.reload();
}

document.addEventListener("keydown", (e) => {
  // Paused, the pause menu has Esc (resume, or back out of Settings).
  if (e.key !== "Escape" || !canPause()) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  // A picture closes with Esc too (Owner, 2026-10-06); Esc again pauses.
  if (phase === "image") closeImage?.();
  else pauseGame();
}, true);
pauseBtn.addEventListener("click", () => pauseGame());
document.addEventListener("visibilitychange", () => {
  sounds.setHidden(document.hidden);
  if (document.hidden) saveResumeLeaving();
  // Leaving the tab pauses the game, so the timer never runs out unseen.
  if (document.hidden) pauseGame();
});

// --- Starting from the menu ----------------------------------------------------------------------

/** The menu owns the page until the game starts; then the game's keys and taps take over. */
let gameActive = false;

/**
 * new and replay: the established opening, boot first. continue: the next attempt of a saved story,
 * entered the way every attempt after a reset is (the 11:47 PM card, then the new John), with Caine's
 * memory restored. An attempt left open when the page closed is recorded as a voluntary exit first.
 */
async function begin(how                               , campaign           )                {
  if (gameActive) return;
  gameActive = true;
  document.body.classList.add("playing");
  sounds.start();
  keys.focus();
  log.textContent = "";
  const point = how === "continue" ? store.loadResume() : null;
  if (point?.level === LEVEL) {
    try {
      await resumeAt(point);
      return;
    } catch {
      // The save no longer fits the game: CONTINUE starts the next attempt instead.
      store.clearResume();
      location.reload();
      return;
    }
  }
  if (how === "continue" && campaign) {
    session.restoreMemory(memoryForResume(campaign));
    persist((c, now) => withMemory(c, memoryForResume(c), now));
    setPhase("opening");
    busy = true;
    await run(resetIntro());
    await playReturn();
    return;
  }
  await bootSequence();
  await playOpening();
}

const menu = new Menu({
  store, prefs, sounds,
  newGame(persisted) {
    saveMode = persisted ? "campaign" : "session";
    void begin("new");
  },
  continueGame(campaign) {
    saveMode = "campaign";
    void begin("continue", campaign);
  },
  replay(level) {
    // Checked here too, so no path can launch a level the catalogue would not.
    const progress = progressOf(store.load());
    if (level !== LEVEL || !LEVELS[level - 1]?.implemented || levelStatus(level, progress) !== "completed" || !canLaunch(level, progress)) {
      menu.show();
      return;
    }
    saveMode = "replay";
    void begin("replay");
  },
  archiveEntry(path) {
    const node = level.world.nodes[path];
    if (node?.type !== "file") return null;
    const folder = path.slice(0, path.lastIndexOf("/")).replace(/\//g, "\\");
    return {
      name: path.slice(path.lastIndexOf("/") + 1),
      folder: /^[A-Z]:$/.test(folder) ? folder + "\\" : folder,
      text: node.content.replace(/\n$/, ""),
      ...(node.image ? { image: node.image } : {}),
      ...(node.song ? { song: { id: node.song, title: node.content.trim() } } : {}),
    };
  },
});

// Automated checks (?speed=N only) can read state; players never see this.
if (speed > 1) Object.assign(globalThis, { __inPlay: () => session.reactionsOn && commandCenterOpen, __moment: () => preparedEl.dataset.moment, __audioRunning: () => sounds.running, __mode: () => phase, __busy: () => busy, __talking: () => chatPending > 0, __typing: () => typing !== null, __focus: () => focus, __history: () => history.length, __glitch: glitch, __music: () => sounds.musicState, __paused: () => paused, __timer: () => timeLeft, __terminate: deathScreen, __tvOff: tvOff, __song: () => sounds.songState });

// The page opens on the menu. Audio starts with the first key or tap there.
drawBarrelMap();
startNoise();
setPhase("waiting");
menu.show();
