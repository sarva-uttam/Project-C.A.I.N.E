// Token-aware input normalization. Unlike a blanket filler strip, this keeps
// words that carry meaning in context ("i like it", "just you?") and records
// every removal so narrative QA can see why an input matched.

                             
              
                   
                                                   
                      
                                                                    
                         
                                                                               
 

/** Pure hesitation sounds: never meaningful, removed anywhere. */
const HESITATIONS = new Set(["um", "umm", "uh", "uhh", "er", "erm", "hmm", "hm"]);

/**
 * Context fillers from dialogue_engine_spec §8/§23. Removed only in discourse-marker
 * position (start of a clause), because mid-sentence they often carry meaning.
 */
const DISCOURSE_MARKERS = [["you", "know"], ["i", "mean"], ["well"], ["so"], ["like"], ["just"], ["actually"], ["basically"], ["literally"], ["okay"], ["ok"]];

/** Negation markers after contraction expansion. */
const NEGATIONS = new Set(["not", "no", "never", "nothing", "nobody", "nowhere", "neither", "nor", "without"]);

const CONTRACTIONS                           = {
  "don't": ["do", "not"], "dont": ["do", "not"], "doesn't": ["does", "not"], "doesnt": ["does", "not"],
  "didn't": ["did", "not"], "didnt": ["did", "not"], "can't": ["can", "not"], "cant": ["can", "not"],
  "cannot": ["can", "not"], "won't": ["will", "not"], "wont": ["will", "not"], "isn't": ["is", "not"],
  "isnt": ["is", "not"], "aren't": ["are", "not"], "arent": ["are", "not"], "wasn't": ["was", "not"],
  "wasnt": ["was", "not"], "weren't": ["were", "not"], "shouldn't": ["should", "not"], "wouldn't": ["would", "not"],
  "couldn't": ["could", "not"], "haven't": ["have", "not"], "hasn't": ["has", "not"], "i'm": ["i", "am"],
  "im": ["i", "am"], "you're": ["you", "are"], "youre": ["you", "are"], "it's": ["it", "is"], "what's": ["what", "is"],
  "whats": ["what", "is"], "who's": ["who", "is"], "whos": ["who", "is"], "where's": ["where", "is"],
  "that's": ["that", "is"], "i've": ["i", "have"], "i'll": ["i", "will"], "i'd": ["i", "would"],
  "they're": ["they", "are"], "we're": ["we", "are"], "let's": ["let", "us"],
};

/** Clause-breaking punctuation; negation scope does not cross these. */
const CLAUSE_BREAK = /[.,;:!?]+|\s+(?:but|and|or|because)\s+/gi;

export function normalize(raw        )             {
  const removed                        = [];
  const tokens           = [];
  const clauseStarts           = [];

  const text = raw.normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'");
  // Split into clauses first so discourse markers and negation scope are clause-local.
  const clauses = text.replace(CLAUSE_BREAK, (m) => ` \u0000${/\w/.test(m) ? m.trim() : ""} `).split("\u0000");

  for (const clause of clauses) {
    const words = clause
      .replace(/[^a-z0-9'\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .flatMap((w) => CONTRACTIONS[w] ?? [w.replace(/'/g, "")])
      .filter((w) => w.length > 0);

    // Drop hesitations anywhere.
    const kept           = [];
    for (const w of words) {
      if (HESITATIONS.has(w)) removed.push({ token: w, reason: "hesitation" });
      else kept.push(w);
    }

    // Strip leading discourse markers (possibly several: "well so like who are you").
    let start = 0;
    for (let changed = true; changed && start < kept.length;) {
      changed = false;
      for (const marker of DISCOURSE_MARKERS) {
        if (marker.every((m, i) => kept[start + i] === m) && kept.length - start > marker.length) {
          removed.push({ token: marker.join(" "), reason: "discourse_marker" });
          start += marker.length;
          changed = true;
          break;
        }
      }
    }
    const clauseTokens = kept.slice(start);
    if (clauseTokens.length === 0) continue;
    clauseStarts.push(tokens.length);
    tokens.push(...clauseTokens);
  }

  const negations = tokens.flatMap((t, i) => (NEGATIONS.has(t) ? [i] : []));
  return { raw, tokens, negations, clauseStarts, removed };
}

export function clauseOf(n            , index        )         {
  let clause = 0;
  for (let i = 0; i < n.clauseStarts.length; i++) if (n.clauseStarts[i] <= index) clause = i;
  return clause;
}

/** Normalizes an authored trigger phrase with the same rules (no discourse stripping). */
export function triggerTokens(phrase        )           {
  return phrase
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .flatMap((w) => CONTRACTIONS[w] ?? [w.replace(/'/g, "")])
    .filter((w) => w.length > 0 && !HESITATIONS.has(w));
}

export function isNegationToken(token        )          {
  return NEGATIONS.has(token);
}
