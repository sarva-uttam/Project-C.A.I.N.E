// Turns engine outputs into screen instructions: what to print, how fast John types, when the
// screen flickers, which sound plays. Pure and deterministic, so the screen's behaviour is testable
// without a browser. Speeds and colour roles follow the Owner's interface brief (2026-09-30).

                                                        
import { ARCHIVE_DATE, CHOICE_TEXT, CODE_DENIED, ERROR_TEXT, RESET_TIME, helpText, unsupportedText } from "./ui-text.js";

/** "Wake up Caine." and a frightened John: letter by letter. */
export const JOHN_SLOW_MS = 300;
/** Every other John line: readable. */
export const JOHN_NORMAL_MS = 45;
export const DOT_MS = 300;
/** The pause before the second part of a two-part John line. */
export const THEN_MS = 1400;
/** The fake terminal floods: fast, no pauses. */
export const FAKE_MS = 8;

/** "john" and "caine" go to the chat panel; everything else to the command center. */
                                                                                                           
                                                                                       


                         
                                             
                                                                                              
                        
                                                                 
                                               
                                                                                                     
                                                                                  
                                                    
                                                                                                    
                                                                                              
                                                                                               
                                                                            
                                                                               
                                                                             
                                                                                  
                                                                                                 
                                                                                               
                                                                                                                                                                                
                                                        
                                                                             
                                              

                                
                                  
                               
                   
                                                                                                    
                   
                                          
                  
                                                                          
                                                                                                      
                                                                                        
                                                                               

/** What a listed entry is, for its icon. Terminals (INPUT.EXE) are programs. */
                                                                            

                                                                                                                                            

                          
                           
                        
                                                                                                                
                      
                                                                                 
                        
 

export const ENDING_LINE_MS = 1200;

/** The CMD-style prompt for a virtual path. At a terminal the path ends in INPUT.EXE, as in the
 *  Owner's route (2026-10-03): C:\ARCHIVE\UNSORTED\TERMINAL\REAL\INPUT.EXE> */
/** A folder's prompt is its path; a terminal's is a bare ">" (Owner, 2026-10-06; was its path, 2026-10-03). */
export function promptFor(cwd        , atTerminal = false)         {
  return atTerminal ? ">" : winPath(cwd) + ">";
}

/** "C:" is shown as "C:\\"; "C:/ARCHIVE/CLOCK" as "C:\\ARCHIVE\\CLOCK". */
function winPath(p        )         {
  const w = p.replace(/\//g, "\\");
  return /^[A-Z]:$/.test(w) ? w + "\\" : w;
}

/** An old command-prompt directory listing, with <DIR> for folders and byte sizes for files. */
export function formatListing(path        , entries                                                              )         {
  const rows = [" Volume in drive C has no label.", "", ` Directory of ${winPath(path)}`, ""];
  let files = 0;
  let bytes = 0;
  for (const e of entries) {
    if (e.type === "dir") rows.push(`${ARCHIVE_DATE}    <DIR>          ${e.name}`);
    else {
      files++;
      bytes += e.size ?? 0;
      rows.push(`${ARCHIVE_DATE}    ${String((e.size ?? 0).toLocaleString("en-US")).padStart(14)} ${e.name}`);
    }
  }
  const dirs = entries.length - files;
  rows.push(`${String(files).padStart(16)} File(s) ${bytes.toLocaleString("en-US").padStart(14)} bytes`);
  rows.push(`${String(dirs).padStart(16)} Dir(s)`);
  return rows.join("\n");
}

export const FLICKER_MAX = 20;

/**
 * How hard a flicker hits (Owner, 2026-09-30). The engine names the size where it knows it (a spoken
 * name, the fake terminal, the timer); a counted flicker is medium; a story flicker is small unless
 * its locked direction says "Longer" (medium) or "Violently" (large).
 */
export function glitchSize(o                                                                 )              {
  if (o.size) return o.size;
  if (o.counted === true) return "medium";
  return /violent/i.test(o.source) ? "large" : /longer/i.test(o.source) ? "medium" : "small";
}

function flicker(size             , ms         )                {
  return [{ op: "glitch", size, ...(ms ? { ms } : {}) }];
}

function ending(items              )                {
  const out                = [];
  let gap = false;
  for (const item of items) {
    if (item.kind === "line") out.push({ op: "print", text: item.text, style: "ending" }, { op: "pause", ms: ENDING_LINE_MS });
    // A gap on each side of an absence is one blank line on screen (the locked route, Owner 2026-10-06).
    else if (item.kind === "gap") {
      if (!gap) out.push({ op: "print", text: "", style: "ending" });
    } else if (item.kind === "flicker" || item.kind === "invert") out.push(...flicker(/violent/i.test(item.direction) ? "large" : "medium"));
    // "direction" items (for example "[No flicker.]") describe an absence; nothing is shown.
    gap = item.kind === "gap" || (gap && item.kind === "direction");
  }
  return out;
}

/** An ending's words without its closing "Connection Terminated.": the death sequence says it, once (Owner, 2026-10-06). */
function withoutClosing(items              )               {
  const out = [...items];
  while (out.length > 0 && (out[out.length - 1].kind === "gap" || (out[out.length - 1]                     ).text === "Connection Terminated.")) out.pop();
  return out;
}

export function present(outputs          , endings         )                {
  const out                = [];
  const fakeArrival = outputs.some((o) => o.kind === "speech" && o.speaker === "fake_terminal");
  let cwd = "";
  for (const o of outputs) {
    switch (o.kind) {
      case "speech":
        if (o.speaker === "john") {
          const slow = o.delivery === "slow" || o.johnState === "frightened";
          const ms = slow ? JOHN_SLOW_MS : JOHN_NORMAL_MS;
          // The script's "Wait N seconds" between John's lines (Level 1 flow, Owner 2026-10-03).
          if (o.waitMs) out.push({ op: "pause", ms: o.waitMs });
          out.push({ op: "dots", count: 3, ms: DOT_MS }, { op: "type", text: o.text, style: "john", msPerChar: ms });
          if (o.then) out.push({ op: "pause", ms: THEN_MS }, { op: "type", text: o.then, style: "john", msPerChar: ms });
        } else {
          out.push({ op: "type", text: o.text, style: "fake", msPerChar: FAKE_MS });
        }
        break;
      case "silence":
        if (o.reason === "unanswered") out.push({ op: "unanswered" });
        break;
      case "listing": {
        const songs = o.entries.filter((e) => e.song).map((e) => ({ name: e.name, song: e.song , title: e.title ?? e.name, path: `${o.path}/${e.name}` }));
        const entries = o.entries.map((e) => ({
          name: e.name,
          kind: (e.song ? "song" : e.image ? "picture" : /\.EXE$/i.test(e.name) ? "program" : e.type === "dir" ? "folder" : "file")              ,
        }));
        out.push({ op: "listing", text: formatListing(o.path, o.entries), path: o.path, songs, entries });
        const pictures = o.entries.filter((e) => e.image).map((e) => ({ name: e.name, image: e.image , path: `${o.path}/${e.name}` }));
        if (pictures.length > 0) out.push({ op: "gallery", items: pictures });
        break;
      }
      case "song":
        out.push(o.action === "play" ? { op: "song", action: "play", song: o.song, title: o.title, path: o.path } : { op: "song", action: o.action });
        break;
      case "file": {
        // Opened like a manual page: file name as the header, folder path as the title.
        const name = o.path.slice(o.path.lastIndexOf("/") + 1);
        if (o.image) {
          out.push({ op: "sound", name: "rustle" }, { op: "image", name, image: o.image, caption: o.content.replace(/\n$/, ""), path: o.path });
          break;
        }
        const folder = o.path.slice(0, o.path.lastIndexOf("/")).replace(/^[A-Z]:\/ARCHIVE\/?/, "") || "ARCHIVE";
        out.push({ op: "sound", name: "rustle" }, { op: "file", header: name, title: folder, body: o.content.replace(/\n$/, ""), warning: /^WARNING/.test(name), path: o.path });
        break;
      }
      case "help":
        out.push({ op: "print", text: helpText(o.topic), style: "system" });
        break;
      case "cwd":
        cwd = o.path;
        out.push({ op: "prompt", text: promptFor(o.path, false) });
        break;
      case "terminal_prompt":
        // Owner, 2026-10-06: "Opening INPUT.EXE...", then the terminal's own prompt, so it never looks like a folder.
        out.push({ op: "print", text: `Opening ${cwd.slice(cwd.lastIndexOf("/") + 1)}...`, style: "system" }, { op: "print", text: "", style: "system" }, { op: "prompt", text: promptFor(cwd, true) });
        break;
      case "terminal_response":
        out.push({ op: "print", text: o.text, style: "system" });
        break;
      case "flicker":
        out.push(...flicker(glitchSize(o), o.ms));
        break;
      case "confirm_commit":
        out.push({ op: "print", text: CHOICE_TEXT.confirm(o.path.slice(o.path.lastIndexOf("/") + 1)), style: "system" });
        break;
      case "committed":
        out.push({ op: "print", text: CHOICE_TEXT.committed, style: "system" });
        break;
      case "commit_cancelled":
        out.push({ op: "print", text: CHOICE_TEXT.cancelled, style: "system" });
        break;
      case "error": {
        const text = o.code === "UNSUPPORTED_COMMAND" || o.code === "NOT_A_COMMAND" ? unsupportedText(o.detail ?? "") : ERROR_TEXT[o.code];
        if (text) out.push({ op: "print", text, style: "system" });
        break;
      }
      case "outcome":
        if (o.outcome === "exit_accepted") out.push(...ending(endings.levelClear), { op: "ended", how: "level_clear" });
        else if (o.outcome === "lockout" && endings.trap) {
          // The rebuilt death (Owner, 2026-10-01): the trap's words; then the screen collapses into the
          // virus bomb, "CONNECTION TERMINATED / STATUS: FAILED", the TV switch-off and the choice.
          // Owner, 2026-10-06: no "Connection Terminated." here; the death's own CONNECTION TERMINATED follows.
          out.push(...ending(withoutClosing(endings.trap)), { op: "ended", how: "reset", trap: true });
        }
        else if (o.outcome === "lockout") {
          // A fake terminal's code with no trap text of its own: its locked lines, then the same death as every
          // failure (Owner, 2026-10-06: one error animation for all).
          out.push(...ending(withoutClosing(endings.lockout)), { op: "ended", how: "reset", trap: true });
        }
        // A failed attempt or a capture at 20: the virus attack and the terminated message.
        // Capture at 20, the timer at 0:00 and John's name said three times end the same way as the trap
        // (Owner, 2026-10-01): the green death sequence, then TRY AGAIN or the menu.
        else if (o.outcome === "failed" || o.outcome === "captured") out.push({ op: "ended", how: "reset", trap: true });
        // A wrong code, at either terminal: denied, no penalty, try again.
        else if (o.outcome === "code_rejected") out.push({ op: "print", text: CODE_DENIED, style: "system" });
        break;
    }
  }
  // The fake terminal announces itself; the real terminal stays silent, arrival sound included.
  if (fakeArrival) out.unshift({ op: "sound", name: "arrival" });
  return out;
}

/**
 * After termination (Owner, 2026-09-30; 2026-10-01): the background sound fades and the screen
 * switches off like an old TV (line, dot, star, dark); three seconds of dark; the screen flickers
 * back on to "11:47 PM" (the clock is frozen there); the background returns, the cursor waits, and the new John speaks as in the
 * opening. `afterTerminate`: the terminated message has already held, so the switch-off is at once.
 */
export function resetIntro(afterTerminate = false, at         = RESET_TIME)                {
  return [
    ...(afterTerminate ? [] : [{ op: "pause", ms: 1200 }               ]),
    { op: "sound", name: "fade" },
    { op: "tvOff" },
    { op: "clear" },
    { op: "pause", ms: 3000 },
    { op: "tvOn" },
    { op: "print", text: at, style: "time" },
    { op: "pause", ms: 2500 },
    { op: "clear" },
    { op: "sound", name: "hum" },
    { op: "prompt", text: "" },
    { op: "pause", ms: 3000 },
  ];
}
