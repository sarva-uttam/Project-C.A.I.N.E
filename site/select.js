// Deterministic no-repeat line selection within one John instance.
// Multi-line pools use a seeded shuffle-bag that never repeats the previous
// line across cycle boundaries. One-line pools follow an explicit policy
// (dialogue_engine_spec §13 rule 4 is unconfirmed, so it is configurable).

import { hash53 } from "./hash.js";
                                                           

class Rng {
          state        ;
  constructor(...parts          ) {
    this.state = hash53(parts.join("\u0000")) >>> 0;
  }
  next()         {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  shuffle   (items              )      {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

               
                    
                  
                 
                
 

                               
                    
                 
 

/** Per-John-instance selection memory. A new instance gets a new Selector. */
export class Selector {
          bags = new Map             ();
          lastByPool = new Map                ();
          spokenAt = new Map                ();
          spoken = 0;
          seed        ;
          policy                  ;

  constructor(seed        , policy                  ) {
    this.seed = seed;
    this.policy = policy;
  }

  /** Count of John lines spoken by this instance. */
  get spokenCount()         {
    return this.spoken;
  }

  select(poolKey        , eligible        )               {
    if (eligible.length === 0) return { line: null, reason: "no eligible line" };
    const lines = [...eligible].sort((a, b) => (a.id < b.id ? -1 : 1));

    if (lines.length === 1) {
      const only = lines[0];
      const at = this.spokenAt.get(only.id);
      if (at !== undefined) {
        if (this.policy.mode === "silence_after_first") return { line: null, reason: "single-line pool already used" };
        if (this.policy.mode === "cooldown" && this.spoken - at - 1 < this.policy.otherJohnLines) {
          return { line: null, reason: `single-line cooldown (${this.spoken - at - 1}/${this.policy.otherJohnLines} other lines)` };
        }
      }
      return { line: only, reason: "single-line pool" };
    }

    const ids = lines.map((l) => l.id);
    const signature = ids.join("|");
    let bag = this.bags.get(poolKey);
    if (!bag || bag.signature !== signature || bag.cursor >= bag.order.length) {
      const cycle = bag && bag.signature === signature ? bag.cycle + 1 : 0;
      const order = new Rng(this.seed, poolKey, signature, String(cycle)).shuffle(ids);
      const last = this.lastByPool.get(poolKey);
      if (order[0] === last) order.push(order.shift() ); // never repeat across a cycle boundary
      bag = { signature, order, cursor: 0, cycle };
      this.bags.set(poolKey, bag);
    }
    const id = bag.order[bag.cursor++];
    return { line: lines.find((l) => l.id === id) , reason: `bag cycle ${bag.cycle} position ${bag.cursor}` };
  }

  /** Records that a line was actually spoken (after all suppression checks). */
  commit(poolKey        , line      )       {
    this.lastByPool.set(poolKey, line.id);
    this.spokenAt.set(line.id, this.spoken);
    this.spoken++;
  }
}
