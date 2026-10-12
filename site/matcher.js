// Token-sequence trigger matching with negation awareness and deterministic ranking.
// Replaces the substring/longest-match pseudocode of dialogue_engine_spec §24, which
// can match inside negations and unrelated phrases (see its review register, §8–9).

import { clauseOf, normalize, triggerTokens } from "./normalize.js";
                                                 

/** How many tokens before a match a negation still governs it, within one clause. */
export const NEGATION_WINDOW = 3;

                            
             
                                                                                
                   
                     
 

                                             
            
                  
                 
                
 

                                                   
                    
                                                      
                          
                                                                               
                           
 

/** Start indices where `needle` occurs contiguously inside a single clause. */
function findSequence(input            , needle          )           {
  const hay = input.tokens;
  const hits           = [];
  if (needle.length === 0) return hits;
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    if (input.clauseStarts.some((s) => s > i && s < i + needle.length)) continue;
    hits.push(i);
  }
  return hits;
}

/**
 * A match is negated when a negation token precedes it closely in the same clause.
 * Negations inside the trigger itself ("not scared") are part of the phrase and
 * therefore sit at or after `start`, so they never negate their own match.
 */
function isNegated(input            , start        )          {
  const clause = clauseOf(input, start);
  return input.negations.some((n) => n < start && start - n <= NEGATION_WINDOW && clauseOf(input, n) === clause);
}

export function compare                     (a          , b          )         {
  if (a.record.priority !== b.record.priority) return b.record.priority - a.record.priority;
  if (a.length !== b.length) return b.length - a.length;
  if (a.record.id !== b.record.id) return a.record.id < b.record.id ? -1 : 1;
  return a.start - b.start;
}

export function matchAll                     (input                     , records              )                 {
  const n = typeof input === "string" ? normalize(input) : input;
  const accepted = new Map                  ();
  const negated = new Map                  ();
  for (const record of records) {
    for (const trigger of record.triggers) {
      const tokens = triggerTokens(trigger);
      for (const start of findSequence(n, tokens)) {
        const m           = { record, trigger, length: tokens.length, start };
        const target = isNegated(n, start) ? negated : accepted;
        const prior = target.get(record.id);
        if (!prior || compare(m, prior) < 0) target.set(record.id, m);
      }
    }
  }
  for (const id of accepted.keys()) negated.delete(id);
  return { input: n, ranked: [...accepted.values()].sort(compare), negated: [...negated.values()].sort(compare) };
}
