// PROVISIONAL system wording for the terminal screen. None of this is approved dialogue or
// story text. Error lines follow the old Windows command prompt; help, choice prompts and the
// file date are neutral placeholders until the Owner approves exact wording.
// Nothing here is spoken by John.

export const UI_TEXT_STATUS = "PROVISIONAL";

export const ERROR_TEXT                                = {
  PATH_NOT_FOUND: "The system cannot find the path specified.",
  FILE_NOT_FOUND: "The system cannot find the file specified.",
  NOT_A_DIRECTORY: "The directory name is invalid.",
  /** cd on a file (Owner, 2026-10-06), by what it is: a program is opened, a text or a picture read with type, a song played. */
  USE_OPEN: "That's a file, not a folder. Use open.",
  USE_TYPE: "That's a file, not a folder. Use type.",
  USE_PLAY: "That's a file, not a folder. Use play.",
  NOT_A_FILE: "Access is denied.",
  IS_A_PROGRAM: "This is a program. To run it, type open INPUT.EXE",
  CHOOSE_FIRST: "Access is denied.",
  ALREADY_AT_ROOT: null,
  MISSING_ARGUMENT: "The syntax of the command is incorrect.",
  TOO_MANY_ARGUMENTS: "The syntax of the command is incorrect.",
  INVALID_CODE_FORMAT: "The syntax of the command is incorrect.",
  NOT_AT_TERMINAL: "The syntax of the command is incorrect.",
  NOT_AN_OPTION: "That is not one of the choices.",
  NOT_A_SONG: "That is not a song.",
  FINAL_DECISION_IS_PROCEED_OR_RETREAT: "The choice is made.",
  CONNECTION_ENDED: null,
};

export function unsupportedText(verb        )         {
  return `'${verb}' is not recognized as an internal or external command,\noperable program or batch file.`;
}

export const CHOICE_TEXT = {
  confirm: (name        ) => `Choose ${name}? Type yes to confirm.`,
  committed: "Chosen.",
  cancelled: "Not chosen.",
};

/** Help. Deliberately silent about `exit`: README_FIRST.TXT is where the player learns it. */
export const HELP_TEXT                         = {
  "": [
    "Commands:",
    "",
    "  DIR      Lists the files and folders here.",
    "  CD       Moves into a folder. CD .. goes back.",
    "  TYPE     Shows what is inside a file.",
    "  CHOOSE   Chooses a folder. Asks you to confirm.",
    "  PLAY     Plays a song. PLAY alone carries on.",
    "  PAUSE    Pauses the song.",
    "  HELP     Shows this list. HELP DIR explains DIR.",
  ].join("\n"),
  dir: ["DIR", "", "Lists the files and folders in the current folder.", "Folders are marked <DIR>. Files show their size.", "", "  dir", "  dir PHOTOS"].join("\n"),
  cd: ["CD", "", "Moves into a folder.", "CD .. goes back one folder.", "", "  cd CLOCK", "  cd .."].join("\n"),
  type: ["TYPE", "", "Shows what is inside a file.", "", "  type README.TXT"].join("\n"),
  choose: ["CHOOSE", "", "Chooses a folder when the time comes.", "Type yes to confirm. Anything else cancels.", "", "  choose CLOCK"].join("\n"),
  play: ["PLAY", "", "Plays a song found in a folder.", "PLAY with no name carries on after PAUSE.", "", "  play SONG.MP3", "  play"].join("\n"),
  pause: ["PAUSE", "", "Pauses the song that is playing.", "", "  pause"].join("\n"),
  help: ["HELP", "", "Shows the list of commands.", "", "  help", "  help cd"].join("\n"),
};

export function helpText(topic               )         {
  return HELP_TEXT[topic ?? ""] ?? `No help is available for ${topic .toUpperCase()}.`;
}

/** One date and time for every archive entry in `dir`. The time is always 11:47 (Owner, 2026-09-30). */
export const ARCHIVE_DATE = "09/14/1993  11:47 PM";


/** The reset card: the only words shown between connections. The clock reads 11:47, always, frozen
 *  (Owner, 2026-10-01: the night is 09/14/1993 at 11:47 PM; it replaces 9:45 PM). */
export const RESET_TIME = "11:47 PM";
/** After a level's locked closing text (Owner, 2026-10-01). TEMPORARY: while Level 2 is not in the game,
 *  this line and the return to the menu stand in for going straight on; remove both when Level 2 ships. */
export const LEVEL_DONE = "You've done what you came to do.";

/** The date and time in the corner of the glass (Owner, 2026-10-01, like a 90s video overlay). */
export const SCREEN_DATE = "SEP. 14 1993";
export const SCREEN_TIME = "PM 11:47";

/** A wrong code at any terminal, real or fake (Owner, 2026-10-01). No penalty; the player may retry. */
export const CODE_DENIED = "Code denied. Try again.";

/** Taunts on the virus boxes when a connection is terminated (Owner, 2026-10-01: "taunting, mocking").
 *  Provisional wording; none of it names anyone or says anything about the story. */
export const VIRUS_TAUNTS = ["HA HA HA", "FOUND YOU", "TOO SLOW", "GOODBYE", "CAUGHT", "NO ONE CAME", "LOST", "HA HA", "BYE BYE", "TOO LATE", "GAME OVER", "404"];

/** The fake terminal's bomb (Owner, 2026-10-01): the taunts, and the one message left at the end. */
export const TRAP_TAUNTS = ["GOODBYE", "LOST", "GAME OVER", "FOUND YOU", "TOO LATE", "NO", "HA HA HA", "CAUGHT", "FOUND", "YOU LOSE", "TRY AGAIN", "GONE", "TOO SLOW", "SEE YOU", "HELP", "WHERE ARE YOU", "I SEE YOU"];
export const TRAP_MESSAGE = ["CONNECTION TERMINATED", "STATUS: FAILED"]         ;

/** The song bar under the command line (Owner, 2026-10-01). */
export const SONG_TEXT = {
  nothing: "No song is playing.",
  playing: (title        ) => `Playing: ${title}`,
  paused: (title        ) => `Paused: ${title}`,
};
