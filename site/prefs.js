// Settings in effect, shared by the menu and the game. Choices apply at once and are saved at once
// (there is no Apply button). They reach the page as data attributes on <html>, which the style
// sheet turns into tokens, and reach the game through the getters below. Presentation only: the
// danger count, its consequences and every timer are untouched.

import { TEXT_SPEED_FACTOR, resolveSettings } from "./settings.js";
                                                                               
                                                             

export class Prefs {
  current          ;
          stored                ;
          store           ;
          media                       ;
          listeners = new Set                       ();

  constructor(store           ) {
    this.store = store;
    this.stored = store.loadSettings();
    this.media = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    this.current = this.resolve();
    // Unset preferences follow the system as it changes.
    this.media?.addEventListener("change", () => this.refresh());
    this.apply();
  }

          resolve()           {
    return resolveSettings(this.stored, { reducedMotion: this.media?.matches ?? false });
  }

          refresh()       {
    this.current = this.resolve();
    this.apply();
    for (const fn of this.listeners) fn(this.current);
  }

          apply()       {
    const d = document.documentElement.dataset;
    d.textSize = this.current.textSize;
    d.palette = this.current.palette;
    d.commandColor = this.current.commandColor;
    d.reduceMotion = this.current.reduceMotion;
    d.dangerEffects = this.current.dangerEffects;
    d.curvature = this.current.curvature;
  }

  /** Settings > Display > View mode: dir shows icons. */
  get iconView()          {
    return this.current.viewMode === "icons";
  }

  /** Whether the player has chosen this setting (unset ones follow a default). */
  isChosen(key            )          {
    return key in this.stored;
  }

  set                      (key   , value             )              {
    this.stored = { ...this.stored, [key]: value };
    this.refresh();
    return this.store.saveSettings(this.stored);
  }

  /** Forgets the given settings (or all of them), so they follow their defaults again. */
  restoreDefaults(keys                        )              {
    const next                 = { ...this.stored };
    for (const k of keys ?? (Object.keys(next)                )) delete next[k];
    this.stored = next;
    this.refresh();
    return Object.keys(next).length === 0 ? this.store.clearSettings() : this.store.saveSettings(next);
  }

  onChange(fn                       )       {
    this.listeners.add(fn);
  }

  get textSpeedFactor()         {
    return TEXT_SPEED_FACTOR[this.current.textSpeed];
  }

  get reduceMotion()          {
    return this.current.reduceMotion === "on";
  }

  /** No strobing anywhere (the boot's blinking and white overload, the screen's turn-on flash). */
  get calm()          {
    return this.reduceMotion || this.current.dangerEffects !== "full";
  }
}
