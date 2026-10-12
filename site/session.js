// Session: state model, input router, scripted-event queue and terminal handling.
//
// Memory boundary (connection_reset.md, john_dialogue_system.md:57–58):
//   CaineHistory  — persists across resets; what Caine/the player has experienced.
//   JohnInstance  — created fresh for every connection; what *this* John knows.
// Dialogue eligibility receives a JohnView built only from the current JohnInstance
// and the current connection. CaineHistory is never passed to it.

import { hash53, hashHex } from "./hash.js";
             
                                                                                                                                                       
                      
import { validateDialogue, validateWorld } from "./content.js";
import { matchAll } from "./matcher.js";
                                          
import { normalize } from "./normalize.js";
                                                 
import { parse, resolvePath } from "./parser.js";
                                           
import { Selector } from "./select.js";

/** Reasons a connection can end. Which of these reset versus progress is Owner gate L1-15. */
                                                                                                                                     

/** How hard a flicker hits (Owner, 2026-09-30): small (NO, minor events), medium, large (endings). */
                                                       

                    
     
                                                                                                
                                                                                                                        
                                                                                               
                                            
                                            
                    
                                                                           
                      
     
                                       
                                                                                                                                                           
                                                                                                           
                                                                               
                                                
                                                                                                    
                                          
                                                                   
                                 
                               
                                                                                      
                                               
                                                                                               
                                                                                                  
                                                                                                                                      
                                                            
                                                                            
                                              
                                                                   
                                                                                                                       
                                                            
                                                                                 
                                                             
                                                                                                                    
                                                                                       
                                                     

                              
              
                     
                       
               
                                
 

/** Persistent across resets. Developer-side log; may hold facts John must not see. */
                               
                                                                                        
                         
                                 
                                     
                                
                        
 

/** What the current John instance can draw on. Built from JohnInstance + ConnectionState only. */
                           
                     
                             
                                
                
                
 

                        
             
                     
                                 
                                   
                
                         
                              
                     
 

                           
                
              
                                                               
                
                        
                                                                      
                              
                                   
                           
                                                                              
                 
                    
                      
                                                         
                                                                                 
                       
                                                                                        
                              
                                                           
                             
                                                                                      
                         
                                                                                     
                      
                                                                                               
                     
                                                                                   
                  
 

/** The Level 1 flow, per connection: what Caine has done, so John's next beat and the moment follow. */
                     
                                                                   
                            
                                                             
                        
                                                                 
                       
                                                            
                            
                                                                                              
                  
                                             
                     
                                                               
                          
                                                                                           
                 
                 
                
                                                      
                             
                                                                                                             
                    
                  
                                                                                       
                            
                                                                                                 
                      
                                                                         
                     
                  
 

                            
                
                 
                                                                                         
                                                                                   
                                                                                      
                                                   
                                                     
                  
                                                          
                  
 

                             
                    
                   
 

                                                                                              

                                 
               
 

/**
 * The part of CaineHistory that a saved game keeps (front end, 2026-10-01): which connections
 * happened and how each ended, the files Caine has read (warnings make names live across resets) and
 * persistent scripted beats. Ask and taboo counts and the event log are developer-side and not saved.
 */
                              
                                                                                 
                      
                             
 

export const END_TRIGGERS                        = ["watcher_capture", "voluntary_exit", "fake_terminal_lockout", "exit_accepted", "name_limit", "timeout"];

export class Session {
          dialogue                 ;
          world              ;
          seed        ;
          seq = 0;
          history               = {
    connections: [], filesRead: new Set(), askCounts: new Map(), tabooAttempts: new Map(), playedPersistent: new Set(), events: [],
  };
          john               ;
          conn                  ;
          started = false;
  /** John's command-center reactions; the UI turns them off while the opening tutorial runs. */
  reactionsOn = true;
  /** Set while open enters a terminal: the only way in (cd on INPUT.EXE is refused). */
          opening = false;
  /** Engine events raised outside execute() (e.g. a secret-spilling line) for this step's scripted check. */
          stepEvents                = [];
  /** Authored clusters plus the chat events of the movement catalogue (greet, why, ...). */
          chatClusters           ;

  constructor(dialogue                 , world              , options                ) {
    validateDialogue(dialogue);
    validateWorld(world);
    this.dialogue = dialogue;
    this.world = world;
    this.seed = options.seed;
    const ev = dialogue.events;
    const lessons = dialogue.lessons;
    this.chatClusters = [
      ...dialogue.clusters,
      // John's lessons answer "how do I ..." first, once the Owner's lines are in.
      ...Object.entries(lessons?.chat ?? {}).filter(([name]) => lessons .pools[name          ]?.length)
        .map(([name, rule]) => ({ id: `lesson:${name}`, priority: rule .priority, triggers: rule .triggers, lines: lessons .pools[name          ]  })),
      ...Object.entries(ev?.chat ?? {}).map(([name, rule]) => ({ id: `event:${name}`, priority: rule .priority, triggers: rule .triggers, lines: ev .pools[name             ]  })),
    ];
  }

  // ---------------------------------------------------------------- lifecycle

  /** Begins a connection with a brand-new John instance. Requires the previous one to have ended. */
  startConnection()             {
    if (this.started && !this.conn.ended) throw new Error("current connection has not ended");
    const index = this.history.connections.length;
    const id = `john-${index}-${hashHex(`${this.seed}:${index}`).slice(-6)}`;
    this.john = {
      id,
      knows: new Set(this.dialogue.johnBaseline),
      askCounts: new Map(),
      tabooCounts: new Map(),
      state: this.dialogue.initialJohnState,
      stateLinesLeft: 0,
      lastFallback: null,
      selector: new Selector(`${this.seed}:${id}`, this.dialogue.singleLinePolicy),
    };
    this.conn = {
      index, cwd: this.world.root, terminal: null, stage: this.dialogue.initialStage, evidence: new Set(),
      flickers: { counted: 0, uncounted: 0, undecided: 0 }, playedScripted: new Set(), pendingScripted: [], ended: null,
      choice: 1, options: [...this.world.stageMap.start], committed: [], pendingCommit: null, reacted: new Set(),
      visits: new Map([[this.world.root, 1]]), names: new Map(), justCommitted: false, errorStreak: 0, eventRolls: 0,
      flow: {
        moment: null, played: new Set(), readmes: new Set(), acknowledged: new Set(), ignored: 0, topFolders: 0, terminalOpened: false,
        clue1: false, clue2: false, code: false, spoke: new Map(), screamed: false, gaveUp: false, lastLinger: null, lingers: 0, timerQuiet: false, files: new Set(),
      },
    };
    this.history.connections.push({ index, johnInstance: id, ended: null });
    const trace            = { input: "<connection start>", parsed: "lifecycle", notes: [] };
    const outputs           = [];
    const events                = [];
    // Any earlier connection, in this page or restored from a save, makes this a return after reset.
    if (index > 0) events.push({ type: "return_after_reset", data: { connection: index } });
    events.push({ type: "connection_start", data: { connection: index } });
    this.started = true;
    this.log("connection_start", { index });
    this.fireScripted(events, outputs, trace);
    return { outputs, trace };
  }

  /** What a saved game keeps of Caine's history. An open connection is reported as it stands (ended: null). */
  exportMemory()                                                                                                                                             {
    return {
      connections: this.history.connections.map((c) => ({ ...c })),
      filesRead: [...this.history.filesRead].sort(),
      playedPersistent: [...this.history.playedPersistent].sort(),
    };
  }

  /**
   * Restores Caine's memory from a saved game, before the first connection of this session. Every
   * restored connection must already have ended: the host closes an interrupted one first. The next
   * startConnection() is then a return after reset with a new John, numbered after the restored ones.
   */
  restoreMemory(memory             )       {
    if (this.started) throw new Error("restoreMemory() must come before the first connection");
    memory.connections.forEach((c, i) => {
      if (c.index !== i) throw new Error(`connection ${i} has index ${c.index}`);
      if (!END_TRIGGERS.includes(c.ended)) throw new Error(`connection ${i} has not ended`);
    });
    this.history.connections = memory.connections.map((c) => ({ ...c }));
    this.history.filesRead = new Set(memory.filesRead);
    this.history.playedPersistent = new Set(memory.playedPersistent);
    this.log("memory_restored", { connections: memory.connections.length, filesRead: memory.filesRead.length });
  }

  /** Ends the connection. Lockout and success end it automatically; capture/voluntary exit are host-driven. */
  endConnection(trigger            )       {
    if (!this.started || this.conn.ended) return;
    this.conn.ended = trigger;
    this.history.connections[this.conn.index].ended = trigger;
    this.log("connection_end", { trigger });
  }

  // ---------------------------------------------------------------- input

  input(text        )             {
    if (!this.started) throw new Error("startConnection() first");
    const trace            = { input: text, parsed: "", notes: [] };
    const outputs           = [];
    if (this.conn.ended) {
      trace.parsed = "rejected";
      return { outputs: [{ kind: "error", code: "CONNECTION_ENDED" }], trace };
    }
    this.conn.flow.lastLinger = null;

    // Scripted events that became due since the last input play first; the input is still handled.
    if (this.conn.pendingScripted.length > 0) {
      const due = this.conn.pendingScripted.splice(0);
      trace.notes.push(`delivered ${due.length} pending scripted event(s) before input; input still processed`);
      for (const s of due) this.playScripted(s, outputs, trace);
    }

    // A requested commit is confirmed only by "yes" (Owner decision). "no" just cancels; anything
    // else cancels and is then handled as ordinary input, so the confirmation never swallows a command.
    if (this.conn.pendingCommit) {
      const answer = text.trim().toLowerCase();
      const pending = this.conn.pendingCommit;
      this.conn.pendingCommit = null;
      if (answer === "yes") {
        this.confirmCommit(pending, outputs);
        this.conn.justCommitted = true;
        this.johnEvent("commit", outputs, trace);
        trace.parsed = "commit_confirmation";
        // Scripted moments 19 and 20 (Owner rewrite, 2026-10-01): a second, or a third or later, attempt.
        const attempt = this.conn.index + 1;
        if (!this.conn.ended) this.fireScripted([{ type: "commit", data: { attempt, laterAttempt: attempt >= 3 } }, ...this.stepEvents.splice(0)], outputs, trace);
        return { outputs, trace };
      }
      outputs.push({ kind: "commit_cancelled", path: pending.path });
      if (answer === "no") {
        trace.parsed = "commit_confirmation";
        return { outputs, trace };
      }
      trace.notes.push("commit cancelled by other input; input processed normally");
    }

    const parsed = parse(text, { commitVerb: this.world.stageMap.commitVerb });
    trace.parsed = parsed.kind;

    // A terminal with a fixed reply accepts only `cd ..` and `exit <code>`; a wrong code is denied like
    // at any terminal (Owner, 2026-10-01). Everything else (chat, other commands) gets that exact reply.
    // Empty input stays silent.
    const here = this.conn.terminal ? this.world.nodes[this.conn.terminal.path] : undefined;
    if (here?.type === "terminal" && here.unrecognized !== undefined && parsed.kind !== "empty") {
      const accepted = parsed.kind === "command" &&
        ((parsed.command.verb === "cd" && parsed.command.path === "..") ||
          parsed.command.verb === "exit");
      if (!accepted) {
        this.log("input", { kind: parsed.kind, text });
        // Saying a warned name is chat, so it still draws the watchers here.
        if (parsed.kind === "chat" && this.checkDanger(normalize(parsed.text), outputs, trace).captured) return { outputs, trace };
        outputs.push({ kind: "terminal_response", text: here.unrecognized });
        trace.notes.push("terminal accepts only cd .. or the correct exit code; fixed reply given");
        return { outputs, trace };
      }
    }
    this.log("input", { kind: parsed.kind, text });
    const events                = [];
    const afterCommit = this.conn.justCommitted;
    this.conn.justCommitted = false;

    switch (parsed.kind) {
      case "empty":
        outputs.push({ kind: "silence", reason: "empty input" });
        break;
      case "command":
        this.execute(parsed.command, outputs, events, trace, afterCommit);
        break;
      case "command_error":
        outputs.push({ kind: "error", code: parsed.error, detail: parsed.verb });
        this.johnEvent("invalidInput", outputs, trace);
        break;
      case "unsupported_command":
        outputs.push({ kind: "error", code: "UNSUPPORTED_COMMAND", detail: parsed.verb });
        if (!this.lesson("wrongCommand", outputs)) this.wrongCommand(parsed.verb, outputs, trace);
        trace.notes.push("verb recognized but not implemented in Phase 1; no state change");
        break;
      case "chat": {
        events.push({ type: "chat", data: {} });
        // A scripted beat waiting on the player's reply (e.g. the cold open) answers this message
        // instead of the reactive router. Watched names still count.
        if (this.chatBeatDue()) {
          trace.notes.push("scripted beat answers this chat message; router not used");
          if (this.checkDanger(normalize(parsed.text), outputs, trace).captured) return { outputs, trace };
        } else if (this.dialogue.reactions || this.dialogue.flow) {
          // The command center is not John's chat: words here are a wrong command. A live name
          // still draws the watchers; John answers questions only in his own panel.
          const danger = this.checkDanger(normalize(parsed.text), outputs, trace);
          if (danger.captured) return { outputs, trace };
          outputs.push({ kind: "error", code: "NOT_A_COMMAND", detail: parsed.text.trim().split(/\s+/)[0] });
          if (!danger.named && !this.lesson("wrongCommand", outputs)) this.wrongCommand(parsed.text.trim().split(/\s+/)[0].toLowerCase(), outputs, trace);
        } else this.route(parsed.text, outputs, trace);
        break;
      }
    }
    // Three errors in a row: the player is lost, and John may say how to find the way.
    if (outputs.some((o) => o.kind === "error")) this.conn.errorStreak++;
    else if (parsed.kind !== "empty") this.conn.errorStreak = 0;
    if (this.conn.errorStreak >= 3 && this.lesson("lost", outputs)) this.conn.errorStreak = 0;
    events.push(...this.stepEvents.splice(0));
    if (!this.conn.ended) this.fireScripted(events, outputs, trace);
    return { outputs, trace };
  }

  /**
   * A question typed in John's chat panel (Owner, 2026-09-30). Never a command: it goes to John's
   * answers (taboo, then clusters, then fallbacks). With no answer he stays silent, which the screen
   * shows as dots that start and stop. At a terminal John is absent. Watched names still count.
   */
  ask(text        )             {
    if (!this.started) throw new Error("startConnection() first");
    const trace            = { input: text, parsed: "chat", notes: ["chat panel"] };
    const outputs           = [];
    if (this.conn.ended) return { outputs: [{ kind: "error", code: "CONNECTION_ENDED" }], trace };
    if (text.trim() === "") return { outputs: [{ kind: "silence", reason: "empty input" }], trace };
    this.conn.flow.lastLinger = null;
    this.log("ask", { text });
    this.route(text, outputs, trace, true);
    const events                = [{ type: "chat", data: {} }, ...this.stepEvents.splice(0)];
    if (!this.conn.ended) this.fireScripted(events, outputs, trace);
    return { outputs, trace };
  }

  /**
   * A prepared question, clicked under John's chat line (Owner, 2026-10-01). It has no answer of its
   * own: John answers from the named cluster's pool, which rotates without repeats and is shared by
   * every question naming that cluster. At a terminal John is absent, as for typed questions.
   */
  askPrepared(question        , cluster        )             {
    if (!this.started) throw new Error("startConnection() first");
    const trace            = { input: question, parsed: "chat", notes: ["prepared question"] };
    const outputs           = [];
    if (this.conn.ended) return { outputs: [{ kind: "error", code: "CONNECTION_ENDED" }], trace };
    const pool = this.dialogue.clusters.find((c) => c.id === `C-${cluster}`);
    if (!pool) throw new Error(`no cluster ${cluster}`);
    this.conn.flow.lastLinger = null;
    this.log("ask", { text: question, prepared: cluster });
    if (this.conn.terminal) {
      trace.layer = "none";
      outputs.push({ kind: "silence", reason: "terminal" });
      return { outputs, trace };
    }
    trace.layer = "reactive";
    trace.record = `prepared:${cluster}`;
    if (!this.speakFrom(`cluster:${pool.id}`, pool.lines, 0, "reactive", outputs, trace)) outputs.push({ kind: "silence", reason: "unanswered" });
    const events                = [{ type: "chat", data: {} }, ...this.stepEvents.splice(0)];
    if (!this.conn.ended) this.fireScripted(events, outputs, trace);
    return { outputs, trace };
  }

  /** Time-based events the screen measures: no key for a while ("idle"), or a long stay in one folder ("linger"). */
  notice(kind                               )             {
    const trace            = { input: `<${kind}>`, parsed: "notice", notes: [] };
    const outputs           = [];
    if (!this.started || this.conn.ended) return { outputs, trace };
    if (kind === "linger" && this.dialogue.flow) this.linger(outputs, trace);
    else if (kind === "idle" || kind === "linger") this.johnEvent(kind, outputs, trace);
    else {
      // Final.md: at 0:00 John says "I'm sorry.", then the connection terminates.
      for (const line of this.dialogue.flow?.timer.marks["0"] ?? []) if (this.conn.terminal?.identity !== "real") this.say("timer:0", line, "timer", outputs);
      this.fail("timeout", outputs);
    }
    return { outputs, trace };
  }

  /**
   * The timer crosses a mark (Final.md, THE 10-MINUTE TIMER): John's line for it, and at 5:00, 2:00 and 1:00 a
   * glitch of 1, 2 and 3 seconds. Uncounted: a warning, not a watcher. John stays silent at the real terminal.
   * From 1:00 he speaks only at the marks.
   */
  timerMark(secondsLeft        )             {
    const trace            = { input: `<timer ${secondsLeft}>`, parsed: "notice", notes: [] };
    const outputs           = [];
    const timer = this.dialogue.flow?.timer;
    if (!this.started || this.conn.ended || !timer) return { outputs, trace };
    const mark = String(secondsLeft);
    const size = timer.glitches[mark];
    if (size) this.flicker(`timer:${mark}`, false, outputs, this.stepEvents, undefined, size, { small: 1000, medium: 2000, large: 3000 }[size]);
    if (secondsLeft <= 60) this.conn.flow.timerQuiet = true;
    if (this.conn.terminal?.identity !== "real") for (const line of timer.marks[mark] ?? []) this.say(`timer:${mark}`, line, "timer", outputs);
    return { outputs, trace };
  }

  /** The attempt fails: a large flicker, then "CONNECTION TERMINATED" and a reset. */
          fail(reason                    , out          )       {
    if (reason === "timeout") this.flicker("timer:0:00", false, out, this.stepEvents, undefined, "large");
    out.push({ kind: "outcome", outcome: "failed", reason, attempt: this.conn.index + 1 });
    this.endConnection(reason === "name" ? "name_limit" : "timeout");
  }

  // ---------------------------------------------------------------- commands

          execute(cmd         , out          , events               , trace           , afterCommit = false)       {
    const nodes = this.world.nodes;
    events.push({ type: "command", data: { verb: cmd.verb } });
    switch (cmd.verb) {
      case "dir": {
        const path = cmd.path ? resolvePath(this.world.root, this.conn.cwd, cmd.path) : this.conn.cwd;
        if (!path || !this.visible(path) || nodes[path].type === "file") {
          out.push({ kind: "error", code: "PATH_NOT_FOUND", detail: cmd.path ?? "" });
          return;
        }
        const entries = Object.entries(nodes)
          .filter(([p, n]) => p.startsWith(path + "/") && !p.slice(path.length + 1).includes("/") && this.visible(p) && !(n.type === "dir" && n.unlisted))
          .map(([p, n]) => n.type === "file"
            ? { name: p.slice(path.length + 1), type: "file"         , size: new TextEncoder().encode(n.content).length, ...(n.image ? { image: n.image } : {}), ...(n.song ? { song: n.song, title: n.content.trim() } : {}) }
            // A terminal is a program: listed as a file with its size, like any .EXE, never as <DIR>.
            : n.type === "terminal" ? { name: p.slice(path.length + 1), type: "file"         , size: PROGRAM_BYTES }
            : { name: p.slice(path.length + 1), type: "dir"          })
          .sort((a, b) => listingRank(a) - listingRank(b) || (a.name < b.name ? -1 : 1));
        out.push({ kind: "listing", path, entries });
        if (this.flowOn()) this.flowDir(path, out);
        // Songs show only in a listing, beside the folders and files (Owner, 2026-10-01); John points them out.
        if (!this.lesson("firstDir", out) && !this.songReaction(path, out)) this.react("dir", this.dialogue.reactions?.onDir, out);
        return;
      }
      case "cd": {
        if (cmd.path === ".." && this.conn.cwd === this.world.root) {
          out.push({ kind: "error", code: "ALREADY_AT_ROOT" });
          return;
        }
        const path = resolvePath(this.world.root, this.conn.cwd, cmd.path);
        const node = path && this.visible(path) ? nodes[path] : undefined;
        const teach = this.conn.terminal ? undefined : this.dialogue.teaching;
        if (!path || !node) {
          // The folder exists, just not from here: John tells Caine to go back up first.
          // Look from each folder above the current one (C:\ARCHIVE, then C:\).
          const rel = cmd.path.replace(/^[\\/]+/, "");
          let elsewhere                = null;
          for (let up = this.conn.cwd; up !== this.world.root && up.includes("/");) {
            up = up.slice(0, up.lastIndexOf("/"));
            const found = resolvePath(this.world.root, up, rel);
            if (found && this.visible(found) && nodes[found]?.type === "dir") {
              elsewhere = found;
              break;
            }
          }
          if (elsewhere && this.lesson("distantFolder", out)) return;
          if (teach && elsewhere) {
            const here = this.conn.cwd.slice(this.conn.cwd.lastIndexOf("/") + 1);
            this.say("teaching", { ...teach.cdFromWrongFolder, text: teach.cdFromWrongFolder.text.replace("{here}", here) }, "teaching", out);
            return;
          }
          out.push({ kind: "error", code: "PATH_NOT_FOUND", detail: cmd.path });
          return;
        }
        // INPUT.EXE is a file (Owner, 2026-10-06): in Level 1 cd never enters it; only open does. (The
        // engine's synthetic test worlds, with no Level 1 flow, still walk into their terminals with cd.)
        if (node.type === "terminal" && this.dialogue.flow && !this.opening) {
          out.push({ kind: "error", code: "USE_OPEN", detail: cmd.path });
          return;
        }
        // Level 1 (Owner, 2026-10-06): cd on a file says what to use instead: play for a song, type for a text or a picture.
        if (node.type === "file" && this.dialogue.flow) {
          out.push({ kind: "error", code: node.song ? "USE_PLAY" : "USE_TYPE", detail: cmd.path });
          return;
        }
        if (node.type === "file") {
          if (this.lesson("cdIntoFile", out)) return;
          if (teach) {
            const name = path.slice(path.lastIndexOf("/") + 1);
            this.say("teaching", { ...teach.cdIntoFile, text: teach.cdIntoFile.text.replace("{name}", name) }, "teaching", out);
            return;
          }
          out.push({ kind: "error", code: "NOT_A_DIRECTORY", detail: cmd.path });
          return;
        }
        // A hidden terminal can be seen once offered at the last choice, but it is entered only as
        // the separate final decision, after that choice has been committed to it. Some levels gate
        // every terminal this way (Owner tree, 2026-09-30: 30 identical INPUT.EXE).
        const gated = node.type === "terminal" && (node.hiddenUntilOffered || this.world.stageMap.terminalsOnlyByChoice);
        if (gated && !(this.inFinalDecision() && this.lastCommittedPath() === path) && !this.standingBeside(path, node)) {
          out.push({ kind: "error", code: "CHOOSE_FIRST", detail: cmd.path });
          return;
        }
        const left = this.conn.terminal;
        const from = this.conn.cwd;
        if (left) {
          trace.notes.push("left terminal before submission; retreat cost is gated (L1-14), none applied");
          events.push({ type: "command", data: { verb: "cd", leftTerminal: true } });
        }
        this.conn.cwd = path;
        this.conn.terminal = null;
        out.push({ kind: "cwd", path });
        if (node.type === "terminal") {
          // Identity is fixed in world data. Nothing read or done this session can change it.
          this.conn.terminal = { path, identity: node.identity };
          this.log("terminal_arrival", { path, identity: node.identity });
          events.push({ type: "terminal_arrival", data: { identity: node.identity } });
          // Level 1 flow: a fake terminal speaks only once Caine has the code; before, it waits like the real one.
          const speaks = this.dialogue.flow ? this.flowArrival(path, node.identity, out, events) : true;
          if (!speaks) trace.notes.push("fake terminal silent: Caine has no code yet (Level 1 flow)");
          else if (node.identity === "fake" && node.arrivalSequence) {
            // The exact locked script: lines and flickers in order. Its flickers never count (Owner).
            for (const item of node.arrivalSequence) {
              if (item.kind === "flicker") {
                this.flicker(`fake_terminal_arrival:${item.direction}`, false, out, events, undefined, /violent/i.test(item.direction) ? "large" : "medium");
                continue;
              }
              const reasons = ineligibility(item.line, this.view(), 0);
              if (reasons.length > 0) (trace.rejected ??= []).push({ lineId: item.line.id, reasons });
              else out.push({ kind: "speech", speaker: item.line.speaker, lineId: item.line.id, text: item.line.text, source: "terminal" });
            }
          } else if (node.identity === "fake") {
            // Owner decision 1: the fake arrival flicker is a tell, not a counted watcher event.
            this.flicker("fake_terminal_arrival", false, out, events, undefined, "medium");
            if (this.conn.ended) return;
            for (const line of node.arrival) {
              const reasons = ineligibility(line, this.view(), 0);
              if (reasons.length > 0) {
                (trace.rejected ??= []).push({ lineId: line.id, reasons });
                continue;
              }
              out.push({ kind: "speech", speaker: line.speaker, lineId: line.id, text: line.text, source: "terminal" });
            }
          }
          out.push({ kind: "terminal_prompt" });
        } else {
          const visits = (this.conn.visits.get(path) ?? 0) + 1;
          this.conn.visits.set(path, visits);
          if (this.flowOn()) {
            if (left) this.flowLeave(left, out);
            else this.flowEnter(path, from, out);
            return;
          }
          const onEnter = this.dialogue.reactions?.onEnter[path];
          const holdsFiles = Object.entries(nodes).some(([p, n]) => n.type === "file" && p.startsWith(path + "/") && !p.slice(path.length + 1).includes("/"));
          const taught = cmd.path === ".." ? this.lesson("firstCdUp", out) : this.lesson("firstCd", out) || (holdsFiles && this.lesson("firstFolder", out));
          if (!taught && !(onEnter && this.react(`enter:${path}`, onEnter, out))) {
            const empty = !Object.keys(nodes).some((p) => p.startsWith(path + "/") && this.visible(p));
            this.johnEvent(
              afterCommit && cmd.path === ".." ? "undo"
                : empty ? "deadEnd"
                : node.type === "dir" && node.watched ? "dangerousFolder"
                : node.type === "dir" && node.decoy ? "decoyFolder"
                : visits >= 3 ? "enterFolderRepeat" : visits === 2 ? "enterFolderAgain" : "enterNewFolder",
              out, trace);
          }
        }
        return;
      }
      case "type": {
        const path = resolvePath(this.world.root, this.conn.cwd, cmd.path);
        const node = path && this.visible(path) ? nodes[path] : undefined;
        if (!path || !node) {
          out.push({ kind: "error", code: "FILE_NOT_FOUND", detail: cmd.path });
          return;
        }
        if (node.type !== "file") {
          // A terminal is a program, not a text: say how it opens instead of "Access is denied."
          out.push({ kind: "error", code: node.type === "terminal" ? "IS_A_PROGRAM" : "NOT_A_FILE", detail: cmd.path });
          this.lesson("typeFolder", out);
          return;
        }
        if (node.song) {
          // A song file plays (Owner, 2026-10-01). Listening is as safe as reading.
          out.push(this.songOutput(path));
          this.conn.evidence.add(`read:${path}`);
          this.history.filesRead.add(path);
          return;
        }
        out.push({ kind: "file", path, content: node.content, ...(node.image ? { image: node.image } : {}) });
        const name = path.slice(path.lastIndexOf("/") + 1);
        const quiet = this.dialogue.events?.quietFiles?.includes(path);
        if (!quiet && !this.lesson("firstType", out)) this.johnEvent(
          /^WARNING/.test(name) ? "readWarning"
            : this.conn.evidence.has(`read:${path}`) ? "readFileAgain"
            : node.content.trim() === "" ? "emptyFile"
            : PHOTO.test(name) ? "findPhoto"
            : VIDEO.test(name) ? "findVideo"
            : /\.LOG$/i.test(name) || (/\.TXT$/i.test(name) && /\/LOGS(\/|$)/.test(path.slice(0, path.lastIndexOf("/")))) ? "findLog"
            : "readFile",
          out, trace);
        this.conn.evidence.add(`read:${path}`);
        this.history.filesRead.add(path);
        this.log("file_read", { path });
        events.push({ type: "file_read", data: { path, warningFile: /^WARNING_/i.test(name) } });
        if (this.flowOn()) this.flowRead(path, out);
        // Reading is always safe (Owner decision): no file raises a flicker when read.
        return;
      }
      case "help":
        out.push({ kind: "help", topic: cmd.topic });
        return;
      case "play": {
        if (cmd.path === null) {
          out.push({ kind: "song", action: "resume" });
          return;
        }
        // play [song name]: the file's name, with or without .MP3.
        const named = resolvePath(this.world.root, this.conn.cwd, cmd.path);
        const bare = named && !nodes[named] && !/\.[A-Z0-9]+$/.test(named) ? `${named}.MP3` : null;
        const path = bare && nodes[bare] ? bare : named;
        const node = path && this.visible(path) ? nodes[path] : undefined;
        if (!path || !node) {
          out.push({ kind: "error", code: "FILE_NOT_FOUND", detail: cmd.path });
          return;
        }
        if (node.type !== "file" || !node.song) {
          out.push({ kind: "error", code: "NOT_A_SONG", detail: cmd.path });
          return;
        }
        out.push(this.songOutput(path));
        this.conn.evidence.add(`read:${path}`);
        this.history.filesRead.add(path);
        return;
      }
      case "pause":
        out.push({ kind: "song", action: "pause" });
        return;
      case "open": {
        // The offered terminal: committing choice 5 and entering it are one step, with no
        // confirmation (Owner route, 2026-09-30). Once chosen, open enters it like cd.
        const path = resolvePath(this.world.root, this.conn.cwd, cmd.path);
        const node = path && this.visible(path) ? nodes[path] : undefined;
        if (!path || !node) {
          out.push({ kind: "error", code: "FILE_NOT_FOUND", detail: cmd.path });
          this.lesson("firstOpen", out);
          return;
        }
        const nodeId = this.conn.choice === this.finalChoice() ? this.conn.options.find((id) => this.world.stageMap.nodes[id].path === path) : undefined;
        if (nodeId && node.type === "terminal") this.confirmCommit({ nodeId, path }, []); // no "Chosen.": the terminal just opens
        else if (!(node.type === "terminal" && ((this.inFinalDecision() && this.lastCommittedPath() === path) || this.standingBeside(path, node)))) {
          out.push({ kind: "error", code: node.type === "terminal" ? "CHOOSE_FIRST" : "NOT_AN_OPTION", detail: cmd.path });
          this.lesson("firstOpen", out);
          return;
        }
        this.opening = true;
        try {
          this.execute({ verb: "cd", path: cmd.path }, out, events, trace);
        } finally {
          this.opening = false;
        }
        this.lesson("firstOpen", out); // silent once inside a terminal
        return;
      }
      case "commit": {
        const path = resolvePath(this.world.root, this.conn.cwd, cmd.path);
        if (this.inFinalDecision()) {
          // Every choice is spent. The separate final decision is proceed (enter the chosen
          // terminal) or retreat with cd ..; it is not another choose.
          out.push({ kind: "error", code: "FINAL_DECISION_IS_PROCEED_OR_RETREAT" });
          return;
        }
        // By path, or (where the level allows it) by the offered folder's name from anywhere.
        const byName = this.world.stageMap.chooseByName ? cmd.path.replace(/^[\\/]+|[\\/]+$/g, "").toUpperCase() : null;
        const nodeId = this.conn.options.find((id) => this.world.stageMap.nodes[id].path === path)
          ?? (byName ? this.conn.options.find((id) => this.world.stageMap.nodes[id].path.endsWith(`/${byName}`)) : undefined);
        if (!nodeId) {
          out.push({ kind: "error", code: "NOT_AN_OPTION", detail: cmd.path });
          return;
        }
        const chosen = this.world.stageMap.nodes[nodeId].path;
        this.conn.pendingCommit = { nodeId, path: chosen };
        out.push({ kind: "confirm_commit", choice: this.conn.choice, path: chosen });
        this.react(null, this.dialogue.reactions?.beforeCommit, out);
        return;
      }
      case "exit": {
        const t = this.conn.terminal;
        if (!t) {
          out.push({ kind: "error", code: "NOT_AT_TERMINAL" });
          return;
        }
        if (cmd.code !== this.world.exitCode) {
          // Real or fake, a wrong code is denied with no penalty (Owner, 2026-10-01): the trap fires only on the right code.
          out.push({ kind: "outcome", outcome: "code_rejected" });
          this.log("code_rejected", { path: t.path });
          return;
        }
        if (t.identity === "real") {
          out.push({ kind: "outcome", outcome: "exit_accepted" });
          this.endConnection("exit_accepted");
        } else {
          out.push({ kind: "outcome", outcome: "lockout", attempt: this.conn.index + 1 });
          this.endConnection("fake_terminal_lockout");
        }
        return;
      }
    }
  }

  /**
   * Raises a flicker. The watcher count stays hidden; each counted flicker is more
   * intense than the last, and reaching danger.max captures John at once (Owner decision #1).
   */
          flicker(source        , counted                , out          , events                = this.stepEvents, mention         , size              , ms         )       {
    const f = this.conn.flickers;
    if (counted === true) f.counted++;
    else if (counted === false) f.uncounted++;
    else f.undecided++;
    const max = this.dialogue.danger.max;
    const intensity = Math.min(1, Math.max(f.counted, 1) / max);
    out.push({ kind: "flicker", source, counted, intensity, ...(mention ? { mention } : {}), ...(size ? { size } : {}), ...(ms ? { ms } : {}) });
    this.log("flicker", { source, counted, count: f.counted });
    events.push({ type: "flicker", data: { source } });
    if (this.dialogue.onFlicker) {
      this.john.state = this.dialogue.onFlicker.state;
      this.john.stateLinesLeft = this.dialogue.onFlicker.forJohnLines;
    }
    if (counted === true && f.counted >= max) {
      // Scripted moment 16: John's last words, slowly, before the connection goes.
      for (const l of this.dialogue.captureLines ?? []) this.say("capture", l, "scripted", out);
      out.push({ kind: "outcome", outcome: "captured", attempt: this.conn.index + 1 });
      this.endConnection("watcher_capture");
    }
  }

          confirmCommit(pending                                  , out          )       {
    const node = this.world.stageMap.nodes[pending.nodeId];
    const choice = this.conn.choice;
    this.conn.committed.push(pending.nodeId);
    this.conn.choice = choice + 1;
    this.conn.options = [...node.next];
    // Committing choice 5 selects the terminal; entering it is the separate final decision.
    // Level data may say which choices move the player into the chosen folder.
    const moves = choice < this.finalChoice() && (this.world.stageMap.enterOnCommit?.includes(choice) ?? true);
    if (moves) this.conn.cwd = pending.path;
    this.conn.terminal = null;
    this.log("commit", { choice, node: pending.nodeId, path: pending.path });
    out.push({ kind: "committed", choice, path: pending.path, nextOptions: node.next.length });
    if (moves && this.world.stageMap.enterOnCommit) out.push({ kind: "cwd", path: pending.path });
  }

  /**
   * Mentioning a watched name or secret draws the watchers, but only after a clear warning
   * (a term marked liveBeforeWarning, "John", draws them from the first mention). Warnings live in
   * Caine's memory, so one read in any earlier attempt still counts (Owner). Negation does not help:
   * "don't say X" still says X. Commands and paths never reach here. Once the name's warning has
   * been read, John reacts with a sayName line; before that he says nothing (movement event 19).
   * `named`: a live name was said, so nothing else answers this input.
   */
          checkDanger(n            , out          , trace           )                                        {
    let named = false;
    let warned = false;
    for (const term of this.dialogue.dangerTerms) {
      if (!term.triggers.some((t) => mentions(n.tokens, t))) continue;
      const seen = this.caineHasSeen(term.warnedBy);
      if (!seen && !term.liveBeforeWarning) {
        trace.notes.push(`${term.kind} ${term.id} mentioned before its warning (${term.warnedBy}); no flicker`);
        continue;
      }
      const mention = (this.conn.names.get(term.id) ?? 0) + 1;
      this.conn.names.set(term.id, mention);
      named = true;
      warned ||= seen;
      const fails = term.failAt !== undefined && mention >= term.failAt;
      this.flicker(`${term.kind}:${term.id}`, true, out, this.stepEvents, mention, fails ? "large" : "medium");
      if (fails && !this.conn.ended) {
        // Said once too often (Owner, 2026-09-30: the third "John" ends the attempt).
        trace.notes.push(`${term.id} said ${mention} times: attempt failed`);
        this.fail("name", out);
        return { captured: true, named };
      }
      if (this.conn.ended) {
        trace.notes.push("watcher count reached its maximum: captured");
        return { captured: true, named };
      }
    }
    // Scripted moment 8 (Owner rewrite, 2026-10-01): John's name the first and the second time.
    const johnSaid = this.conn.names.get("name_john") ?? 0;
    const moment8 = named && this.dialogue.nameLines && !this.conn.terminal && (johnSaid === 1 || johnSaid === 2) && n.tokens.length > 0 &&
      this.dialogue.dangerTerms.some((t) => t.id === "name_john" && t.triggers.some((tr) => mentions(n.tokens, tr)));
    if (moment8) for (const l of johnSaid === 1 ? this.dialogue.nameLines .first : this.dialogue.nameLines .second) this.say("name", l, "scripted", out);
    else if (warned) this.johnEvent("sayName", out, trace, true);
    return { captured: false, named };
  }

  /** A word the command center does not know: John's lesson once, then the catalogue (undo after a commit). */
          wrongCommand(verb        , out          , trace           )       {
    if (UNDO_WORDS.has(verb) && this.conn.committed.length > 0) this.johnEvent("undo", out, trace);
    else if (!this.react("notACommand", this.dialogue.reactions?.notACommand, out)) this.johnEvent("invalidInput", out, trace);
  }

  /** John reacts in the chat panel. Keyed reactions play once per connection; null keys every time. */
          react(key               , line                  , out          )          {
    if (!line || !this.reactionsOn || this.conn.terminal) return false;
    if (key) {
      if (this.conn.reacted.has(key)) return false;
      this.conn.reacted.add(key);
    }
    this.say("reaction", line, "reaction", out);
    return true;
  }

  /**
   * John teaches a move (Owner, 2026-09-30). Lessons outrank the fixed reactions and the movement
   * catalogue; "first*" lessons play once per connection; a lesson with no lines yet says nothing.
   * Never during the opening tutorial and never at a terminal. Returns true if John spoke.
   */
          lesson(name        , out          )          {
    const lines = this.dialogue.lessons?.pools[name];
    if (!lines?.length || !this.reactionsOn || this.conn.terminal) return false;
    if (out.some((o) => o.kind === "speech" && o.speaker === "john")) return false;
    const key = `lesson:${name}`;
    if (name.startsWith("first")) {
      if (this.conn.reacted.has(key)) return false;
      this.conn.reacted.add(key);
    }
    const { line } = this.john.selector.select(key, lines.filter((l) => ineligibility(l, this.view(), 0).length === 0));
    if (!line) return false;
    this.say(key, line, "teaching", out);
    return true;
  }

  /**
   * John may speak after something the player did (Owner, 2026-09-30): often, not always, and at
   * most one John line per action. Never during the opening tutorial and never at a terminal.
   */
          johnEvent(name           , out          , trace           , always = false)       {
    const lines = this.dialogue.events?.pools[name];
    if (!this.reactionsOn || this.conn.terminal || !lines?.length) return;
    if (out.some((o) => o.kind === "speech" && o.speaker === "john")) return;
    const roll = (hash53(`${this.seed}:${this.john.id}:event:${this.conn.eventRolls++}`) % 10000) / 10000;
    if (!always && roll >= this.dialogue.events .chance) {
      trace.notes.push(`event ${name}: John stays quiet this time`);
      return;
    }
    const eligible = lines.filter((l) => ineligibility(l, this.view(), 0).length === 0);
    const { line, reason } = this.john.selector.select(`event:${name}`, eligible);
    if (!line) {
      trace.notes.push(`event ${name}: ${reason}`);
      return;
    }
    this.say(`event:${name}`, line, "event", out);
    trace.notes.push(`event ${name}: ${line.id} (${reason})`);
  }

  /**
   * A folder with songs (Owner, 2026-10-01): the screen offers them, and John points them out once per
   * folder; the first time in a connection he adds the tip. Returns true if John spoke (his line for this move).
   */
  /** John on a song in a folder's listing: the found line, with the tip the first time in a connection. */
          songReaction(path        , out          )          {
    if (this.songsIn(path).length === 0) return false;
    const lines = this.dialogue.songs;
    if (!lines) return false;
    const first = ![...this.conn.reacted].some((k) => k.startsWith("song:"));
    return this.react(`song:${path}`, first ? { ...lines.found, then: lines.tip.text } : lines.found, out);
  }

  /** The songs directly inside a folder that Caine can see. */
          songsIn(folder        )                                                       {
    return Object.entries(this.world.nodes)
      .filter(([p, n]) => n.type === "file" && n.song && p.startsWith(folder + "/") && !p.slice(folder.length + 1).includes("/") && this.visible(p))
      .map(([p, n]) => ({ path: p, song: (n                    ).song, title: (n                       ).content.trim() }))
      .sort((a, b) => (a.path < b.path ? -1 : 1));
  }

          songOutput(path        )         {
    const n = this.world.nodes[path]                                     ;
    return { kind: "song", action: "play", path, song: n.song, title: n.content.trim() };
  }

  /** Whether Caine has ever seen a warning: "read:<path>" flags use his cross-reset memory. */
          caineHasSeen(flag        )          {
    return flag.startsWith("read:") ? this.history.filesRead.has(flag.slice("read:".length)) : this.conn.evidence.has(flag);
  }

  /** After five commits the player is at the separate final proceed-or-cd .. decision. */
          inFinalDecision()          {
    return this.conn.choice > this.finalChoice();
  }

  /**
   * Standing in a terminal's own folder, Caine can enter it (Owner bug report, 2026-10-01: "The player
   * should be able to enter REAL at choice 5. No other conditions."). Walking there with cd is enough;
   * the choices are no longer required first. Hidden terminals stay hidden until offered.
   */
          standingBeside(path        , node      )          {
    return node.type === "terminal" && !node.hiddenUntilOffered && path.slice(0, path.lastIndexOf("/")) === this.conn.cwd;
  }

  /** The last choice: the one that picks a terminal (5 unless the stage map's shape says otherwise). */
          finalChoice()         {
    return this.world.stageMap.shape?.length ?? 5;
  }

          lastCommittedPath()                {
    const id = this.conn.committed[this.conn.committed.length - 1];
    return id ? this.world.stageMap.nodes[id].path : null;
  }

  /**
   * Hidden terminals (and anything beneath them) do not exist for the player until they are
   * the choice-5 option on the committed route, and stay visible once chosen at choice 5.
   */
          visible(path        )          {
    if (!this.world.nodes[path]) return false;
    for (const [p, n] of Object.entries(this.world.nodes)) {
      if (n.type !== "terminal" || !n.hiddenUntilOffered) continue;
      if (path !== p && !path.startsWith(p + "/")) continue;
      const offered = this.conn.choice === this.finalChoice() && this.conn.options.some((id) => this.world.stageMap.nodes[id].path === p);
      const chosen = this.inFinalDecision() && this.lastCommittedPath() === p;
      if (!offered && !chosen) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- dialogue

          view()           {
    return { instanceId: this.john.id, knows: this.john.knows, evidence: this.conn.evidence, stage: this.conn.stage, state: this.john.state };
  }

          route(text        , out          , trace           , fromChatPanel = false)       {
    const n = normalize(text);
    trace.normalized = { tokens: n.tokens, removed: n.removed, negations: n.negations };

    const danger = this.checkDanger(n, out, trace);
    if (danger.captured) return;
    // A live name is answered by the movement catalogue's event 19, or by silence, and nothing else.
    if (danger.named && (this.dialogue.events || this.dialogue.flow)) {
      trace.layer = "none";
      if (!out.some((o) => o.kind === "speech")) out.push({ kind: "silence", reason: "name" });
      return;
    }

    if (this.conn.terminal) {
      trace.layer = "none";
      trace.notes.push("John is absent at terminals; no line, no ellipsis");
      out.push({ kind: "silence", reason: "terminal" });
      return;
    }

    const summarize =                            (ms                 ) =>
      ms.map((m) => ({ id: m.record.id, trigger: m.trigger, priority: m.record.priority, length: m.length }));

    const taboo = matchAll(n, this.dialogue.taboos);
    const clusters = matchAll(n, this.chatClusters);
    trace.taboo = summarize(taboo.ranked);
    trace.clusters = summarize(clusters.ranked);
    trace.negated = [...taboo.negated, ...clusters.negated].map((m) => ({ id: m.record.id, trigger: m.trigger }));

    // Layer 1 of input routing: taboo outranks any overlapping reactive or fallback intent.
    if (taboo.ranked.length > 0) {
      const t = taboo.ranked[0].record;
      trace.layer = "taboo";
      trace.record = t.id;
      this.john.tabooCounts.set(t.id, (this.john.tabooCounts.get(t.id) ?? 0) + 1);
      this.history.tabooAttempts.set(t.id, (this.history.tabooAttempts.get(t.id) ?? 0) + 1);
      this.log("taboo", { id: t.id });
      const spoke = this.speakFrom(`taboo:${t.id}`, t.lines, this.john.tabooCounts.get(t.id) , "taboo", out, trace);
      // A matched taboo never falls through: a reactive answer could expose the protected fact.
      if (!spoke) out.push({ kind: "silence", reason: "taboo matched; no eligible deflect" });
      return;
    }

    if (clusters.ranked.length > 0) {
      // Only the top-ranked intent is tried; trying the next one would silently change intent.
      const c = clusters.ranked[0].record;
      trace.layer = "reactive";
      trace.record = c.id;
      const ask = (this.john.askCounts.get(c.id) ?? 0) + 1;
      this.john.askCounts.set(c.id, ask);
      this.history.askCounts.set(c.id, (this.history.askCounts.get(c.id) ?? 0) + 1);
      this.log("cluster", { id: c.id, askThisConnection: ask });
      if (this.speakFrom(`cluster:${c.id}`, c.lines, ask, "reactive", out, trace)) {
        for (const fact of c.teaches ?? []) this.john.knows.add(fact);
        if (c.teaches?.length) trace.notes.push(`John learned this connection: ${c.teaches.join(", ")}`);
        return;
      }
      trace.notes.push(`cluster ${c.id} matched but had no eligible line; using fallback`);
    }

    trace.layer = "fallback";
    // The catalogue's randomInput pool answers anything else in John's chat: he is never silent.
    const fb = this.dialogue.events?.fallback;
    if (fromChatPanel && fb && this.speakFrom(`event:${fb}`, this.dialogue.events .pools[fb] , 0, "fallback", out, trace)) {
      trace.record = fb;
      return;
    }
    if (!this.speakFallback(out, trace)) {
      trace.layer = "none";
      if (fromChatPanel) out.push({ kind: "silence", reason: "unanswered" });
      else if (this.reactionsOn && this.dialogue.reactions) {
        // In the command center, typed words that are not commands are answered as a wrong command.
        out.push({ kind: "error", code: "NOT_A_COMMAND", detail: text.trim().split(/\s+/)[0] });
        if (!this.react("notACommand", this.dialogue.reactions.notACommand, out)) this.johnEvent("invalidInput", out, trace);
      } else out.push({ kind: "silence", reason: "no eligible fallback" });
    }
  }

          speakFallback(out          , trace           )          {
    const order = this.dialogue.fallbackOrder;
    const start = this.john.lastFallback ? order.indexOf(this.john.lastFallback) + 1 : 0;
    for (let i = 0; i < order.length; i++) {
      const id = order[(start + i) % order.length];
      const category = this.dialogue.fallbacks.find((f                  ) => f.id === id);
      if (!category) continue;
      if (this.speakFrom(`fallback:${id}`, category.lines, 0, "fallback", out, trace)) {
        trace.record = id;
        this.john.lastFallback = id;
        this.log("fallback", { category: id });
        return true;
      }
    }
    return false;
  }

  /** Selects and speaks one eligible line from a pool. Returns false if nothing was said. */
          speakFrom(poolKey        , lines        , ask        , source                                   , out          , trace           )          {
    const eligible         = [];
    for (const line of lines) {
      const reasons = ineligibility(line, this.view(), ask);
      if (reasons.length === 0) eligible.push(line);
      else (trace.rejected ??= []).push({ lineId: line.id, reasons });
    }
    const { line, reason } = this.john.selector.select(poolKey, eligible);
    if (!line) {
      trace.notes.push(`${poolKey}: ${reason}`);
      return false;
    }
    this.say(poolKey, line, source, out);
    trace.notes.push(`${poolKey}: ${line.id} (${reason})`);
    return true;
  }

          say(poolKey        , line      , source                                                                                              , out          )       {
    if (this.conn.flow.timerQuiet && source !== "timer") {
      this.log("john_quiet", { lineId: line.id, reason: "timer below 1:00" });
      return;
    }
    this.john.selector.commit(poolKey, line);
    out.push({
      kind: "speech", speaker: "john", lineId: line.id, text: line.text, source, johnState: this.john.state,
      ...(line.delivery ? { delivery: line.delivery } : {}),
      ...(line.then ? { then: line.then } : {}),
      ...(line.waitMs ? { waitMs: line.waitMs } : {}),
    });
    this.log("john_line", { lineId: line.id, source });
    if (this.john.stateLinesLeft > 0 && --this.john.stateLinesLeft === 0) this.john.state = this.dialogue.initialJohnState;
    if (line.effects?.flicker) this.flicker(`spoken:${line.id}`, line.effects.flicker.counted, out);
  }

  // ---------------------------------------------------------------- scripted events

  /** Whether a scripted event is waiting on the player's next chat message. */
          chatBeatDue()          {
    return this.dialogue.scripted.some((s) => s.on === "chat" && !this.alreadyPlayed(s) && this.afterSatisfied(s));
  }

          afterSatisfied(s               )          {
    return !s.after || this.conn.playedScripted.has(s.after) || this.history.playedPersistent.has(s.after);
  }

          fireScripted(events               , out          , trace           , depth = 0)       {
    if (depth > 3) return;
    for (const event of events) {
      // Decide what is due before playing anything, so a chain of "after" beats advances one step per event.
      let due = this.dialogue.scripted.filter((s) =>
        s.on === event.type &&
        (!s.when || Object.entries(s.when).every(([k, v]) => event.data[k] === v)) &&
        !this.alreadyPlayed(s) &&
        this.afterSatisfied(s));
      // One beat per action (Owner rewrite, 2026-10-01): a moment tied to this very thing (TELL.TXT, a
      // warning) outranks the general one (the first file read), which then counts as played.
      if (due.some((s) => s.when) && due.some((s) => !s.when)) {
        for (const s of due.filter((d) => !d.when)) this.markPlayed(s);
        due = due.filter((s) => s.when);
      }
      for (const s of due) {
        if (s.delivery === "before_next_input") {
          if (!this.conn.pendingScripted.some((pending) => pending.id === s.id)) {
            this.conn.pendingScripted.push(s);
            trace.notes.push(`scripted ${s.id} queued for next input`);
          }
        } else this.playScripted(s, out, trace, depth);
      }
    }
  }

          alreadyPlayed(s               )          {
    return s.scope === "persistent" ? this.history.playedPersistent.has(s.id) : this.conn.playedScripted.has(s.id);
  }

          markPlayed(s               )       {
    if (s.scope === "persistent") this.history.playedPersistent.add(s.id);
    else this.conn.playedScripted.add(s.id);
  }

          playScripted(s               , out          , trace           , depth = 0)       {
    const allowed         = [];
    for (const line of s.lines) {
      if (this.conn.terminal?.identity === "real") {
        trace.notes.push(`scripted ${s.id}/${line.id} suppressed: the real terminal is silent`);
        continue;
      }
      const reasons = ineligibility(line, this.view(), 0);
      if (reasons.length > 0) (trace.rejected ??= []).push({ lineId: line.id, reasons });
      else allowed.push(line);
    }
    if (allowed.length === 0) {
      trace.notes.push(`scripted ${s.id} blocked: no allowed line; no effects applied`);
      return;
    }
    this.markPlayed(s);
    this.log("scripted", { id: s.id });
    // A scripted moment takes the place of the movement catalogue's line for the same action.
    for (let i = out.length - 1; i >= 0; i--) {
      const o = out[i];
      if (o.kind === "speech" && o.source === "event") out.splice(i, 1);
    }
    for (const line of allowed) {
      if (line.speaker === "john") this.say(`scripted:${s.id}`, line, "scripted", out);
      else out.push({ kind: "speech", speaker: line.speaker, lineId: line.id, text: line.text, source: "scripted" });
    }
    const e = s.effects;
    if (e?.setStage) this.conn.stage = e.setStage;
    for (const fact of e?.johnLearns ?? []) this.john.knows.add(fact);
    if (e?.flicker) {
      const follow                = [];
      this.flicker(`scripted:${s.id}`, e.flicker.counted, out, follow);
      this.fireScripted(follow, out, trace, depth + 1);
    }
  }

  // ---------------------------------------------------------------- Level 1 flow (Owner, 2026-10-03)
  // The locked flow (docs/05_levels/level_01/level-01-flow-2026-10-03.md, levels/level_01/flow.json):
  // after the opening, John speaks only these beats, each where the script puts it. The moment they
  // set chooses the prepared questions and the linger pool. Never during the opening (the tutorial
  // speaks for John), and John never speaks at the real terminal.

  /** The moment of the flow now: its prepared questions and linger pool. */
  moment()                    {
    return this.started ? this.conn.flow.moment : null;
  }

  /** The opening moves the moment on as it goes (Stage 1, Moments 5–7). */
  setMoment(moment            )       {
    this.conn.flow.moment = moment;
    this.conn.flow.lastLinger = null;
  }

          flowOn()          {
    return !!this.dialogue.flow && this.reactionsOn;
  }

          beat(name          , out          , once = true, number         )       {
    const f = this.conn.flow;
    if (once && f.played.has(name)) return;
    f.played.add(name);
    const word = number === undefined ? "" : NUMBER_WORDS[number] ?? String(number);
    for (const line of this.dialogue.flow .beats[name]) {
      const text = line.text.replace("{number}", word).replace("{Number}", word.charAt(0).toUpperCase() + word.slice(1));
      this.say(`beat:${name}`, { ...line, text }, "scripted", out);
    }
  }

          archive()         {
    return `${this.world.root}/ARCHIVE`;
  }

  /** Folders below ARCHIVE: 0 for ARCHIVE itself, 1 for CLOCK, 4 for the deepest (a terminal's folder). */
          depth(path        )         {
    const a = this.archive();
    return path === a ? 0 : path.startsWith(a + "/") ? path.slice(a.length + 1).split("/").length : -1;
  }

          subfolders(path        )         {
    return Object.entries(this.world.nodes).filter(([p, n]) => n.type === "dir" && p.startsWith(path + "/") && !p.slice(path.length + 1).includes("/") && this.visible(p)).length;
  }

  /** Caine walks into a folder (not out of a terminal). */
          flowEnter(path        , from        , out          )       {
    const f = this.conn.flow;
    const flow = this.dialogue.flow ;
    const d = this.depth(path);
    if (f.code) {
      // Stage 4, Moment 1: the code found, Caine moves on.
      if (!f.played.has("goingBack")) {
        this.beat("goingBack", out);
        f.moment = "s4m1";
      }
      return;
    }
    if (f.clue1) {
      // Stage 3: the search. Only the clues' folders get a line.
      if (path === this.archive() && !f.played.has("backAtTop")) {
        this.beat("backAtTop", out);
        f.moment = "s3m1";
      } else if (f.clue2 && this.clue3Folders().includes(path) && !f.played.has("clue2Folder")) {
        this.beat("clue2Folder", out);
        f.moment = "s3m3";
      } else if (!f.clue2 && flow.clue2Folders.includes(path) && !f.played.has("clue1Folder")) {
        this.beat("clue1Folder", out);
        f.moment = "s3m1";
      }
      return;
    }
    // Stage 2: the first descent. Going back up says nothing; the moment follows the depth. The Owner's
    // tree (2026-10-04): top folders hold 3 folders, then 2, then 2; the deepest hold a terminal.
    const down = path.startsWith(from + "/");
    if (!down) {
      f.moment = this.hasTerminal(path) ? "s2m6" : (["s1m7", "s2m4", "s2m4", "s2m5"]         )[d] ?? f.moment;
      return;
    }
    if (d >= 2 && !f.readmes.has(from)) {
      f.ignored++;
      if (f.ignored === 1) this.beat("readmeIgnored", out);
      else if (f.ignored === 2) this.beat("deepestIgnored", out);
    }
    if (d === 1) {
      f.topFolders++;
      if (f.topFolders === 1) {
        this.beat("enterFirstFolder", out);
        f.moment = "s2m2";
      } else {
        this.beat("descent", out, true, this.subfolders(path));
        f.moment = "s2m4";
      }
    } else if (d === 2) {
      this.beat("descent", out, true, this.subfolders(path));
      f.moment = "s2m4";
    } else if (d === 3) {
      this.beat("deepest", out);
      f.moment = "s2m5";
    }
    // A terminal in the folder (every deepest folder, and UNSORTED\TERMINAL\REAL).
    if (this.hasTerminal(path)) {
      this.beat("terminalHere", out);
      f.moment = "s2m6";
    }
  }

          hasTerminal(path        )          {
    return Object.entries(this.world.nodes).some(([p, n]) => n.type === "terminal" && p.slice(0, p.lastIndexOf("/")) === path && this.visible(p));
  }

          flowDir(path        , out          )       {
    const f = this.conn.flow;
    if (f.clue1 || this.depth(path) !== 1 || f.readmes.has(path)) return;
    // Stage 2, Moments 2 and 3: the README is in the listing.
    if (!f.played.has("readmeVisible")) this.beat("readmeVisible", out);
    else this.beat("readmeFirst", out);
    f.moment = "s2m3";
  }

          flowRead(path        , out          )       {
    const f = this.conn.flow;
    const flow = this.dialogue.flow ;
    const folder = path.slice(0, path.lastIndexOf("/"));
    if (flow.clue3Files.includes(path)) {
      // Stage 3, Moment 4: the clock and the riddle. Caine has the code.
      this.beat("clue3Found", out);
      f.code = true;
      f.moment = "s3m4";
      return;
    }
    if (path === flow.clockPhoto) {
      // The primary code placement: the clock itself. Whoever finds it does not need the riddle.
      this.beat("clockPhoto", out);
      if (!f.code) f.moment = "s3m4";
      f.code = true;
      return;
    }
    // John on a picture or a 1993 document, the first time it is opened in this connection.
    const lines = flow.files[path];
    if (lines) {
      if (!f.files.has(path)) {
        f.files.add(path);
        for (const l of lines) this.say(`file:${path}`, l, "scripted", out);
      }
      return;
    }
    if (flow.clue2Files.includes(path)) {
      // Stage 3, Moment 2: Clue 2, a file of its own in one of the 12 folders. Found out of order, it still counts.
      if (!f.code && !f.clue2) {
        this.beat("clue2Found", out);
        f.moment = "s3m2";
      }
      f.clue1 = true;
      f.clue2 = true;
      return;
    }
    if (!/\/README\.TXT$/i.test(path)) return;
    const again = f.readmes.has(folder);
    f.readmes.add(folder);
    const d = this.depth(folder);
    if (f.code) return;
    if (flow.clue1Folders.includes(folder)) {
      // The deepest README holds Clue 1. Before any terminal, Situation B begins (Stage 2, Moment 8); after one,
      // John sees the clue (Final.md M13); read again, the search begins (Stages.md, Stage 2 Moment 9).
      if (!f.terminalOpened) {
        this.beat("readmeBeforeTerminal", out);
        f.moment = "s2m6";
      } else if (!f.clue1) {
        this.beat("clue1Read", out);
        f.moment = "s2m9";
      } else if (again && !f.played.has("backAtTop")) {
        this.beat("searchBegins", out);
        f.moment = "s2m9";
      }
      f.clue1 = true;
      return;
    }
    if (f.clue1 || f.acknowledged.has(folder) || d < 1 || d > 3) return;
    f.acknowledged.add(folder);
    if (d < 3) {
      this.beat("readmeRead", out, false, this.subfolders(folder));
      f.moment = "s2m3";
    } else {
      this.beat("deepestRead", out, false);
      f.moment = "s2m5";
    }
  }

  /** Caine opens a terminal. Returns whether a fake terminal speaks its script (only once Caine has the code). */
          flowArrival(path        , identity                 , out          , events               )          {
    const f = this.conn.flow;
    if (identity === "real") {
      // The real terminal is silent, and so is John there.
      f.terminalOpened = true;
      if (f.code) f.played.add("goingBack");
      return false;
    }
    if (!f.code) {
      // Stage 2, Moments 7 and 8: the first terminal asks for a code Caine does not have.
      if (!f.terminalOpened && this.reactionsOn) {
        const folder = path.slice(0, path.lastIndexOf("/"));
        if (f.readmes.has(folder)) {
          this.beat("codeNeeded", out);
          f.moment = "s2m8";
        } else {
          this.beat("noCode", out);
          f.moment = "s2m7";
        }
      }
      f.terminalOpened = true;
      return false;
    }
    // Stage 4, Moment 3: the fake terminal speaks. Back at the same one, John screams, once; the line breaks off.
    // Caine is at a terminal already: "Going back to the terminal?" has nothing left to ask.
    f.played.add("goingBack");
    const n = (f.spoke.get(path) ?? 0) + 1;
    f.spoke.set(path, n);
    if (n >= 2) {
      if (!f.screamed) {
        f.screamed = true;
        this.beat("sameFakeTerminal", out);
        this.flicker("john_cut", false, out, events, undefined, "medium");
      } else f.gaveUp = true;
    }
    return true;
  }

  /** Caine leaves a terminal with cd .. */
          flowLeave(t                                             , out          )       {
    const f = this.conn.flow;
    if (t.identity === "fake" && f.code && f.spoke.has(t.path)) {
      // Stage 4, Moment 4: he escaped. Unless John has given up.
      if (!f.gaveUp) this.beat("escaped", out, false);
      f.moment = "s4m1";
    } else if (f.moment === "s2m7") f.moment = "s2m3";
  }

          clue3Folders()           {
    return this.dialogue.flow .clue3Files.map((p) => p.slice(0, p.lastIndexOf("/")));
  }

  /**
   * Six seconds without typing (Owner, 2026-10-03): John repeats the current instruction, a line from the
   * moment's pool, never the same one twice in a row. Not at the real terminal, nor while a fake one speaks.
   */
          linger(out          , trace           )       {
    const f = this.conn.flow;
    const t = this.conn.terminal;
    if (!f.moment || (t && (t.identity === "real" || f.spoke.has(t.path)))) return;
    const pool = this.dialogue.flow .moments[f.moment].linger.filter((l) => l.text !== f.lastLinger);
    if (pool.length === 0) {
      trace.notes.push(`linger ${f.moment}: no other line`);
      return;
    }
    const line = pool[hash53(`${this.seed}:${this.john.id}:linger:${f.lingers++}`) % pool.length];
    f.lastLinger = line.text;
    this.say(`linger:${f.moment}`, line, "scripted", out);
  }

  // ---------------------------------------------------------------- views and log

          log(type        , data                         )       {
    this.history.events.push({ seq: this.seq++, connection: this.conn?.index ?? -1, johnInstance: this.john?.id ?? "", type, data });
  }

  /** Read-only snapshot of Caine's persistent history (developer/QA use). */
  caineHistory()                         {
    return this.history;
  }

  /** Snapshot of the current John instance, for tests and trace output. */
  johnSnapshot() {
    return {
      id: this.john.id,
      knows: [...this.john.knows].sort(),
      askCounts: Object.fromEntries(this.john.askCounts),
      tabooCounts: Object.fromEntries(this.john.tabooCounts),
      state: this.john.state,
      spokenLines: this.john.selector.spokenCount,
    };
  }

  /**
   * Folder steps from where Caine is to the nearest folder holding a terminal he can see: 0 inside
   * such a folder or at a terminal, 1 one folder away, and so on (null if none is visible). The
   * screen uses it only for how strongly the glass glitches (Owner, 2026-10-01). Real and fake
   * terminals count alike, hidden ones not at all, and it never touches the danger count.
   */
  terminalDistance()                {
    if (this.conn.terminal) return 0;
    const here = this.conn.cwd.split("/");
    let best                = null;
    for (const [p, n] of Object.entries(this.world.nodes)) {
      if (n.type !== "terminal" || !this.visible(p)) continue;
      const folder = p.slice(0, p.lastIndexOf("/")).split("/");
      let shared = 0;
      while (shared < here.length && shared < folder.length && here[shared] === folder[shared]) shared++;
      const steps = here.length - shared + (folder.length - shared);
      if (best === null || steps < best) best = steps;
    }
    return best;
  }

  connectionSnapshot() {
    return {
      index: this.conn.index,
      cwd: this.conn.cwd,
      atTerminal: this.conn.terminal !== null,
      stage: this.conn.stage,
      evidence: [...this.conn.evidence].sort(),
      flickers: { ...this.conn.flickers },
      ended: this.conn.ended,
      choice: this.conn.choice,
      finalDecision: this.inFinalDecision(),
      committed: [...this.conn.committed],
      options: this.conn.options.map((id) => this.world.stageMap.nodes[id].path),
    };
  }
}

/** "{number} folders" in John's lines. */
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** The size `dir` gives every INPUT.EXE (all thirty alike, so size never tells real from fake). */
const PROGRAM_BYTES = 45056;

/**
 * A listing's order (Owner, 2026-10-06): folders, then text files, pictures, songs and programs, each
 * group alphabetical. A file with no extension (READ_ME_NOW!) is a text file.
 */
function listingRank(e                                                                       )         {
  if (e.type === "dir") return 0;
  if (e.song || /\.MP3$/i.test(e.name)) return 3;
  if (/\.EXE$/i.test(e.name)) return 4;
  if (e.image || PHOTO.test(e.name)) return 2;
  return 1;
}

/** What counts as a photo or a video when the player finds one in a listing. */
const PHOTO = /\.(JPG|JPEG|BMP|GIF|PNG|TIF)$/i;
const VIDEO = /\.(MP4|AVI|MPG|MPEG|MOV|WMV|ASF)$/i;
/** Words that try to take back a commit. */
const UNDO_WORDS = new Set(["undo", "uncommit", "unchoose", "revert", "rollback"]);

/** True if the trigger's tokens occur contiguously, regardless of negation or clause. */
function mentions(tokens          , trigger        )          {
  const t = normalize(trigger).tokens;
  for (let i = 0; i + t.length <= tokens.length; i++) if (t.every((w, j) => tokens[i + j] === w)) return true;
  return false;
}

/** Why a line may not be spoken now. Takes only the current John view: no cross-reset history. */
export function ineligibility(line      , view          , ask        )           {
  const reasons           = [];
  const g = line.gates ?? {};
  if (line.disposition !== "approved") reasons.push(`disposition ${line.disposition}`);
  if (g.stages && !g.stages.includes(view.stage)) reasons.push(`stage ${view.stage} not in [${g.stages}]`);
  if (g.johnStates && !g.johnStates.includes(view.state)) reasons.push(`john state ${view.state} not in [${g.johnStates}]`);
  for (const fact of g.johnKnows ?? []) if (!view.knows.has(fact)) reasons.push(`john does not know ${fact}`);
  for (const flag of g.evidence ?? []) if (!view.evidence.has(flag)) reasons.push(`no evidence ${flag} this connection`);
  if (g.ask === "first" && ask !== 1) reasons.push(`ask gate first; this is ask ${ask} this connection`);
  if (g.ask === "repeat" && ask < 2) reasons.push(`ask gate repeat; this is ask ${ask} this connection`);
  return reasons;
}
