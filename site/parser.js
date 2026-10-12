// Typed input parser. Classifies a typed line as a simulated command or chat.
// Commands act only on the virtual world in session.ts; nothing here touches a
// host shell, subprocess or eval.
//
// Implemented verbs are navigation/reading, terminal submission, and a commit
// request whose verb comes from level data. Browsing with cd never commits;
// the session asks for a separate confirmation (Owner decision 2026-09-29 #2).

                     
                                        
                                
                                  
                                  
                                    
                                                                                                           
                                  
                                          
                                                                                                     
                                         
                      

                    
                     
                                                      
                                                                                                                                  
                                                              
                                   

/** CMD-like verbs named as candidates in cmd_system.md but not implemented in Phase 1. */
const RECOGNIZED_UNSUPPORTED = new Set(["copy", "del", "erase", "find", "tree", "echo", "move", "ren", "rename", "md", "mkdir", "rd", "rmdir", "cls", "commit", "undo"]);

const PATH_ARG = /^[A-Za-z0-9_.:!\\/-]+$/;

/** A token that reads as a file or path rather than a word: has a separator/extension, or is upper case. */
function looksLikePath(arg        )          {
  return PATH_ARG.test(arg) && (/[.:\\/_]/.test(arg) || /^[A-Z0-9_]+$/.test(arg));
}

                               
                                                         
                      
 

export function parse(input        , options               = {})         {
  const raw = input.replace(/[\r\n]+/g, " ");
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: "empty" };

  // CMD accepts "cd.." and "cd\" without a space.
  const spaced = trimmed.replace(/^(cd)(\.\.|[\\/])/i, "$1 $2");
  const parts = spaced.split(/\s+/);
  const verb = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (options.commitVerb && verb === options.commitVerb) {
    if (args.length === 0) return { kind: "command_error", verb, error: "MISSING_ARGUMENT", raw };
    if (args.length > 1 || !PATH_ARG.test(args[0])) return { kind: "chat", text: trimmed };
    return { kind: "command", command: { verb: "commit", path: args[0] }, raw };
  }

  switch (verb) {
    case "help":
      if (args.length > 1) return { kind: "chat", text: trimmed };
      return { kind: "command", command: { verb: "help", topic: args[0]?.toLowerCase() ?? null }, raw };
    case "dir":
      if (args.length > 1) return { kind: "command_error", verb, error: "TOO_MANY_ARGUMENTS", raw };
      if (args.length === 1 && !PATH_ARG.test(args[0])) return { kind: "chat", text: trimmed };
      return { kind: "command", command: { verb: "dir", path: args[0] ?? null }, raw };
    case "cd":
    case "chdir":
      if (args.length === 0) return { kind: "command_error", verb: "cd", error: "MISSING_ARGUMENT", raw };
      if (args.length > 1 || !PATH_ARG.test(args[0])) return { kind: "chat", text: trimmed };
      return { kind: "command", command: { verb: "cd", path: args[0] }, raw };
    case "type":
      if (args.length === 0) return { kind: "command_error", verb, error: "MISSING_ARGUMENT", raw };
      // "type faster please" is chat; a single path-like argument is a command.
      if (args.length > 1 || !PATH_ARG.test(args[0])) return { kind: "chat", text: trimmed };
      return { kind: "command", command: { verb: "type", path: args[0] }, raw };
    case "open":
      if (args.length === 0) return { kind: "command_error", verb, error: "MISSING_ARGUMENT", raw };
      // "open the red box" is chat; a single path-like argument is a command.
      if (args.length > 1 || !PATH_ARG.test(args[0])) return { kind: "chat", text: trimmed };
      return { kind: "command", command: { verb: "open", path: args[0] }, raw };
    case "play":
      // "play with me" is chat; nothing, or a single file-like argument, is a command.
      if (args.length > 1 || (args.length === 1 && !looksLikePath(args[0]))) return { kind: "chat", text: trimmed };
      return { kind: "command", command: { verb: "play", path: args[0] ?? null }, raw };
    case "pause":
      if (args.length > 0) return { kind: "chat", text: trimmed };
      return { kind: "command", command: { verb: "pause" }, raw };
    case "exit":
      if (args.length === 0) return { kind: "command_error", verb, error: "MISSING_ARGUMENT", raw };
      if (args.length > 1) return { kind: "chat", text: trimmed };
      if (!/^\d{1,8}$/.test(args[0])) return { kind: "command_error", verb, error: "INVALID_CODE_FORMAT", raw };
      return { kind: "command", command: { verb: "exit", code: args[0] }, raw };
    default:
      // Unimplemented verbs count as commands only with path-like arguments, so chat
      // such as "open the red box" or "find my dad" is not swallowed as a command.
      if (RECOGNIZED_UNSUPPORTED.has(verb) && (args.length === 0 || args.every(looksLikePath))) return { kind: "unsupported_command", verb, raw };
      return { kind: "chat", text: trimmed };
  }
}

/** Resolves a CMD-style path argument against a virtual cwd. Returns null on traversal above root. */
export function resolvePath(root        , cwd        , arg        )                {
  const drive = root.slice(0, 2);
  const input = arg.replace(/\\/g, "/");
  const absolute = /^[A-Za-z]:/.test(input);
  if (absolute && input.slice(0, 2).toUpperCase() !== drive) return null;
  // Absolute paths start at the drive; a leading "/" means the virtual root; otherwise cwd.
  const stack = absolute ? [] : (input.startsWith("/") ? root : cwd).split("/").slice(1);
  const rest = (absolute ? input.slice(2) : input).split("/").filter((p) => p.length > 0 && p !== ".");
  const rootDepth = root.split("/").length - 1;
  for (const part of rest) {
    if (part === "..") {
      if (stack.length <= rootDepth) return null;
      stack.pop();
    } else stack.push(part.toUpperCase());
  }
  const path = [drive, ...stack].join("/");
  return path === root || path.startsWith(root + "/") ? path : null;
}
