// The front end: main menu, level catalogue, settings, controls, about and privacy, drawn on the same
// green glass as the game but outside the story. It never reveals story content. Menu state lives
// here; story state stays in the engine and the save. Nothing here advances the story, counts an
// attempt or touches danger: only NEW GAME, CONTINUE and a level's launch hand over to the game.
// Every control is a real button, link or dialog; text is set with textContent only.

import { LEVELS, LEVEL_COUNT, canLaunch, levelNumber, levelStatus } from "./levels.js";
                                                    
import { isResumable, progressOf } from "./save.js";
                                                                      
import { SETTING_GROUPS, SETTING_VALUES } from "./settings.js";
                                                               
                                        
                                         
import { fileIcon, glyph } from "./icons.js";
                                        
import { hasNewInLevel } from "./archive.js";
                                                                  

                           
                   
               
                 
                                                                                             
                                  
                                         
                                                                 
                              
                                                                                                       
                                                  
 

                               
               
                 
               
                 
                                       
 

/** What the pause menu asks of the game (Owner, 2026-10-01). */
                            
                 
                                        
                                               
                
 

                                         
                                                                                                                              
const GROUP_TITLE                        = { audio: "AUDIO", display: "DISPLAY", accessibility: "ACCESSIBILITY" };
const TITLE = "PROJECT C.A.I.N.E.";

const GITHUB = "https://github.com/sarva-uttam";
/** Which setting holds each Archive category's view (Settings > Display). */
const VIEW_KEY                                                                         = { song: "archiveSongs", photo: "archiveImages", document: "archiveTexts" };
const PAGE = 10;
const PAGES = Math.ceil(LEVEL_COUNT / PAGE);
const SHIPPED = LEVELS.filter((l) => l.implemented).length;

/** A campaign that holds something a new game would erase. */
function hasProgress(c          )          {
  return c.memory.connections.length > 0 || c.completed.length > 0 || Object.keys(c.records).length > 0;
}

function h                                       (tag   , props                                  = {}, ...children                      )                           {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === "text") el.textContent = v;
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

function formatTime(ms        )         {
  const s = Math.round(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

const STATUS_WORD                              = { available: "AVAILABLE", completed: "COMPLETED", locked: "LOCKED", unavailable: "UNAVAILABLE" };

const SETTING_TEXT                                                                                       = {
  sound: { label: "SOUND", values: { on: "ON", off: "OFF" }, help: "Every sound in the game. Off is silence." },
  music: { label: "MUSIC", values: { on: "ON", off: "OFF" }, help: "The background sound that plays under the menu and the game." },
  ambientVolume: { label: "AMBIENT VOLUME", values: { low: "LOW", medium: "MEDIUM", high: "HIGH" }, help: "How loud the background sound is." },
  effectsVolume: { label: "EFFECTS VOLUME", values: { low: "LOW", medium: "MEDIUM", high: "HIGH" }, help: "Typing, glitches and every other sound effect." },
  curvature: { label: "SCREEN CURVATURE", values: { on: "ON", off: "OFF" }, help: "The curve of the old glass. Off draws the text flat." },
  viewMode: { label: "VIEW MODE", values: { terminal: "TERMINAL", icons: "ICONS" }, help: "How dir shows a folder: a text listing, or icons. The same folders and files either way." },
  archiveSongs: { label: "ARCHIVE VIEW: SONGS", values: { list: "LIST", grid: "GRID" } },
  archiveImages: { label: "ARCHIVE VIEW: IMAGES", values: { list: "LIST", grid: "GRID" } },
  archiveTexts: { label: "ARCHIVE VIEW: TEXTS", values: { list: "LIST", grid: "GRID" } },
  textSize: { label: "TEXT SIZE", values: { small: "SMALL", medium: "MEDIUM", large: "LARGE" } },
  textSpeed: { label: "TEXT SPEED", values: { slow: "SLOW", normal: "NORMAL", fast: "FAST" }, help: "How fast lines type out in the story. Timers are not affected." },
  dangerEffects: {
    label: "DANGER EFFECTS", values: { full: "FULL", reduced: "REDUCED", off: "OFF" },
    help: "How danger looks during play. Full includes flashing and shaking. Reduced has no flashing. Off shows a short text notice instead. Unless this is Full, the start-up sequence does not flash either. What happens in the story stays the same.",
  },
  palette: { label: "TERMINAL PALETTE", values: { green: "DEFAULT GREEN", "soft-green": "SOFT GREEN", "soft-blue": "SOFT BLUE", "soft-amber": "SOFT AMBER" }, help: "The colours of the terminal text." },
  commandColor: { label: "COMMAND COLOR", values: { green: "GREEN", amber: "AMBER (P3 PHOSPHOR)" }, help: "Amber shows the commands John gives you in his chat, so you see what to type. Everything else stays green." },
  reduceMotion: { label: "REDUCE MOTION", values: { on: "ON", off: "OFF" }, help: "Stops nonessential movement, blinking and animated static." },
};

export class Menu {
          host          ;
          root = document.getElementById("menu") ;
          body = document.getElementById("menu-body") ;
          titleEl = document.getElementById("menu-title") ;
          noticeEl = document.getElementById("menu-notice") ;
          dialog = document.getElementById("confirm")                     ;
          screen         = "main";
          load             = { kind: "empty" };
          launching = false;
          visible = false;
  /** Where to put focus when coming back to the main menu or the catalogue. */
          mainFocus                = null;
          levelsPage = 0;
          levelsFocus = 1;
  /** main: the front end. pause: over a paused game. */
          context                   = "main";
          pauseHost                   = null;
  /** Which settings page to select when coming back to SETTINGS. */
          settingsFocus                = null;
  /** The Archive entry being viewed, and the row to return to. */
          archivePath                = null;
  /** The Archive: the level opened (none until the player opens one), its page and tab, its songs. */
          archiveLevel                = null;
          archivePage = 0;
          archiveTab              = "song";
          archivePlaylist                                       = [];
  /** A user key or pointer event just happened: the next focus move may click. */
          armed = false;

  constructor(host          ) {
    this.host = host;
    // The now-playing bar's ⏮ / ⏭ step through the opened level's songs; its buttons follow the song.
    document.getElementById("song-prev") .addEventListener("click", () => this.stepSong(-1));
    document.getElementById("song-next") .addEventListener("click", () => this.stepSong(1));
    document.addEventListener("caine:song", () => {
      if (this.visible && this.screen === "archive") this.drawArchiveSongs();
    });
    document.addEventListener("keydown", (e) => this.onKey(e));
    // The first key or tap is the browser's permission for sound.
    const wake = () => {
      if (!this.visible) return;
      this.armed = true;
      if (this.host.prefs.current.sound === "on") this.host.sounds.start();
    };
    document.addEventListener("keydown", wake, true);
    document.addEventListener("pointerdown", wake, true);
    this.root.addEventListener("focusin", (e) => {
      if (this.armed && (e.target               ).matches("button, a")) this.host.sounds.play("tick");
      this.armed = false;
    });
    // Moving the mouse over a row selects it, like the keyboard does (touch selects on tap). Only
    // real movement counts: a row that appears under a resting pointer must not steal the selection.
    let lastX = NaN;
    let lastY = NaN;
    this.root.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || (e.clientX === lastX && e.clientY === lastY)) return;
      lastX = e.clientX;
      lastY = e.clientY;
      const t = (e.target               ).closest             ("[data-nav]");
      if (t && t !== document.activeElement && !this.dialog.open) {
        this.armed = true;
        t.focus({ preventScroll: true });
      }
    });
  }

  show()       {
    this.context = "main";
    this.load = this.host.store.load();
    this.visible = true;
    this.launching = false;
    this.root.inert = false;
    this.root.hidden = false;
    document.body.classList.add("menu-open");
    this.go("main");
  }

  /** The pause menu, over the paused game (which stays visible, dimmed, behind it). */
  showPause(host           )       {
    this.context = "pause";
    this.pauseHost = host;
    this.visible = true;
    this.launching = false;
    this.root.inert = false;
    this.root.hidden = false;
    document.body.classList.add("pause-open");
    this.go("pause");
  }

          hide()       {
    this.visible = false;
    this.root.inert = true;
    this.root.hidden = true;
    document.body.classList.remove("menu-open", "pause-open");
  }

          get campaign()                  {
    return this.load.kind === "ok" ? this.load.campaign : null;
  }

          get resumable()                  {
    const c = this.campaign;
    return c && hasProgress(c) && isResumable(c, (id) => LEVELS[id - 1]?.implemented ?? false) ? c : null;
  }

  // ---------------------------------------------------------------- navigation

          go(screen        , focus         )       {
    this.screen = screen;
    // The now-playing bar may sit in the Archive's right panel: put it back on the glass before clearing.
    const bar = document.getElementById("song-bar") ;
    if (this.body.contains(bar)) document.getElementById("crt") .appendChild(bar);
    this.body.textContent = "";
    this.body.scrollTop = 0;
    // A song replayed from the Archive stops when the player leaves the Archive. (Over a paused game the
    // menu never touches the game's song: it waits with the game.)
    if (this.context === "main" && screen !== "archive" && screen !== "archiveItem") this.host.sounds.stopSong();
    this.drawTitle();
    this.notice(null);
    this.root.dataset.screen = screen;
    // In the Archive the now-playing bar shows at the top right, with ⏮ and ⏭.
    const inArchive = this.context === "main" && (screen === "archive" || screen === "archiveItem");
    document.body.classList.toggle("archive-open", inArchive);
    for (const id of ["song-prev", "song-next"]) document.getElementById(id) .hidden = !inArchive;
    const target = {
      main: () => this.renderMain(),
      pause: () => this.renderPause(),
      levels: () => this.renderLevels(),
      archive: () => this.renderArchive(),
      archiveItem: () => this.renderArchiveItem(),
      settings: () => this.renderSettings(),
      audio: () => this.renderGroup("audio"),
      display: () => this.renderGroup("display"),
      accessibility: () => this.renderGroup("accessibility"),
      controls: () => this.renderControls(),
      about: () => this.renderAbout(),
      privacy: () => this.renderPrivacy(),
    }[screen]();
    const el = (focus && this.body.querySelector             (`[data-id="${focus}"]`)) || target;
    el?.focus({ preventScroll: false });
  }

  /** Up one level: a settings page to SETTINGS, SETTINGS to the menu it came from, the rest to the main menu. */
          back()       {
    const s = this.screen;
    if (s === "main") return;
    if (s === "pause") {
      this.resume();
      return;
    }
    if (s === "audio" || s === "display" || s === "accessibility" || s === "controls") this.go("settings", this.settingsFocus ?? undefined);
    else if (s === "archiveItem") this.go("archive", this.archivePath ? `item:${this.archivePath}` : undefined);
    else if (s === "settings" && this.context === "pause") this.go("pause", "settings");
    else this.go("main", this.mainFocus ?? undefined);
  }

          resume()       {
    const host = this.pauseHost;
    this.hide();
    host?.resume();
  }

          navItems()                {
    const scope = this.dialog.open ? this.dialog : this.body;
    return Array.from(scope.querySelectorAll             ("[data-nav]")).filter((el) => el.offsetParent !== null);
  }

          move(step        )       {
    const items = this.navItems();
    if (items.length === 0) return;
    const at = items.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
    // In a settings row every option counts as the row.
    const row = (document.activeElement                      )?.closest(".setting");
    const current = at >= 0 ? at : row ? items.findIndex((el) => row.contains(el)) : -1;
    const next = current < 0 ? (step > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, current + step));
    this.armed = true;
    items[next].focus();
  }

          onKey(e               )       {
    if (!this.visible || this.launching || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target               ;
    if (t.closest?.("input, textarea, select, [contenteditable='true']")) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        this.move(e.key === "ArrowDown" ? 1 : -1);
        return;
      case "Home":
      case "End":
        if (this.dialog.open) return;
        e.preventDefault();
        this.move(e.key === "Home" ? -LEVEL_COUNT : LEVEL_COUNT);
        return;
      case "ArrowLeft":
      case "ArrowRight": {
        const row = t.closest             (".setting");
        if (row) {
          e.preventDefault();
          this.stepSetting(row, e.key === "ArrowRight" ? 1 : -1);
        } else if (this.dialog.open) {
          e.preventDefault();
          this.move(e.key === "ArrowRight" ? 1 : -1);
        }
        return;
      }
      case "PageDown":
      case "PageUp":
        if (this.screen === "levels" && !this.dialog.open) {
          e.preventDefault();
          this.turnPage(e.key === "PageDown" ? 1 : -1);
        }
        return;
      case "Escape":
        // An open dialog handles Escape itself, as a cancel.
        if (this.dialog.open) return;
        e.preventDefault();
        this.back();
        return;
      case "q":
      case "Q":
        // Final.md, the Archive: a document or picture closes with Escape or q.
        if (this.screen !== "archiveItem" || this.dialog.open) return;
        e.preventDefault();
        this.back();
        return;
    }
  }

  // ---------------------------------------------------------------- building blocks

          button(label        , id        , run            , extra                         = {})                    {
    const b = h("button", { type: "button", class: "menu-item", "data-nav": "", "data-id": id, ...extra }, h("span", { class: "marker", "aria-hidden": "true", text: ">" }), h("span", { class: "label", text: label }));
    b.addEventListener("click", () => {
      if (this.launching) return;
      run();
    });
    return b;
  }

          header(title        )                    {
    const back = this.button("BACK", "back", () => this.back(), { "aria-label": "Back to the main menu", class: "menu-item menu-back" });
    this.body.append(h("div", { class: "screen-head" }, back, h("h2", { text: title })));
    return back;
  }

          notice(text               )       {
    this.noticeEl.textContent = text ?? "";
    this.noticeEl.hidden = !text;
    this.noticeEl.classList.remove("bad");
  }

  // ---------------------------------------------------------------- main

          renderMain()              {
    const c = this.campaign;
    const resumable = this.resumable;
    const list = h("ul", { class: "menu-list" });
    const add = (label        , id        , run            ) => list.append(h("li", {}, this.button(label, id, () => {
      this.mainFocus = id;
      run();
    })));
    add("NEW GAME", "new", () => this.requestNewGame());
    if (resumable) add("CONTINUE", "continue", () => this.launch(() => this.host.continueGame(resumable)));
    add("LEVELS", "levels", () => this.go("levels"));
    add("ARCHIVE", "archive", () => this.go("archive"));
    add("SETTINGS", "settings", () => this.go("settings"));
    add("ABOUT", "about", () => this.go("about"));
    add("PRIVACY", "privacy", () => this.go("privacy"));
    // No QUIT: a web page has no real way to exit, and closing the tab is the player's own control.
    this.body.append(h("nav", { "aria-label": "Main menu" }, list));

    const store = this.host.store;
    const lines           = [];
    if (this.load.kind === "corrupt") lines.push("Your saved progress could not be read. It has been left as it is. Starting a new game will replace it.");
    else if (this.load.kind === "unsupported") lines.push("Your saved progress comes from a newer version of the game and can't be opened here. It has been left as it is.");
    if (!store.canSave) lines.push("This browser isn't letting the game save. You can still play, but progress will be lost when you close the page.");
    this.notice(lines.join("\n") || null);
    const first = (this.mainFocus && list.querySelector             (`[data-id="${this.mainFocus}"]`)) || list.querySelector             (resumable ? '[data-id="continue"]' : '[data-id="new"]');
    return first ;
  }

  /**
   * The title (Owner, 2026-10-01): on the main menu it dominates the screen, PROJECT above a huge
   * C.A.I.N.E; elsewhere it is smaller. Paused, it reads PAUSED. Drawn without the closing dot (Owner,
   * 2026-10-01: "The title is complete without it"); screen readers still hear the full name.
   */
          drawTitle()       {
    const t = this.titleEl;
    t.textContent = "";
    if (this.context === "pause") {
      t.removeAttribute("aria-label");
      t.textContent = "PAUSED";
      return;
    }
    t.setAttribute("aria-label", TITLE);
    t.append(h("span", { class: "title-project", "aria-hidden": "true", text: "PROJECT" }), h("span", { class: "title-caine", "aria-hidden": "true", text: "C.A.I.N.E" }));
  }

          launch(start            )       {
    if (this.launching) return;
    this.launching = true;
    this.host.sounds.stopSong();
    this.host.sounds.play("click");
    this.hide();
    start();
  }

  /** NEW GAME: straight into the opening if there is nothing to lose; otherwise ask first. */
          async requestNewGame()                {
    const c = this.campaign;
    const kind = this.load.kind;
    const opener = document.activeElement                      ;
    if (kind === "corrupt" || kind === "unsupported" || (c && hasProgress(c))) {
      const ok = await this.confirm(
        "Start a new game?",
        kind === "ok"
          ? "This will erase your saved story progress, level unlocks and level records. Your settings will be kept."
          : kind === "unsupported"
            ? "Your saved progress comes from a newer version of the game. Starting a new game will replace it for good. Your settings will be kept."
            : "Your saved progress can't be read. Starting a new game will replace it for good. Your settings will be kept.",
        kind === "ok" ? "KEEP PLAYING" : "GO BACK",
        "START NEW GAME",
        opener,
      );
      if (!ok) return;
    }
    // Only now does anything change: the campaign alone is replaced; settings and other keys stay.
    const persist = this.load.kind !== "unavailable" && this.host.store.startNewCampaign().ok;
    this.launch(() => this.host.newGame(persist));
  }

  /** A modal confirmation. The safe choice has focus; Escape, the backdrop and the safe button all cancel. */
          confirm(title        , text        , cancelLabel        , okLabel        , opener                    )                   {
    const d = this.dialog;
    document.getElementById("confirm-title") .textContent = title;
    document.getElementById("confirm-text") .textContent = text;
    const cancel = document.getElementById("confirm-cancel")                     ;
    const ok = document.getElementById("confirm-ok")                     ;
    cancel.querySelector(".label") .textContent = cancelLabel;
    ok.querySelector(".label") .textContent = okLabel;
    return new Promise         ((resolve) => {
      const onCancel = () => d.close("cancel");
      const onOk = () => d.close("ok");
      const onBackdrop = (e            ) => {
        if (e.target === d) d.close("cancel");
      };
      d.returnValue = "cancel";
      cancel.addEventListener("click", onCancel);
      ok.addEventListener("click", onOk);
      d.addEventListener("click", onBackdrop);
      d.addEventListener("close", () => {
        cancel.removeEventListener("click", onCancel);
        ok.removeEventListener("click", onOk);
        d.removeEventListener("click", onBackdrop);
        const confirmed = d.returnValue === "ok";
        if (!confirmed) opener?.focus();
        resolve(confirmed);
      }, { once: true });
      d.showModal();
      cancel.focus();
    });
  }

  // ---------------------------------------------------------------- levels

          renderLevels()              {
    const back = this.header("LEVELS");
    this.body.append(h("p", { class: "screen-text", text: `${SHIPPED} of ${LEVEL_COUNT} levels ${SHIPPED === 1 ? "is" : "are"} in this version. The rest are not released yet.` }));
    const label = h("p", { class: "page-label", "aria-live": "polite" });
    const prev = this.button("PREVIOUS", "prev", () => this.turnPage(-1), { "aria-label": "Previous ten levels" });
    const next = this.button("NEXT", "next", () => this.turnPage(1), { "aria-label": "Next ten levels" });
    const list = h("ul", { class: "level-list", "aria-label": "Levels" });
    const detail = h("div", { class: "level-detail", id: "level-detail" });
    this.body.append(h("div", { class: "pager" }, prev, label, next), h("div", { class: "levels-grid" }, list, detail));
    this.fillLevels();
    return (list.querySelector             (`[data-level="${this.levelsFocus}"]`) ?? back);
  }

          turnPage(step        )       {
    const page = Math.max(0, Math.min(PAGES - 1, this.levelsPage + step));
    if (page === this.levelsPage) return;
    const offset = (this.levelsFocus - 1) % PAGE;
    this.levelsPage = page;
    this.levelsFocus = Math.min(LEVEL_COUNT, page * PAGE + offset + 1);
    const active = document.activeElement                      ;
    const keepPager = active?.dataset.id === "prev" || active?.dataset.id === "next";
    this.fillLevels();
    if (!keepPager) this.body.querySelector             (`[data-level="${this.levelsFocus}"]`)?.focus();
  }

          fillLevels()       {
    const list = this.body.querySelector(".level-list") ;
    const label = this.body.querySelector(".page-label") ;
    const first = this.levelsPage * PAGE + 1;
    const last = Math.min(LEVEL_COUNT, first + PAGE - 1);
    label.textContent = `LEVELS ${levelNumber(first)}–${levelNumber(last)} OF ${LEVEL_COUNT}`;
    (this.body.querySelector('[data-id="prev"]')                     ).disabled = this.levelsPage === 0;
    (this.body.querySelector('[data-id="next"]')                     ).disabled = this.levelsPage === PAGES - 1;
    list.textContent = "";
    const progress = progressOf(this.load);
    for (let id = first; id <= last; id++) {
      const entry = LEVELS[id - 1];
      const status = levelStatus(id, progress);
      const name = entry.title ?? "???";
      const row = this.button(`${levelNumber(id)}  ${name}`, `level-${id}`, () => this.activateLevel(id), {
        class: `menu-item level-row status-${status}`,
        "data-level": String(id),
        "aria-label": `Level ${id}, ${entry.title ?? "name not revealed"}, ${status}`,
        "aria-describedby": "level-detail",
        ...(canLaunch(id, progress) ? {} : { "aria-disabled": "true" }),
      });
      row.append(h("span", { class: "level-status", "aria-hidden": "true", text: STATUS_WORD[status] }));
      row.addEventListener("focus", () => {
        this.levelsFocus = id;
        this.describeLevel(id);
      });
      list.append(h("li", {}, row));
    }
    this.describeLevel(this.levelsFocus >= first && this.levelsFocus <= last ? this.levelsFocus : first);
  }

          describeLevel(id        )       {
    const detail = this.body.querySelector             (".level-detail");
    if (!detail) return;
    const progress = progressOf(this.load);
    const status = levelStatus(id, progress);
    const entry = LEVELS[id - 1];
    const lines = [`LEVEL ${levelNumber(id)}  ${entry.title ?? "???"}`, `Status: ${STATUS_WORD[status]}`];
    if (entry.implemented) {
      const r = this.campaign?.records[String(id)];
      lines.push(`Best time: ${r?.bestMs ? formatTime(r.bestMs) : "—"}    Attempts: ${r?.attempts ? r.attempts : "—"}`);
    }
    const what                              = {
      available: this.resumable ? "Enter continues your story." : "Enter starts the story from the beginning.",
      completed: "Enter replays this level from its beginning. Your saved story is not changed; the replay's time and attempts are added to the records above.",
      locked: "Finish the level before this one to unlock it.",
      unavailable: "This level is not in this version of the game.",
    };
    lines.push(what[status]);
    if (entry.implemented) lines.push("Best time counts from when the command line opens to the end of the level, leaving out time the page was hidden.");
    detail.textContent = lines.join("\n");
  }

          activateLevel(id        )       {
    this.levelsFocus = id;
    const progress = progressOf(this.load);
    const status = levelStatus(id, progress);
    if (!canLaunch(id, progress)) {
      this.describeLevel(id);
      return;
    }
    this.mainFocus = "levels";
    if (status === "completed") this.launch(() => this.host.replay(id));
    else if (this.resumable) {
      const c = this.resumable;
      this.launch(() => this.host.continueGame(c));
    } else void this.requestNewGame();
  }

  // ---------------------------------------------------------------- settings

  // ---------------------------------------------------------------- archive (Owner, 2026-10-01, rewritten)
  // Two panels. Left: levels 1–100, ten to a page (< LEVELS 1 - 10 >); unlocked levels bright and
  // clickable, locked ones dim and not; a bright dot beside a level with new finds, gone once the level
  // is opened. Right: the opened level's SONGS, IMAGES and TEXTS, each as a list or a grid (Settings >
  // Display, or the toggle here). No counts, no subtitles, no sentences; an empty category shows nothing.
  // The Archive never clears (locked): there is no button for it.

          renderArchive()              {
    const back = this.header("ARCHIVE");
    back.parentElement .classList.add("archive-head");
    const loaded = this.host.store.loadArchive();
    // Only finds the game still holds: a file that has moved since (the songs, 2026-10-04) neither shows nor lights the dot.
    // The stored record itself is never changed: the Archive never clears.
    const items = (loaded.kind === "ok" ? loaded.items : []).filter((i) => this.host.archiveEntry(i.path) !== null);
    const opened = loaded.kind === "ok" ? loaded.opened : {};
    const progress = progressOf(this.load);
    const unlocked = (id        ) => ["available", "completed"].includes(levelStatus(id, progress));

    // Left: the levels.
    const first = this.archivePage * PAGE + 1;
    const last = Math.min(LEVEL_COUNT, first + PAGE - 1);
    const prev = this.iconButton("left", "archive-prev", "Previous ten levels", () => this.turnArchivePage(-1));
    const next = this.iconButton("right", "archive-next", "Next ten levels", () => this.turnArchivePage(1));
    prev.disabled = this.archivePage === 0;
    next.disabled = this.archivePage === PAGES - 1;
    const levels = h("ul", { class: "archive-levels", "aria-label": "Levels" });
    for (let id = first; id <= last; id++) {
      const open = unlocked(id);
      const row = h("button", {
        type: "button", class: `archive-level ${open ? "is-unlocked" : "is-locked"}${this.archiveLevel === id ? " is-open" : ""}`,
        "data-nav": "", "data-id": `alevel-${id}`, "aria-label": `Level ${id}, ${open ? "unlocked" : "locked"}${open && hasNewInLevel(items, opened, id) ? ", new discoveries" : ""}`,
        ...(open ? {} : { "aria-disabled": "true" }),
      });
      const name = h("span", { class: "archive-level-name" }, fileIcon("folder"), h("span", { text: `LEVEL ${id}` }));
      if (open && hasNewInLevel(items, opened, id)) name.append(h("span", { class: "new-dot", "aria-hidden": "true" }));
      const state = h("span", { class: "archive-level-state", "aria-hidden": "true" });
      if (!open) state.append(glyph("lock"));
      state.append(h("span", { text: open ? "UNLOCKED" : "LOCKED" }));
      row.append(name, state);
      if (open) row.addEventListener("click", () => this.openArchiveLevel(id));
      levels.append(h("li", {}, row));
    }
    const left = h("nav", { class: "archive-left", "aria-label": "Archive levels" },
      h("div", { class: "archive-pager" }, prev, h("span", { class: "archive-page-label", "aria-live": "polite", text: `LEVELS ${first} - ${last}` }), next), levels);

    // Right: the opened level's contents.
    const right = h("section", { class: "archive-right", "aria-label": this.archiveLevel ? `Level ${this.archiveLevel}` : "Level contents" });
    // The now-playing bar, at the top right of the Archive (shown only while a song is loaded).
    right.append(document.getElementById("song-bar") );
    if (this.archiveLevel !== null) this.fillArchiveLevel(right, items.filter((i) => i.level === this.archiveLevel));
    this.body.append(h("div", { class: "archive-panels" }, left, right));
    return back;
  }

          iconButton(name       , id        , label        , run            )                    {
    const b = h("button", { type: "button", class: "px-btn px-square", "data-nav": "", "data-id": id, "aria-label": label });
    b.append(glyph(name));
    b.addEventListener("click", () => {
      if (!this.launching) run();
    });
    return b;
  }

          turnArchivePage(step        )       {
    const page = Math.max(0, Math.min(PAGES - 1, this.archivePage + step));
    if (page === this.archivePage) return;
    this.archivePage = page;
    this.go("archive", step > 0 ? "archive-next" : "archive-prev");
  }

  /** Opening a level shows its contents and puts out its new-discovery dot. */
          openArchiveLevel(id        )       {
    this.archiveLevel = id;
    this.host.store.archiveOpened(id);
    this.go("archive", `alevel-${id}`);
  }

          fillArchiveLevel(right             , items               )       {
    const TABS                               = [["song", "SONGS"], ["photo", "IMAGES"], ["document", "TEXTS"]];
    const tabs = h("div", { class: "archive-tabs", role: "tablist" });
    for (const [kind, label] of TABS) {
      const b = this.button(label, `atab-${kind}`, () => {
        this.archiveTab = kind;
        this.go("archive", `atab-${kind}`);
      }, { class: "menu-item archive-tab", role: "tab", "aria-selected": String(this.archiveTab === kind) });
      tabs.append(b);
    }
    const key = VIEW_KEY[this.archiveTab];
    const mode = this.host.prefs.current[key];
    const toggle = h("div", { class: "archive-toggle", role: "group", "aria-label": "View" });
    for (const value of ["list", "grid"]         ) {
      const b = h("button", { type: "button", class: "option", "data-nav": "", "data-id": `aview-${value}`, "aria-pressed": String(mode === value) }, h("span", { class: "label", text: value.toUpperCase() }));
      b.addEventListener("click", () => {
        this.host.prefs.set(key, value);
        this.go("archive", `aview-${value}`);
      });
      toggle.append(b);
    }
    right.append(h("div", { class: "archive-bar" }, tabs, toggle));
    const found = items.filter((i) => i.kind === this.archiveTab).map((i) => ({ item: i, entry: this.host.archiveEntry(i.path) })).filter((x)                                                  => x.entry !== null);
    if (this.archiveTab === "song") this.archivePlaylist = found.map((f) => f.entry.song ).filter(Boolean);
    if (found.length === 0) return; // an empty category shows nothing
    const grid = mode === "grid";
    const list = h("ul", { class: grid ? "archive-grid" : "archive-list", "aria-label": TABS.find(([k]) => k === this.archiveTab) [1] });
    for (const { item, entry } of found) {
      const id = `item:${item.path}`;
      let el             ;
      if (entry.song) {
        const song = entry.song;
        const play = this.iconButton("play", id, `Play ${song.title}`, () => this.toggleSong(song));
        play.dataset.song = song.id;
        el = grid
          ? h("div", { class: "archive-tile" }, fileIcon("song"), h("span", { class: "archive-name", text: song.title }), play)
          : h("div", { class: "archive-row" }, h("span", { class: "archive-name", text: `♪ ${song.title}` }), play);
      } else if (entry.image) {
        const open = () => this.openArchiveItem(item.path);
        if (grid) {
          const thumb = h("button", { type: "button", class: "archive-thumb", "data-nav": "", "data-id": id, "aria-label": `Open ${entry.name}` }, h("img", { src: `images/thumbs/${entry.image}.jpg`, alt: "" }), h("span", { class: "archive-name", text: entry.name }));
          thumb.addEventListener("click", open);
          el = thumb;
        } else el = h("div", { class: "archive-row" }, h("span", { class: "archive-name", text: entry.name }), this.button("VIEW", id, open, { class: "menu-item archive-action", "aria-label": `View ${entry.name}` }));
      } else {
        const open = () => this.openArchiveItem(item.path);
        if (grid) {
          const tile = h("button", { type: "button", class: "archive-tile archive-doc", "data-nav": "", "data-id": id, "aria-label": `Read ${entry.name}` }, fileIcon("file"), h("span", { class: "archive-name", text: entry.name }));
          tile.addEventListener("click", open);
          el = tile;
        } else el = h("div", { class: "archive-row" }, h("span", { class: "archive-name", text: entry.name }), this.button("READ", id, open, { class: "menu-item archive-action", "aria-label": `Read ${entry.name}` }));
      }
      list.append(h("li", {}, el));
    }
    right.append(list);
    this.drawArchiveSongs();
  }

          toggleSong(song                               )       {
    const now = this.host.sounds.songState;
    if (now?.id === song.id && now.playing) this.host.sounds.pauseSong();
    else this.host.sounds.playSong(song.id, song.title);
  }

  /** ⏮ / ⏭ on the now-playing bar: the opened level's songs, in order. */
          stepSong(step        )       {
    const list = this.archivePlaylist;
    if (list.length === 0) return;
    const at = list.findIndex((s) => s.id === this.host.sounds.songState?.id);
    const next = list[(at + step + list.length) % list.length];
    this.host.sounds.playSong(next.id, next.title);
  }

  /** Each song's button shows ▶, or ⏸ while that song plays. */
          drawArchiveSongs()       {
    const state = this.host.sounds.songState;
    for (const b of Array.from(this.body.querySelectorAll                   ("button[data-song]"))) {
      const playing = state?.id === b.dataset.song && state?.playing === true;
      if (b.dataset.symbol === (playing ? "pause" : "play")) continue;
      b.dataset.symbol = playing ? "pause" : "play";
      b.replaceChildren(glyph(playing ? "pause" : "play"));
      b.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${b.getAttribute("aria-label") .replace(/^(Play|Pause) /, "")}`);
    }
  }

          openArchiveItem(path        )       {
    this.archivePath = path;
    this.go("archiveItem");
  }

  /** An image or a text from the Archive, shown whole. */
          renderArchiveItem()              {
    const entry = this.archivePath ? this.host.archiveEntry(this.archivePath) : null;
    const back = this.header(entry?.name ?? "ARCHIVE");
    if (!entry) return back;
    const view = h("div", { class: "archive-view" });
    if (entry.image) {
      view.append(h("img", { class: "archive-image", src: `images/${entry.image}.jpg`, alt: entry.text.trim() || entry.name }), h("p", { class: "archive-caption", text: entry.text }));
    } else {
      view.append(h("pre", { class: `archive-text${/^WARNING/.test(entry.name) ? " warning" : ""}`, tabindex: "0", text: entry.text }));
    }
    this.body.append(view);
    return back;
  }

  /** SETTINGS: a submenu of pages (Owner, 2026-10-01). */
          renderSettings()              {
    this.body.append(h("h2", { class: "screen-title", text: "SETTINGS" }));
    const list = h("ul", { class: "menu-list" });
    const add = (label        , id        , run            ) => list.append(h("li", {}, this.button(label, id, () => {
      this.settingsFocus = id;
      run();
    })));
    add("AUDIO", "audio", () => this.go("audio"));
    add("CONTROLS", "controls", () => this.go("controls"));
    add("DISPLAY", "display", () => this.go("display"));
    add("ACCESSIBILITY", "accessibility", () => this.go("accessibility"));
    add("BACK", "back", () => this.back());
    this.body.append(h("nav", { "aria-label": "Settings" }, list));
    if (!this.host.store.canSave) this.notice("Changes apply immediately. This browser isn't letting the game save, so they last until you close the page.");
    return list.querySelector             (`[data-id="${this.settingsFocus ?? "audio"}"]`) ;
  }

  /** One settings page: each setting applies at once and is saved at once. */
          renderGroup(group       )              {
    const back = this.header(GROUP_TITLE[group]);
    const prefs = this.host.prefs;
    for (const key of SETTING_GROUPS[group]) {
      const t = SETTING_TEXT[key];
      const labelId = `setting-${key}`;
      const helpId = `${labelId}-help`;
      const row = h("div", { class: "setting", role: "group", "aria-labelledby": labelId, ...(t.help ? { "aria-describedby": helpId } : {}), "data-key": key });
      const options = h("div", { class: "options" });
      for (const value of SETTING_VALUES[key]) {
        const b = h("button", { type: "button", class: "option", "data-value": value, "aria-pressed": "false" }, h("span", { class: "label", text: t.values[value] }));
        b.addEventListener("click", () => this.choose(key, value));
        options.append(b);
      }
      row.append(h("span", { class: "setting-label", id: labelId, text: t.label }), options);
      if (t.help) row.append(h("p", { class: "setting-help", id: helpId, text: t.help }));
      this.body.append(row);
    }
    const restore = this.button("RESTORE DEFAULTS", "restore", () => {
      prefs.restoreDefaults(SETTING_GROUPS[group]);
      this.syncSettings();
    }, { "aria-label": `Restore the default ${GROUP_TITLE[group].toLowerCase()} settings` });
    this.body.append(h("div", { class: "screen-actions" }, restore));
    this.syncSettings();
    return back;
  }

  // ---------------------------------------------------------------- pause

          renderPause()              {
    const host = this.pauseHost ;
    const list = h("ul", { class: "menu-list" });
    const add = (label        , id        , run            ) => list.append(h("li", {}, this.button(label, id, run)));
    add("RESUME", "resume", () => this.resume());
    add("SAVE GAME", "save", () => {
      const r = host.save();
      this.notice(r.text);
      this.noticeEl.classList.toggle("bad", !r.ok);
    });
    add("SETTINGS", "settings", () => this.go("settings"));
    add("EXIT TO MAIN MENU", "exit", () => void this.requestLeave());
    // No QUIT GAME: a web page cannot close itself (it appears only where a runtime can really exit).
    this.body.append(h("nav", { "aria-label": "Pause menu" }, list));
    return list.querySelector             ('[data-id="resume"]') ;
  }

          async requestLeave()                {
    const host = this.pauseHost ;
    const { title, text } = host.leaveText();
    const ok = await this.confirm(title, text, "STAY", "EXIT TO MAIN MENU", document.activeElement                      );
    if (!ok) return;
    this.launching = true;
    host.leave();
  }

          choose(key            , value        )       {
    this.host.prefs.set(key, value                        );
    this.syncSettings();
  }

  /** Marks each row's current value (brackets and aria-pressed, never colour alone). */
          syncSettings()       {
    const prefs = this.host.prefs;
    for (const row of Array.from(this.body.querySelectorAll             (".setting"))) {
      const key = row.dataset.key              ;
      for (const b of Array.from(row.querySelectorAll                   (".option"))) {
        const on = b.dataset.value === prefs.current[key];
        b.setAttribute("aria-pressed", String(on));
        b.toggleAttribute("data-nav", on);
      }
      const help = row.querySelector(".setting-help");
      if (help && key === "reduceMotion") help.textContent = `${SETTING_TEXT.reduceMotion.help}${prefs.isChosen("reduceMotion") ? "" : " Following your system setting until you choose."}`;
    }
  }

          stepSetting(row             , step        )       {
    const key = row.dataset.key              ;
    const values = SETTING_VALUES[key]                     ;
    const at = values.indexOf(this.host.prefs.current[key]);
    const next = values[(at + step + values.length) % values.length];
    this.choose(key, next);
    row.querySelector             (`[data-value="${next}"]`)?.focus();
  }

  // ---------------------------------------------------------------- controls, about, privacy

          section(title        , rows                         )              {
    const dl = h("dl", { class: "keys" });
    for (const [k, v] of rows) dl.append(h("dt", { text: k }), h("dd", { text: v }));
    return h("section", {}, h("h3", { text: title }), dl);
  }

          renderControls()              {
    const back = this.header("CONTROLS");
    this.body.append(
      this.section("IN THE MENUS", [
        ["Up / Down", "Select an item."],
        ["Enter", "Activate it."],
        ["Left / Right", "Change the selected setting."],
        ["Esc", "Go back, or cancel a question. In the pause menu, Esc resumes."],
        ["Tab / Shift+Tab", "Move between controls."],
        ["Mouse or touch", "Click or tap any item."],
      ]),
      this.section("ANY TIME IN THE GAME", [
        ["Esc or the II button", "Pause. Time stops until you resume."],
      ]),
      this.section("DURING THE STORY", [
        ["Any key or tap", "Show the next line of the conversation."],
        ["Type, then Enter", "Answer when you are asked a question."],
      ]),
      this.section("AT THE COMMAND LINE", [
        ["help", "List the commands. help dir explains dir."],
        ["dir", "List the files and folders here."],
        ["cd FOLDER / cd ..", "Move into a folder, or back out. Moving around never makes a choice."],
        ["type FILE", "Read a file."],
        ["choose", "Choosing a folder is its own command, and it asks you to confirm."],
        ["Tab, click or tap", "Switch between the command line and the chat."],
        ["Left, Right, Home, End", "Move along the line. Backspace and Delete erase."],
        ["Up / Down", "Recall earlier commands."],
      ]),
      this.section("READING", [
        ["Space, Enter, Page Down or tap", "Read on through a file."],
        ["q", "Close a file or picture."],
      ]),
      this.section("SAVING", [
        ["Automatic", "Progress saves as you play; SAVE GAME in the pause menu saves it again. CONTINUE picks up where you left off in the command center (in the opening, at the start of your next attempt)."],
      ]),
    );
    return back;
  }

          renderAbout()              {
    const back = this.header("ABOUT");
    const link = h("a", { href: GITHUB, target: "_blank", rel: "noopener noreferrer", class: "menu-item menu-link", "data-nav": "", "data-id": "github" },
      h("span", { class: "marker", "aria-hidden": "true", text: ">" }),
      h("span", { class: "label", text: "DEVELOPER GITHUB" }),
      h("span", { class: "external", text: " (opens github.com in a new tab)" }));
    this.body.append(
      h("div", { class: "about" },
        h("p", { class: "about-title", text: TITLE }),
        h("p", { text: "A story about a boy, a stranger on a screen, and a future that has not happened yet." }),
        h("p", { text: "Created and developed by Uttam Torry." }),
        h("p", { text: "Thank you for playing." })),
      h("div", { class: "screen-actions" }, link),
    );
    return back;
  }

          renderPrivacy()              {
    const back = this.header("PRIVACY");
    const para = (text        ) => h("p", { text });
    const part = (title        , ...texts          ) => h("section", {}, h("h3", { text: title }), ...texts.map(para));
    this.body.append(h("div", { class: "privacy" },
      part("WHAT THE GAME STORES",
        "Your story progress, level unlocks and level records (best time and attempts); separately, your settings; separately again, your Archive (which songs, photos and documents you have found); and whether you have watched the opening, so it can be skipped. They are kept in this browser's local storage, on your device.",
        "The game does not ask for a name, an email address, an account or any other personal information."),
      part("WHAT THE GAME SENDS",
        "Nothing. The game does not send your progress, settings, typing or anything else you do to any server. It has no analytics, advertising, tracking or error reporting, and it loads no fonts, scripts or other files from other services.",
        "Its own pages, code and pictures come from the website that serves the game. Like any website, that host may keep ordinary request logs, such as your IP address and the time of each request. Those logs belong to the host, not to the game."),
      part("WHERE YOUR SAVE LIVES",
        "Saves belong to this browser profile and this website. They do not move to another browser or device, and clearing this site's data in your browser deletes them."),
      part("REMOVING YOUR DATA",
        "NEW GAME erases your story progress, unlocks and level records, after asking you to confirm. Your settings are kept.",
        "RESTORE DEFAULTS, on each page of SETTINGS, removes the saved settings on that page.",
        "The Archive is never cleared by the game: not by NEW GAME, not by a reset. Clearing this site's data in your browser removes it.",
        "Clearing this site's data in your browser removes everything the game has stored."),
      part("OUTSIDE LINKS",
        "The Developer GitHub link on the About screen opens github.com, an outside service with its own privacy policy. The game never needs it."),
    ));
    return back;
  }
}
