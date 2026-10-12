// Player preferences, kept apart from story progress. Only choices the player made are stored;
// anything unset follows its default. Reduce motion and danger effects follow the system's
// reduced-motion preference until the player picks a value. Settings change presentation only:
// never the danger count, its consequences, timers or the order of events.

export const SETTINGS_SCHEMA = 1;

export const SETTING_VALUES = {
  sound: ["on", "off"],
  /** The background track (the fluorescent buzz): plays under everything when on. */
  music: ["on", "off"],
  ambientVolume: ["low", "medium", "high"],
  /** Typing, glitches and every other sound effect. */
  effectsVolume: ["low", "medium", "high"],
  textSize: ["small", "medium", "large"],
  textSpeed: ["slow", "normal", "fast"],
  dangerEffects: ["full", "reduced", "off"],
  palette: ["green", "soft-green", "soft-blue", "soft-amber"],
  /** Final.md, THE AMBER SETTING: commands in P3 amber (#FFB000), everything else green; green by default. */
  commandColor: ["green", "amber"],
  /** The curved glass: off draws the text flat. */
  curvature: ["on", "off"],
  /** How `dir` shows a folder (Owner, 2026-10-01): a text listing, or pixel-art icons. */
  viewMode: ["terminal", "icons"],
  /** How each Archive category shows (Owner, 2026-10-01): songs list, images grid, texts list by default. */
  archiveSongs: ["list", "grid"],
  archiveImages: ["list", "grid"],
  archiveTexts: ["list", "grid"],
  reduceMotion: ["on", "off"],
}         ;

                                                     
                                                                                 
/** What is stored: only the settings the player has chosen. */
                                               

export const SETTING_KEYS = Object.keys(SETTING_VALUES)                ;

/** The system's preferences that some defaults follow. */
                              
                         
 

export function defaults(system             )           {
  return {
    sound: "on",
    music: "on",
    ambientVolume: "low",
    effectsVolume: "high",
    textSize: "medium",
    textSpeed: "normal",
    dangerEffects: system.reducedMotion ? "reduced" : "full",
    palette: "green",
    commandColor: "green",
    curvature: "on",
    viewMode: "terminal",
    archiveSongs: "list",
    archiveImages: "grid",
    archiveTexts: "list",
    reduceMotion: system.reducedMotion ? "on" : "off",
  };
}

export function isSettingValue                      (key   , value         )                       {
  return (SETTING_VALUES[key]                      ).includes(value);
}

/**
 * Reads stored settings. Unknown keys and invalid values are dropped one by one, so one bad field
 * never costs the others. Anything that is not an object gives no stored settings.
 */
export function parseSettings(raw         )                 {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const src = raw                           ;
  const values = typeof src.values === "object" && src.values !== null ? (src.values                           ) : {};
  const out                 = {};
  for (const key of SETTING_KEYS) {
    const v = values[key];
    if (isSettingValue(key, v)) (out                           )[key] = v;
  }
  return out;
}

export function serializeSettings(stored                )         {
  return JSON.stringify({ schema: SETTINGS_SCHEMA, values: stored });
}

/** The settings in effect: stored choices over defaults. */
export function resolveSettings(stored                , system             )           {
  return { ...defaults(system), ...stored };
}

/** The settings menu's groups (Owner, 2026-10-01). CONTROLS is a page of keys, not settings. */
export const SETTING_GROUPS = {
  audio: ["sound", "music", "ambientVolume", "effectsVolume"],
  display: ["textSize", "palette", "commandColor", "curvature", "viewMode", "archiveSongs", "archiveImages", "archiveTexts"],
  accessibility: ["dangerEffects", "reduceMotion", "textSpeed"],
}                                                         ;

/** Text speed as a factor on typing delays (narrative typing only; timers are untouched). */
export const TEXT_SPEED_FACTOR                                        = { slow: 1.6, normal: 1, fast: 0.4 };
