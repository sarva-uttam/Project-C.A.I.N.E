// Dialogue and world content contracts, plus the Phase 1 load guard.
// Phase 1 accepts SYNTHETIC_FIXTURE content only. The submitted Level 1
// catalogue (reactive/fallback/taboo/scripted/design notes) is never loaded.

                                              

                                                         
/** Only "approved" lines are eligible to be spoken. */
                                                                

                            
                                                                           
                    
                                                                               
                        
                                                                                  
                       
                                                                                              
                      
                                                                     
                           
 

                       
             
               
                   
                           
                    
                                                                                    
                      
                                                                                          
                    
                                                                                                           
                
                                                                                         
                  
                                                                                                
                                                      
 

/**
 * A name or secret whose mention in chat draws the watchers (Owner decision #1).
 * Danger is tied to clearly warned actions: a mention flickers only once Caine has read the
 * warning, in this attempt or any earlier one. Only chat counts; commands and paths are
 * always safe, even when they contain the name (Owner, 2026-09-29).
 */
                             
             
                          
                     
                                                                                                 
                                                                                                
                   
                                                                                                
                                                              
                              
                                                                                                      
                  
 

/** Hidden watcher count. Never displayed; felt through flicker intensity (Owner decision #1). */
                             
                                                                                          
              
                   
 

                                            
                
                                                                                                     
                     
 

                                          
                                                               
                        
                
 

                                   
             
                
 

                             
                      
             
               
                      
             
                        
                                                         
          
                                                                                                           
             

                                
             
                      
                                                                  
                                                   
                                                                                         
                                     
                                                                                               
                                                                                                           
                                               
                                                                                               
                 
                
             
                      
                                   
                          
    
 

/** Player actions John may react to (Owner, 2026-09-30). Triggers are defined in session.ts. */
export const JOHN_EVENTS = [
  "enterNewFolder", "enterFolderAgain", "enterFolderRepeat", "readFile", "readFileAgain", "readWarning", "deadEnd",
  "decoyFolder", "dangerousFolder", "linger", "invalidInput", "idle", "findPhoto", "findVideo", "findLog", "emptyFile",
  "commit", "undo", "sayName", "askWhatToDo", "greet", "insult", "askWhy", "askOkay", "randomInput",
]         ;
                                                     

/** John teaches how to move (Owner, 2026-09-30). "first*" lessons play once per connection. */
export const LESSONS = [
  "firstDir", "firstCd", "firstCdUp", "firstType", "firstOpen", "firstFolder", "lost", "wrongCommand", "cdIntoFile",
  "typeFolder", "distantFolder", "askHelp", "askHowRead", "askHowMove", "askWhereAmI", "askHowBack", "askHowPicture",
  "askHowChoose", "askHowCode", "askHowQuit",
]         ;
                                              

/** Most lines one event pool may hold (Owner: 5 to 10 each). */
export const EVENT_POOL_MAX = 10;

                              
                     
                                   
                                                 

                                  
                                                                                                 
                                                 
                    
                       
                           
                                                                                                          
                                                            
                                                                 
                         
                       
                                     
     
                                                                                                
                                                                                                
                                          
     
                                                           
                                                                                               
                                     
     
                                                                                         
                                                                          
     
                    
                                                                                                                   
                          
                                                                                  
               
                                              
                
                                                                            
                                  
                                                                      
                      
                                               
                       
    
     
                                                                                                   
                                                                                                     
                                                                                                     
                                                                                                        
     
            
                   
                                              
                                                                                
                         
                                                                                                            
                          
    
     
                                                                                                    
                                                                                                     
     
                                                 
                                                                                                 
                                                                                                                                 
                                                                                                                               
                    
                                                                                                                    
                                                
                                                                                     
                        
                                                                                                                         
                    
                     
                            
                          
                  
                      
                                
                            
 

                  
                                                                                                   
                                                                                              
                                                                           
                                                                                                         
                                                                                                     
                                                                    
     
                       
                                
                      
                                                                                                 
                                      
                                                                                                       
                                   
         
                                                                                                 
                                                                                                   
         
                            
      

/**
 * The five shrinking choices as data. Browsing with cd is free; a separate
 * confirmed commit spends a choice (Owner decision #2). Options may be shared
 * between branches, so a scattered cross-folder route is expressible without
 * committing to a 120-leaf tree. The authored Level 1 map is still pending (L1-04).
 */
                           
                                                                                     
                     
                                                                                             
                                                        
                   
                                                                                                
                         
                                                                                                    
                                  
                                                                                                   
                                                                                                       
                           
                                                 
                  
                                                                                                    
                                                                                             
 

                                                                                                

                               
                                                                                          
                                             
                  
               
                                                                                        
                   
                              
                     
 

/** One step of the locked opening. Directions are internal: they drive effects and are never shown. */
                         
                               
                                                                               
                                                                                                    
                                             
                                                                                    
     
                                                                                            
                                                                                                   
                                                                      
   
                                                                                     
                                        
                                                                                                          
                                                                                                                    
     
                                                                                                                                      
                                              
   
                                                                                                   
                                      
                                                    
                                                                             

/** John's beats in play (Level 1 flow, Owner 2026-10-03, Stages 2–4). session.ts decides when each plays. */
export const FLOW_BEATS = [
  "enterFirstFolder", "readmeVisible", "readmeFirst", "readmeRead", "readmeIgnored", "descent", "deepest", "deepestRead",
  "deepestIgnored", "terminalHere", "noCode", "readmeBeforeTerminal", "clue1Read", "codeNeeded", "searchBegins", "backAtTop", "clue1Folder",
  "clue2Found", "clue2Folder", "clue3Found", "clockPhoto", "goingBack", "sameFakeTerminal", "escaped",
]         ;
                                                   

/** The moments of Level 1 that carry prepared questions or a linger pool (Owner, 2026-10-03). */
export const FLOW_MOMENTS = [
  "s1m2", "s1m3", "s1m5", "s1m6", "s1m7", "s2m2", "s2m3", "s2m4", "s2m5", "s2m6", "s2m7", "s2m8", "s2m9", "s3m1", "s3m2", "s3m3", "s3m4", "s4m1",
]         ;
                                                       

                             
                                  
                                                                                                                     
                                                                                             
                                                                                                                     
                                                                                                         
                                                                                               
                         
                       
                         
                       
                                                                                                                          
                     
                                                                                                                       
                                                                                                   
                                                                                                        
                                                             
                                
                                                                                                                                 
                                              
 

export class ContentError extends Error {}

const LOCKED_CODE_FORMS = [/1\s*[:.]?\s*1\s*[:.]?\s*4\s*[:.]?\s*7/];

export function validateDialogue(c                 )       {
  if (c.status !== "SYNTHETIC_FIXTURE" && c.status !== "OWNER_APPROVED") {
    throw new ContentError("dialogue must be SYNTHETIC_FIXTURE or OWNER_APPROVED; unreviewed pools are never loaded");
  }
  const approvedOnly = c.status === "OWNER_APPROVED";
  const ids = new Set        ();
  const lineIds = new Set        ();
  const checkLines = (owner        , lines        ) => {
    for (const l of lines) {
      if (lineIds.has(l.id)) throw new ContentError(`duplicate line id ${l.id}`);
      lineIds.add(l.id);
      if (!["approved", "candidate", "rejected"].includes(l.disposition)) throw new ContentError(`${l.id}: bad disposition`);
      if (!["john", "fake_terminal", "caine"].includes(l.speaker)) throw new ContentError(`${l.id}: bad speaker`);
      for (const s of l.gates?.johnStates ?? []) if (!c.johnStates.includes(s)) throw new ContentError(`${l.id}: unknown state ${s}`);
      if (!approvedOnly && LOCKED_CODE_FORMS.some((re) => re.test(l.text))) throw new ContentError(`${l.id}: fixture text may not carry the Level 1 code`);
      if (approvedOnly && (l.disposition !== "approved" || !l.approvedBy)) {
        throw new ContentError(`${l.id}: OWNER_APPROVED content holds only approved lines with an approvedBy record`);
      }
      if (typeof l.text !== "string") throw new ContentError(`${owner}/${l.id}: text required`);
    }
  };
  for (const group of [c.taboos, c.clusters]) {
    for (const r of group) {
      if (ids.has(r.id)) throw new ContentError(`duplicate record id ${r.id}`);
      ids.add(r.id);
      if (!Number.isInteger(r.priority)) throw new ContentError(`${r.id}: integer priority required`);
      if (r.triggers.length === 0) throw new ContentError(`${r.id}: triggers required`);
      checkLines(r.id, r.lines);
    }
  }
  for (const f of c.fallbacks) {
    if (!c.fallbackOrder.includes(f.id)) throw new ContentError(`fallback ${f.id} missing from fallbackOrder`);
    checkLines(f.id, f.lines);
  }
  if (c.teaching) checkLines("teaching", [c.teaching.cdIntoFile, c.teaching.cdFromWrongFolder]);
  if (c.reactions) checkLines("reactions", [c.reactions.onDir, c.reactions.notACommand, c.reactions.beforeCommit, ...Object.values(c.reactions.onEnter)]);
  if (c.events) {
    if (!(c.events.chance >= 0 && c.events.chance <= 1)) throw new ContentError("events.chance must be between 0 and 1");
    for (const [name, lines] of Object.entries(c.events.pools)) {
      if (!(JOHN_EVENTS                     ).includes(name)) throw new ContentError(`unknown John event ${name}`);
      if (lines .length > EVENT_POOL_MAX) throw new ContentError(`event ${name} holds ${lines .length} lines; at most ${EVENT_POOL_MAX}`);
      checkLines(`event:${name}`, lines );
      for (const l of lines ) if (l.speaker !== "john") throw new ContentError(`${l.id}: event lines are John's`);
    }
    for (const [name, rule] of Object.entries(c.events.chat ?? {})) {
      if (!c.events.pools[name             ]?.length) throw new ContentError(`chat event ${name} has no lines`);
      if (!Number.isInteger(rule .priority) || rule .triggers.length === 0) throw new ContentError(`chat event ${name}: priority and triggers required`);
    }
    if (c.events.fallback && !c.events.pools[c.events.fallback]?.length) throw new ContentError(`fallback pool ${c.events.fallback} has no lines`);
  }
  if (c.lessons) {
    for (const [name, lines] of Object.entries(c.lessons.pools)) {
      if (!(LESSONS                     ).includes(name)) throw new ContentError(`unknown lesson ${name}`);
      if (lines .length > 3) throw new ContentError(`lesson ${name} holds ${lines .length} lines; at most 3`);
      checkLines(`lesson:${name}`, lines );
    }
    for (const name of Object.keys(c.lessons.chat ?? {})) if (!(LESSONS                     ).includes(name)) throw new ContentError(`unknown lesson ${name}`);
  }
  if (c.timer?.twoMinutes) checkLines("timer", [c.timer.twoMinutes]);
  if (c.flow) {
    for (const beat of FLOW_BEATS) {
      if (!c.flow.beats[beat]?.length) throw new ContentError(`flow beat ${beat} has no lines`);
      checkLines(`beat:${beat}`, c.flow.beats[beat]);
    }
    for (const [mark, lines] of Object.entries(c.flow.timer.marks)) checkLines(`timer:${mark}`, lines);
    for (const [path, lines] of Object.entries(c.flow.files)) checkLines(`file:${path}`, lines);
    for (const moment of FLOW_MOMENTS) {
      const m = c.flow.moments[moment];
      if (!m) throw new ContentError(`flow moment ${moment} is missing`);
      for (const q of m.prepared) if (!c.clusters.some((r) => r.id === `C-${q.cluster}`)) throw new ContentError(`prepared question "${q.text}" names missing cluster ${q.cluster}`);
      checkLines(`linger:${moment}`, m.linger);
    }
  }
  if (c.nameLines) checkLines("nameLines", [...c.nameLines.first, ...c.nameLines.second]);
  if (c.captureLines) checkLines("captureLines", c.captureLines);
  if (c.returnLine) checkLines("returnLine", [c.returnLine]);
  if (c.opening) {
    const said = c.opening.flatMap((s) => (s.kind === "say" ? [s.line] : []));
    checkLines("opening", said);
    if (!c.opening.some((s) => s.kind === "choice" || s.kind === "reply")) throw new ContentError("the opening needs the player's answer");
    if (!c.opening.some((s) => s.kind === "openCommandCenter")) throw new ContentError("the opening must open the command center");
    for (const s of c.opening) if (s.kind === "moment" && !(FLOW_MOMENTS                     ).includes(s.moment)) throw new ContentError(`opening names unknown moment ${s.moment}`);
  }
  if (c.cutscene) {
    checkLines("cutscene", c.cutscene);
    for (const l of c.cutscene) {
      if (l.speaker !== "john" || l.disposition !== "approved") throw new ContentError(`${l.id}: the cutscene holds only approved John lines`);
    }
  }
  for (const s of c.scripted) {
    checkLines(s.id, s.lines);
    // Owner decision 1: scripted flickers (the two opening flickers included) never count toward capture.
    if (s.effects?.flicker && s.effects.flicker.counted !== false) throw new ContentError(`${s.id}: scripted flickers must have counted: false`);
  }
  if (!c.johnStates.includes(c.initialJohnState)) throw new ContentError("initialJohnState not in johnStates");
  if (!Number.isInteger(c.danger?.max) || c.danger.max < 1 || c.danger.onMax !== "capture") throw new ContentError("danger.max must be a positive integer with onMax capture");
  for (const t of c.dangerTerms) {
    if (t.triggers.length === 0 || !t.warnedBy) throw new ContentError(`danger term ${t.id}: triggers and warnedBy required`);
  }
  if (c.onFlicker && !c.johnStates.includes(c.onFlicker.state)) throw new ContentError("onFlicker.state not in johnStates");
}

export function validateWorld(w              )       {
  if (w.status !== "SYNTHETIC_FIXTURE" && w.status !== "LEVEL_DATA") throw new ContentError("world must be SYNTHETIC_FIXTURE or LEVEL_DATA");
  if (!w.nodes[w.root] || w.nodes[w.root].type !== "dir") throw new ContentError("root must be a directory node");
  if (w.status === "SYNTHETIC_FIXTURE" && LOCKED_CODE_FORMS.some((re) => re.test(w.exitCode))) throw new ContentError("fixture exitCode may not be the Level 1 code");
  for (const [path, node] of Object.entries(w.nodes)) {
    if (path !== w.root && !path.startsWith(w.root + "/")) throw new ContentError(`${path} is outside root`);
    if (!/^[A-Z]:(\/[A-Z0-9_.!]+)*$/.test(path)) throw new ContentError(`unsafe virtual path ${path}`);
    // Owner decision: reading is safe. No file may flicker when read; risky actions are authored separately.
    if (node.type === "file" && "risk" in node) throw new ContentError(`${path}: reading a file never causes a flicker`);
    if (node.type === "terminal") {
      for (const l of node.arrival) if (l.speaker === "john") throw new ContentError(`${path}: terminals cannot carry John speech`);
      if (node.identity === "real" && (node.arrival.length > 0 || node.arrivalSequence)) throw new ContentError(`${path}: the real terminal is silent on arrival`);
      for (const item of node.arrivalSequence ?? []) {
        if (item.kind === "line" && item.line.speaker !== "fake_terminal") throw new ContentError(`${path}: terminals cannot carry John speech`);
      }
      if (node.arrivalSequence && node.arrival.length > 0) throw new ContentError(`${path}: use arrival or arrivalSequence, not both`);
      if (node.unrecognized !== undefined && (typeof node.unrecognized !== "string" || node.unrecognized.trim() === "")) {
        throw new ContentError(`${path}: unrecognized reply must be non-empty text`);
      }
    }
  }
  validateStageMap(w);
}

/** Every reachable route must offer 5, 4, 3, 2 options, then exactly one terminal. */
function validateStageMap(w              )       {
  checkStageMap(w.stageMap, (path) => w.nodes[path]?.type);
  for (const [path, node] of Object.entries(w.nodes)) {
    if (node.type === "terminal" && node.hiddenUntilOffered && !Object.values(w.stageMap.nodes).some((n) => n.path === path)) {
      throw new ContentError(`${path} is hidden until offered but no stage node offers it`);
    }
  }
}

/**
 * Structural check of a stage map on its own, so route data can be validated before
 * any archive content exists. `typeOf` reports what kind of node a path is.
 */
export function checkStageMap(m          , typeOf                                            )       {
  const shape = m?.shape ?? [5, 4, 3, 2, 1];
  const last = shape.length;
  if (shape[last - 1] !== 1 || shape.some((n) => !Number.isInteger(n) || n < 1)) throw new ContentError("stageMap.shape must end with a single terminal");
  if (!m || !/^[a-z]+$/.test(m.commitVerb)) throw new ContentError("stageMap.commitVerb must be a lowercase word");
  if (["dir", "cd", "chdir", "type", "exit"].includes(m.commitVerb)) throw new ContentError("commitVerb cannot reuse a navigation verb");
  const walk = (ids          , choice        , trail        ) => {
    const expected = shape[choice - 1];
    if (ids.length !== expected) throw new ContentError(`choice ${choice} after ${trail || "start"} offers ${ids.length} options, expected ${expected}`);
    for (const id of ids) {
      const n = m.nodes[id];
      if (!n) throw new ContentError(`stage node ${id} is not defined`);
      const type = typeOf(n.path);
      if (!type) throw new ContentError(`stage node ${id} path ${n.path} is not in the world`);
      if (choice === last) {
        if (type !== "terminal" || n.next.length !== 0) throw new ContentError(`choice ${last} option ${id} must be a terminal with no next`);
      } else {
        if (type !== "dir") throw new ContentError(`choice ${choice} option ${id} must be a folder`);
        walk(n.next, choice + 1, `${trail}/${id}`);
      }
    }
  };
  walk(m.start, 1, "");
}
