// Saved games, browser-local. One campaign per browser profile and site, under a namespaced key;
// settings live under their own key and survive a new game. Every campaign write replaces one key
// with a whole, validated record, so a save is never half-written. Reading distinguishes a missing
// save, an unreadable one, one from a newer version, and storage the browser will not give us.
// Nothing here talks to a network.
//
// What a save restores (checkpoint = the start of the next attempt; inside an attempt, a resume point,
// below, Owner 2026-10-06): Caine's memory across attempts
// (which attempts happened and how each ended, the files he has read, persistent scripted beats),
// the current level, unlocks, completions and level records. An attempt interrupted by closing or
// reloading the page is closed as a voluntary exit when the game continues; its folder position,
// choices and danger were per-attempt and end with it, exactly as they do when an attempt fails.

import { END_TRIGGERS } from "./session.js";
                                                            
import { LEVEL_COUNT, isLevelId } from "./levels.js";
                                                 
import { parseSettings, serializeSettings } from "./settings.js";
import { ARCHIVE_KEY, addToArchive, parseArchive, serializeArchive } from "./archive.js";
                                                             
                                                    

export const CAMPAIGN_KEY = "project-caine:campaign";
export const SETTINGS_KEY = "project-caine:settings";
/** Set once the player has watched the whole opening; from then on it can be skipped (Owner, 2026-10-01). */
export const OPENING_KEY = "project-caine:opening-seen";
export const CAMPAIGN_SCHEMA = 1;
/** Where the player left off inside an attempt (Owner, 2026-10-06): CONTINUE resumes there. */
export const RESUME_KEY = "project-caine:resume";
export const RESUME_SCHEMA = 1;

/**
 * A resume point, written after every command, every line of John's and every choice while the command
 * center is open. The engine is rebuilt by replaying every call the screen made to it (the session's
 * seed makes John's choices the same); the screen itself (the command center's lines, John's panel, the
 * prompt), the timer, the command history and the questions already asked are kept as they were.
 */
                              
                               
                
               
                                      
                                                                                                        
                                                              
                   
                                                         
                 
                    
                                   
                  
 

/** A resume point, or null when there is none or it cannot be read (then CONTINUE starts the next attempt). */
export function parseResume(text               )                     {
  if (text === null) return null;
  try {
    const v = JSON.parse(text);
    const strings = (a         ) => Array.isArray(a) && a.every((x) => typeof x === "string");
    if (!isObject(v) || v.schema !== RESUME_SCHEMA || !isLevelId(v.level) || typeof v.seed !== "string") return null;
    if (!Array.isArray(v.journal) || !v.journal.every((e) => Array.isArray(e) && e.length === 2 && typeof e[0] === "string" && Array.isArray(e[1]))) return null;
    const sc = v.screen;
    if (!isObject(sc) || !Array.isArray(sc.log) || !Array.isArray(sc.chat) || typeof sc.prompt !== "string") return null;
    if (!Number.isInteger(v.timeLeft) || (v.timeLeft          ) < 0 || !strings(v.history)) return null;
    if (typeof v.playMs !== "number" || !Number.isFinite(v.playMs) || v.playMs < 0) return null;
    if (!Array.isArray(v.asked) || !v.asked.every((e) => Array.isArray(e) && typeof e[0] === "string" && Array.isArray(e[1]) && e[1].every(Number.isInteger))) return null;
    if (typeof v.savedAt !== "string") return null;
    return v                          ;
  } catch {
    return null;
  }
}

/** The part of Web Storage the game uses. */
                              
                                      
                                            
                                
 

                              
                                                                                         
                   
                 
                                                                     
                        
 

                              
                                                                                          
                                                                                        
                      
                             
 

                           
                                 
                
                                                                                                      
                                        
                      
                     
                      
                                       
                  
 

                        
                     
                                      
                                                                                         
                                       
                                                                
                                           
                                                                       
                            

                                                                                                        

// ------------------------------------------------------------------ validation

class Invalid extends Error {}

function fail(reason        )        {
  throw new Invalid(reason);
}

const isObject = (v         )                               => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v         )              => typeof v === "number" && Number.isInteger(v) && v >= 0;

function levelList(v         , field        )           {
  if (!Array.isArray(v) || !v.every(isLevelId)) fail(`${field} must list level numbers 1–${LEVEL_COUNT}`);
  if (new Set(v).size !== v.length) fail(`${field} repeats a level`);
  return [...v].sort((a, b) => a - b);
}

function stringList(v         , field        )           {
  if (!Array.isArray(v) || !v.every((s) => typeof s === "string" && s.length > 0 && s.length < 400)) fail(`${field} must be a list of names`);
  return [...new Set(v            )].sort();
}

function validateMemory(v         )              {
  if (!isObject(v)) fail("memory missing");
  if (!Array.isArray(v.connections)) fail("memory.connections missing");
  const connections = v.connections.map((c, i, all) => {
    if (!isObject(c)) fail(`connection ${i} invalid`);
    if (c.index !== i) fail(`connection ${i} out of order`);
    if (typeof c.johnInstance !== "string" || c.johnInstance === "") fail(`connection ${i} has no John instance`);
    const open = c.ended === null;
    if (open && i !== all.length - 1) fail(`connection ${i} is open but not the latest`);
    if (!open && !END_TRIGGERS.includes(c.ended              )) fail(`connection ${i} ended in an unknown way`);
    return { index: i, johnInstance: c.johnInstance, ended: c.ended                      };
  });
  return { connections, filesRead: stringList(v.filesRead, "memory.filesRead"), playedPersistent: stringList(v.playedPersistent, "memory.playedPersistent") };
}

function validateRecords(v         )                              {
  if (!isObject(v)) fail("records missing");
  const out                              = {};
  for (const [key, r] of Object.entries(v)) {
    if (!isLevelId(Number(key)) || String(Number(key)) !== key) fail(`record for unknown level ${key}`);
    if (!isObject(r) || !isCount(r.attempts) || !isCount(r.clears)) fail(`record ${key} invalid`);
    const best = r.bestMs;
    if (best !== null && !(typeof best === "number" && Number.isFinite(best) && best > 0)) fail(`record ${key} has an invalid time`);
    if (best !== null && r.clears === 0) fail(`record ${key} has a time but no clear`);
    out[key] = { attempts: r.attempts, clears: r.clears, bestMs: best                  };
  }
  return out;
}

/** Checks a parsed version-1 campaign field by field. Throws Invalid with a reason. */
function validateV1(v                         )           {
  if (!isLevelId(v.level)) fail("level invalid");
  if (v.status !== "in_progress" && v.status !== "level_clear") fail("status invalid");
  const unlocked = levelList(v.unlocked, "unlocked");
  const completed = levelList(v.completed, "completed");
  if (!unlocked.includes(1)) fail("level 1 must be unlocked");
  if (!completed.every((id) => unlocked.includes(id))) fail("a completed level is not unlocked");
  if (!unlocked.includes(v.level)) fail("current level is not unlocked");
  if (v.status === "level_clear" && !completed.includes(v.level)) fail("cleared level not marked completed");
  if (typeof v.savedAt !== "string" || Number.isNaN(Date.parse(v.savedAt))) fail("savedAt invalid");
  return {
    schema: CAMPAIGN_SCHEMA, level: v.level, status: v.status, memory: validateMemory(v.memory),
    unlocked, completed, records: validateRecords(v.records), savedAt: v.savedAt,
  };
}

/**
 * Brings a parsed save up to the current schema. Version 1 is the first saved format, so there is
 * nothing older to migrate yet; a later schema adds its step here (1 → 2, ...) with its own test,
 * and never deletes the old record until the new one is written.
 */
export function migrate(raw         )             {
  if (!isObject(raw)) return { kind: "corrupt", reason: "not a save record" };
  const schema = raw.schema;
  if (typeof schema !== "number" || !Number.isInteger(schema) || schema < 1) return { kind: "corrupt", reason: "no schema version" };
  if (schema > CAMPAIGN_SCHEMA) return { kind: "unsupported", schema };
  try {
    return { kind: "ok", campaign: validateV1(raw) };
  } catch (e) {
    if (e instanceof Invalid) return { kind: "corrupt", reason: e.message };
    throw e;
  }
}

/** Parses the stored text of a campaign. */
export function parseCampaign(text        )             {
  let raw         ;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: "corrupt", reason: "not valid JSON" };
  }
  return migrate(raw);
}

// ------------------------------------------------------------------ campaign changes (pure)

export function newCampaign(now      )           {
  return {
    schema: CAMPAIGN_SCHEMA, level: 1, status: "in_progress",
    memory: { connections: [], filesRead: [], playedPersistent: [] },
    unlocked: [1], completed: [], records: {}, savedAt: now.toISOString(),
  };
}

function record(c          , level        )              {
  return c.records[String(level)] ?? { attempts: 0, clears: 0, bestMs: null };
}

/** Caine's memory as the engine reports it after any step. */
export function withMemory(c          , memory             , now      )           {
  return { ...c, memory: validateMemory(memory), savedAt: now.toISOString() };
}

/** A new attempt began on a level (campaign or replay). */
export function withAttempt(c          , level        , now      )           {
  const r = record(c, level);
  return { ...c, records: { ...c.records, [level]: { ...r, attempts: r.attempts + 1 } }, savedAt: now.toISOString() };
}

/** A clear: its time counts toward the record. In the campaign it also unlocks the next level. */
export function withClear(c          , level        , activeMs        , campaign         , now      )           {
  const r = record(c, level);
  const ms = Math.max(1, Math.round(activeMs));
  const records = { ...c.records, [level]: { attempts: r.attempts, clears: r.clears + 1, bestMs: r.bestMs === null ? ms : Math.min(r.bestMs, ms) } };
  if (!campaign) return { ...c, records, savedAt: now.toISOString() };
  const next = level + 1;
  return {
    ...c, records, status: "level_clear",
    completed: [...new Set([...c.completed, level])].sort((a, b) => a - b),
    unlocked: [...new Set([...c.unlocked, ...(isLevelId(next) ? [next] : [])])].sort((a, b) => a - b),
    savedAt: now.toISOString(),
  };
}

/** Caine's memory for the next attempt: an attempt left open by a closed page ends as a voluntary exit. */
export function memoryForResume(c          )              {
  return {
    connections: c.memory.connections.map((conn) => ({ ...conn, ended: conn.ended ?? "voluntary_exit" })),
    filesRead: [...c.memory.filesRead],
    playedPersistent: [...c.memory.playedPersistent],
  };
}

/** Continue is offered only for a campaign in progress on a level this build can play. */
export function isResumable(c          , shipped                            )          {
  return c.status === "in_progress" && shipped(c.level);
}

export function progressOf(result            )                {
  return result.kind === "ok" ? { unlocked: result.campaign.unlocked, completed: result.campaign.completed } : { unlocked: [1], completed: [] };
}

// ------------------------------------------------------------------ storage

function isQuota(e         )          {
  if (typeof e !== "object" || e === null) return false;
  const { name, code } = e                                    ;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

/** The campaign and settings, over whatever storage the browser gives (null: none). */
export class SaveStore {
  /** Set when a write fails, so the menu can say progress was not saved. */
  lastWriteFailed                     = null;
          storage                    ;
          now            ;
          writable         ;

  constructor(storage                    , now             = () => new Date(), writable = true) {
    this.storage = storage;
    this.now = now;
    this.writable = writable;
  }

  /** Whether progress can be saved: storage exists, accepted a test write, and no write has failed since. */
  get canSave()          {
    return this.storage !== null && this.writable && this.lastWriteFailed === null;
  }

  load()             {
    if (!this.storage) return { kind: "unavailable" };
    let text               ;
    try {
      text = this.storage.getItem(CAMPAIGN_KEY);
    } catch {
      return { kind: "unavailable" };
    }
    return text === null ? { kind: "empty" } : parseCampaign(text);
  }

          put(key        , value        )              {
    if (!this.storage) return this.failed({ ok: false, reason: "unavailable" });
    try {
      this.storage.setItem(key, value);
      return { ok: true };
    } catch (e) {
      return this.failed({ ok: false, reason: isQuota(e) ? "quota" : "unavailable" });
    }
  }

          failed(r             )              {
    this.lastWriteFailed = r;
    return r;
  }

  /** Writes a whole campaign after checking it. */
  write(c          )              {
    const checked = migrate(JSON.parse(JSON.stringify(c)));
    if (checked.kind !== "ok") throw new Error(`refusing to write an invalid campaign: ${checked.kind === "corrupt" ? checked.reason : checked.kind}`);
    return this.put(CAMPAIGN_KEY, JSON.stringify(checked.campaign));
  }

  /**
   * Changes the stored campaign. Re-reads it first, so a stale copy never overwrites newer progress,
   * and never touches a save it cannot read.
   */
  update(change                                      )              {
    const current = this.load();
    if (current.kind === "unavailable") return this.failed({ ok: false, reason: "unavailable" });
    if (current.kind !== "ok") return { ok: false, reason: "no_campaign" };
    const next = change(current.campaign, this.now());
    if (JSON.stringify({ ...next, savedAt: "" }) === JSON.stringify({ ...current.campaign, savedAt: "" })) return { ok: true };
    return this.write(next);
  }

  loadResume()                     {
    try {
      return parseResume(this.storage?.getItem(RESUME_KEY) ?? null);
    } catch {
      return null;
    }
  }

  /** Writes the resume point. A refused write leaves the campaign's own save state alone. */
  saveResume(point             )          {
    if (!this.storage || !this.writable) return false;
    try {
      this.storage.setItem(RESUME_KEY, JSON.stringify(point));
      return true;
    } catch {
      return false;
    }
  }

  clearResume()       {
    try {
      this.storage?.removeItem(RESUME_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  /** New Game: removes the campaign (story progress, unlocks, level records) and starts a fresh one. Settings stay. */
  startNewCampaign()              {
    if (!this.storage) return this.failed({ ok: false, reason: "unavailable" });
    try {
      this.storage.removeItem(RESUME_KEY);
      this.storage.removeItem(CAMPAIGN_KEY);
    } catch {
      return this.failed({ ok: false, reason: "unavailable" });
    }
    return this.write(newCampaign(this.now()));
  }

  loadSettings()                 {
    if (!this.storage) return {};
    try {
      const text = this.storage.getItem(SETTINGS_KEY);
      return text === null ? {} : parseSettings(JSON.parse(text));
    } catch {
      return {};
    }
  }

  saveSettings(stored                )              {
    return this.put(SETTINGS_KEY, serializeSettings(stored));
  }

  /**
   * Whether a level's opening has been watched once in this browser (Owner, 2026-10-01: per level; the
   * first time SKIP is dim, after that it works). Stored as the levels' numbers, "1,2"; survives New Game.
   */
  openingSeen(level = 1)          {
    try {
      return (this.storage?.getItem(OPENING_KEY) ?? "").split(",").includes(String(level));
    } catch {
      return false;
    }
  }

  markOpeningSeen(level = 1)              {
    if (this.openingSeen(level)) return { ok: true };
    let seen           = [];
    try {
      seen = (this.storage?.getItem(OPENING_KEY) ?? "").split(",").filter(Boolean);
    } catch {
      // unreadable: start the list again
    }
    return this.put(OPENING_KEY, [...seen, String(level)].join(","));
  }

  /** The Archive (memory, not progress): it survives New Game and resets, and nothing in the game clears it. */
  loadArchive()              {
    if (!this.storage) return { kind: "ok", items: [], opened: {} };
    try {
      return parseArchive(this.storage.getItem(ARCHIVE_KEY));
    } catch {
      return { kind: "ok", items: [], opened: {} };
    }
  }

  /** Records a find. An unreadable Archive is never overwritten this way. */
  archive(item                            )              {
    const current = this.loadArchive();
    if (current.kind !== "ok") return { ok: false, reason: "no_campaign" };
    if (current.items.some((i) => i.path === item.path)) return { ok: true };
    return this.put(ARCHIVE_KEY, serializeArchive(addToArchive(current.items, { ...item, found: this.now().toISOString() }), current.opened));
  }

  /** The player opened a level's archive: its new-discovery dot goes away. */
  archiveOpened(level        )              {
    const current = this.loadArchive();
    if (current.kind !== "ok") return { ok: false, reason: "no_campaign" };
    return this.put(ARCHIVE_KEY, serializeArchive(current.items, { ...current.opened, [String(level)]: this.now().toISOString() }));
  }

  /** Restore defaults: forgets every stored setting. */
  clearSettings()              {
    if (!this.storage) return { ok: true };
    try {
      this.storage.removeItem(SETTINGS_KEY);
      return { ok: true };
    } catch {
      return this.failed({ ok: false, reason: "unavailable" });
    }
  }
}

/**
 * The browser's localStorage, and whether it accepted a test write. Storage that reads but will not
 * write (full, or read-only) is kept so an existing game can still be continued.
 */
export function browserStorage()                                                     {
  let s                     = null;
  try {
    s = globalThis.localStorage ?? null;
    if (!s) return { storage: null, writable: false };
    const probe = "project-caine:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return { storage: s, writable: true };
  } catch {
    try {
      s?.getItem(CAMPAIGN_KEY);
      return { storage: s, writable: false };
    } catch {
      return { storage: null, writable: false };
    }
  }
}
