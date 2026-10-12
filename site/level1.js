// Assembles Level 1 from the authored files in levels/level_01/. Only authored, approved or
// locked content is used; placeholders are left out and listed in `incomplete`.
// Pure: takes the parsed files, so it runs in Node (level1-node.ts) and in the browser build.

                                                                                                                                                                

                     
                                    
                   
                       
                             
                               
                        
 

                         
                            
                      
                                                                          
                       
 

/** The parsed contents of levels/level_01/*.json, keyed by file name. */
                                              

export const LEVEL1_FILES = [
  "level.json", "stage-map.json", "dialogue.json", "danger-terms.json", "fake-terminal.json",
  "unsorted.json", "names-warnings.json", "clock.json", "home.json", "work.json", "names.json", "clue-list.json",
  "archive.json", "flow.json",
];

/** The Owner's Level 1 package (2026-10-04), built by scripts/build-archive.ts. */
                       
                 
               
                       
                                                                                              
                                
                                                             
                                     
                                   
                       
                                                                       
                                                                                                                                      
 

export function assembleLevel1FromData(files             )         {
  const read = (file        ) => {
    if (!(file in files)) throw new Error(`missing level file ${file}`);
    return files[file];
  };
  const level = read("level.json");
  const route = read("stage-map.json")                          ;
  const dialogue = read("dialogue.json")                   ;
  const danger = read("danger-terms.json")                                 ;
  const fake = read("fake-terminal.json")                                      ;
  const archive = read("archive.json")               ;

  const nodes                       = { [level.root]: { type: "dir" } };
  // C:\ holds only ARCHIVE (Owner, 2026-09-30); the five folders live inside it.
  if (level.archive) nodes[level.archive] = { type: "dir" };
  const incomplete           = [];
  const addDirs = (path        ) => {
    const parts = path.split("/");
    for (let i = 2; i <= parts.length; i++) nodes[parts.slice(0, i).join("/")] ??= { type: "dir" };
  };

  // The Owner's package (2026-10-04) is the tree: every folder, README.TXT, terminal, clue, picture and
  // document. Its folders hold every folder of the earlier tree, so the earlier files that are not
  // superseded stay where they were: the logs, notes and warnings, and the real terminal itself.
  for (const [path, n] of Object.entries(archive.nodes)) {
    if (n.type === "dir") addDirs(path);
    else {
      addDirs(path.slice(0, path.lastIndexOf("/")));
      nodes[path] = n.type === "file" ? { ...n } : { type: "terminal", identity: "fake", arrival: [], arrivalSequence: fake.arrivalSequence };
    }
  }
  for (const file of ["unsorted.json", "names-warnings.json", "clock.json", "home.json", "work.json", "names.json"]) {
    for (const [path, n] of Object.entries(read(file).nodes                             )) {
      if (n.placeholder) {
        incomplete.push(`${path} (placeholder)`);
        continue;
      }
      if (n.type === "dir" || nodes[path] || /\/README\.TXT$/.test(path)) continue; // the package's READMEs and files win
      if (!nodes[path.slice(0, path.lastIndexOf("/"))]) {
        incomplete.push(`${path} (its folder is not in the Owner's tree)`);
        continue;
      }
      if (n.type === "file") nodes[path] = { type: "file", content: n.content  };
      else if (path === archive.realTerminal) nodes[path] = { type: "terminal", identity: "real", arrival: [], unrecognized: n.unrecognized };
    }
  }
  if (nodes[archive.realTerminal]?.type !== "terminal") throw new Error("the real terminal is missing");
  for (const folder of level.unbuiltFolders            ) incomplete.push(`${folder} contents (not built)`);
  // Songs (Owner, 2026-10-04): a music file in a folder; typing or playing it plays the song.
  for (const [path, s] of Object.entries(archive.songs)) {
    addDirs(path.slice(0, path.lastIndexOf("/")));
    nodes[path] = { type: "file", content: `${s.title}\n`, song: s.song };
  }
  // A folder holding a decoy file (clue list) is a decoy folder: John's movement catalogue event 8.
  const clues = read("clue-list.json")                                                  ;
  for (const file of Object.values(clues.decoysInUnsorted).flat()) {
    const dir = nodes[file.slice(0, file.lastIndexOf("/"))];
    if (nodes[file] && dir?.type === "dir") dir.decoy = true;
  }

  const flow = buildFlow(read("flow.json")            , nodes, archive);

  return {
    dialogue: { ...dialogue, dangerTerms: danger.dangerTerms, opening: flow.opening, flow: flow.flow },
    world: { status: "LEVEL_DATA", worldId: "level-01", root: level.root, exitCode: level.exitCode, nodes, stageMap: route.stageMap },
    incomplete,
  };
}

// ---------------------------------------------------------------- the locked flow (Owner, 2026-10-03)

                                                  
               
                                                                                               
                                                                                               
                                                                                                                     
                                                                                   
                    
                 
                      
                                                 
                                                                                                                       
                                                                
                                                                                                     
                                                  
                                                   
                                              
 

/**
 * Level 1 dialogue: the Locked Flow (docs/05_levels/level_01/level-01-flow-2026-10-03.md, the package's
 * Stages.md) with Final.md's table as master (Owner package, 2026-10-04): the opening, John's beats, the
 * prepared questions and linger pools, the fake terminal's script. The READMEs and the clue chain come
 * from archive.json.
 */
function buildFlow(f          , nodes                      , archive             )                                               {
  const approvedBy = `Owner, Level 1 Locked Flow 2026-10-03 (${f.source})`;
  const line = (id        , t                   , speaker                  = "john")       => {
    const { text, waitMs } = typeof t === "string" ? { text: t, waitMs: undefined } : t;
    return { id, speaker, disposition: "approved", approvedBy, text, ...(waitMs ? { waitMs } : {}) };
  };
  let n = 0;
  const opening                = f.opening.map((s)              => {
    const direction = ("direction" in s && s.direction) || "";
    if ("say" in s) return { kind: "say", line: { ...line(`F-OP-${++n}`, s.say), ...(s.slow ? { delivery: "slow"          } : {}) } };
    if ("pause" in s) return { kind: "pause", ms: s.pause, cursor: "blink", direction };
    if ("flicker" in s) return { kind: "flicker", size: s.flicker, ms: s.ms, atWord: s.atWord, direction };
    if ("choice" in s) {
      return {
        kind: "choice", text: s.choice.join("\n"), ...(s.refusal ? { refusal: s.refusal } : {}),
        options: [{ accept: ["1", "yes", "y"], continues: true }, { accept: ["2", "no", "n"], continues: false }],
      };
    }
    if ("openCommandCenter" in s) return { kind: "openCommandCenter", direction };
    if ("moment" in s) return { kind: "moment", moment: s.moment };
    return { kind: "await", command: s.await, thenList: s.thenList ?? false, direction };
  });
  const beats = Object.fromEntries(Object.entries(f.beats).map(([name, b]) => [name, b.lines.map((t, i) => line(`F-${name}-${i + 1}`, t))]))                            ;
  const moments = Object.fromEntries(Object.entries(f.moments).map(([id, m]) =>
    [id, { title: m.title, prepared: m.prepared, linger: m.linger.map((t, i) => line(`F-linger-${id}-${i + 1}`, t)) }]))                         ;

  // The fake terminal's script (Stage 4, Moment 3), at every fake terminal. Its flickers never count.
  let k = 0;
  const script                = f.fakeTerminal.script.flatMap((item)                => typeof item === "string"
    ? [{ kind: "line", line: line(`F-FAKE-${++k}`, item, "fake_terminal") }]
    : Array.from({ length: item.flicker }, () => ({ kind: "flicker"         , direction: "Flicker." })));
  for (const node of Object.values(nodes)) {
    if (node.type === "terminal" && node.identity === "fake") {
      node.arrival = [];
      node.arrivalSequence = script;
    }
  }

  return {
    opening,
    flow: {
      beats, moments,
      // The clue chain (Owner package, 2026-10-04): Clue 1 in each deepest README, Clue 2 in 12 named files,
      // Clue 3 (the riddle) in 3 files beside the clock pictures.
      clue1Folders: Object.keys(archive.clue1).sort(),
      clue2Files: Object.keys(archive.clue2Files).sort(),
      clue2Folders: [...new Set(Object.keys(archive.clue2Files).map((p) => p.slice(0, p.lastIndexOf("/"))))].sort(),
      clue3Files: [...archive.clue3Files].sort(),
      clockPhoto: `${archive.root}/UNSORTED/PHOTOS/CLUE/PHOTO_11_47.JPG`,
      timer: {
        marks: Object.fromEntries(Object.entries(f.timer.marks).map(([m, lines]) => [m, lines.map((t, i) => line(`F-timer-${m}-${i + 1}`, t))])),
        glitches: f.timer.glitches,
      },
      files: Object.fromEntries(Object.entries({ ...f.pictures.lines, ...f.documents.lines }).map(([path, lines]) => {
        if (nodes[path]?.type !== "file") throw new Error(`John's line for ${path}, which is not a file`);
        const name = path.slice(path.lastIndexOf("/") + 1).replace(/\W/g, "_");
        return [path, lines.map((t, i) => line(`F-file-${name}-${i + 1}`, t))];
      })),
      ...(f.resume ? { resume: { lines: [...f.resume.lines], after: f.resume.after } } : {}),
    },
  };
}
