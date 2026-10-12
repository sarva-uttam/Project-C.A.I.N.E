// The player's Archive (Owner, 2026-10-01): every song, photo and document met in the game, kept in
// this browser under its own key. It is memory, not progress, and it never clears (Owner, locked
// 2026-10-01): not by New Game, not by a reset, not by any player action; only by the player deleting
// the browser's storage. It records which files were found and when each level's archive was last
// opened (for the new-discovery dot), never their text; the screen shows them from the game's own data.

export const ARCHIVE_KEY = "project-caine:archive";
export const ARCHIVE_SCHEMA = 1;

                                                        
export const ARCHIVE_KINDS                         = ["song", "photo", "document"];

                              
                    
                                                                                   
               
                
                                            
                
 

/** When each level's archive was last opened (ISO time), keyed by level number. */
                                                   

                                                                                                               

const PATH = /^[A-Z]:(\/[A-Z0-9_.!]+)+$/;

function isItem(v         )                   {
  if (typeof v !== "object" || v === null) return false;
  const i = v                           ;
  return ARCHIVE_KINDS.includes(i.kind               ) && typeof i.path === "string" && PATH.test(i.path)
    && typeof i.level === "number" && Number.isInteger(i.level) && i.level >= 1 && i.level <= 100
    && typeof i.found === "string" && !Number.isNaN(Date.parse(i.found));
}

/**
 * Reads the stored Archive. Items that do not check out are dropped one by one; a record that is
 * not an Archive at all (or from a newer version) is unreadable and is left alone.
 */
export function parseArchive(text               )              {
  if (text === null) return { kind: "ok", items: [], opened: {} };
  let raw         ;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: "unreadable" };
  }
  if (typeof raw !== "object" || raw === null || (raw                        ).schema !== ARCHIVE_SCHEMA || !Array.isArray((raw                       ).items)) {
    return { kind: "unreadable" };
  }
  const seen = new Set        ();
  const items = ((raw                        ).items).filter(isItem).filter((i) => !seen.has(i.path) && seen.add(i.path) !== undefined);
  const rawOpened = (raw                        ).opened;
  const opened                = {};
  if (typeof rawOpened === "object" && rawOpened !== null && !Array.isArray(rawOpened)) {
    for (const [level, at] of Object.entries(rawOpened)) if (/^\d{1,3}$/.test(level) && typeof at === "string" && !Number.isNaN(Date.parse(at))) opened[level] = at;
  }
  return { kind: "ok", items, opened };
}

export function serializeArchive(items                        , opened                = {})         {
  return JSON.stringify({ schema: ARCHIVE_SCHEMA, items, opened });
}

/** New discoveries in a level: something found after the level's archive was last opened. */
export function hasNewInLevel(items                        , opened               , level        )          {
  const at = opened[String(level)];
  return items.some((i) => i.level === level && (!at || Date.parse(i.found) > Date.parse(at)));
}

/** Adds an item unless that file is already there (the first find is kept). */
export function addToArchive(items                        , item             )                {
  return items.some((i) => i.path === item.path) ? [...items] : [...items, item];
}
