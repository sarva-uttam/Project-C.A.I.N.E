// The level catalogue: 100 positions, of which only the shipped ones can be played. The catalogue
// does not promise 100 finished levels. Unrevealed names show as "???"; nothing about a future
// level (name, date, story) is stated. The save's unlock list is advisory: a level that is not
// shipped stays unavailable whatever the save claims.

export const LEVEL_COUNT = 100;

                             
             
                                                                  
                       
                                                          
                       
 

/** Level 1's name comes from docs/04_mechanics/dialogue_engine_spec.md ("First Contact"). */
const SHIPPED                         = { 1: "FIRST CONTACT" };

export const LEVELS                        = Array.from({ length: LEVEL_COUNT }, (_, i) => {
  const id = i + 1;
  return { id, title: SHIPPED[id] ?? null, implemented: id in SHIPPED };
});

                                                                               

                                
                                                                      
                              
                               
 

export function isLevelId(id         )               {
  return typeof id === "number" && Number.isInteger(id) && id >= 1 && id <= LEVEL_COUNT;
}

export function levelStatus(id        , progress               , registry                        = LEVELS)              {
  const entry = registry.find((l) => l.id === id);
  if (!entry || !entry.implemented) return "unavailable";
  if (progress.completed.includes(id)) return "completed";
  if (id === 1 || progress.unlocked.includes(id)) return "available";
  return "locked";
}

/** Only an available or completed level can be launched, through the UI or any direct call. */
export function canLaunch(id        , progress               , registry                        = LEVELS)          {
  const s = levelStatus(id, progress, registry);
  return s === "available" || s === "completed";
}

/** "001" for Level 1. */
export function levelNumber(id        )         {
  return String(id).padStart(3, "0");
}
