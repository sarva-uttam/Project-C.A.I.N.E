// Sound, with Web Audio. Files from the Owner (web/audio): the fluorescent buzz, looped as the
// background under the menu, the boot and play (it replaces the old synthesised hum); the glitch; an
// 80s keyboard, cut into single keystrokes for the player's typing and the boot; and the songs found
// in folders. Everything else is synthesised (John types on a soft, muffled modern keyboard). Browsers only allow audio after a key press or tap, so start()
// runs on the first key or tap. One instance serves the menu and the game, so there is only ever one
// background loop. The Sound setting gates everything at the output: off means silence at once.
// Pause and a hidden tab suspend the audio clock, so scheduled sounds wait with the game.

                                                                                                                                                                                   

/** Gain for the background buzz at each Ambient volume. The file itself is quiet (peak 0.09). */
const MUSIC_LEVEL = { low: 0.85, medium: 1.7, high: 2.8 }         ;
/** The effects bus (typing, glitches, everything but the background and songs) at each Effects volume. */
const EFFECTS_LEVEL = { low: 0.35, medium: 0.6, high: 0.95 }         ;

export class Sounds {
          ctx                      = null;
          master           ;
  /** The Sound setting's gate between everything and the speakers. */
          out           ;
          enabled = true;
          hidden = false;
          paused = false;
          noise              ;
  /** The background track: its own gain, under the master. */
          musicGain           ;
          musicOn = true;
          musicLevel         = MUSIC_LEVEL.low;
  /** Held down by the story (a reset's fade, the terminated sequence) until it lets go. */
          musicHeld = false;
          buffers                                                                                           = {};
  /** Start times of the single keystrokes in the keyboard recording. */
          keyOnsets           = [];
          effectsLevel         = EFFECTS_LEVEL.high;
  /** A song from a folder: an <audio> element through its own gain, straight to the output. */
          song                                                                                              = null;
  /** Listens to the song for the song bar's beat (Owner, 2026-10-01). */
          analyser                      = null;
          spectrum                                 = null;
  /** The boot's own mix (Owner, 2026-10-01): a low hum, a rising swell, and distant typing under them. */
          boot                                                                                                                                                                              = null;

  /** The soft turn-on of a CRT. */
  restore()       {
    this.play("crtOn");
  }

  /** Music on or off and its volume (Settings > Audio). Changes glide, never click. */
  setMusic(on         , level                           )       {
    this.musicOn = on;
    this.musicLevel = MUSIC_LEVEL[level];
    this.applyMusic(0.4);
  }

          applyMusic(seconds        )       {
    const ctx = this.ctx;
    if (!ctx) return;
    // While a song plays the buzz drops under it.
    const target = this.musicOn && !this.musicHeld ? this.musicLevel * (this.song?.wanted ? 0.25 : 1) : 0;
    this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(target, ctx.currentTime, Math.max(0.01, seconds / 3));
  }

  /** Effects volume (Settings > Audio). */
  setEffects(level                           )       {
    this.effectsLevel = EFFECTS_LEVEL[level];
    if (this.ctx) this.master.gain.setTargetAtTime(this.effectsLevel, this.ctx.currentTime, 0.05);
  }

  /** The story holds the background down (true) or lets it come back (false). */
  holdMusic(held         , seconds        )       {
    this.musicHeld = held;
    this.applyMusic(seconds);
  }

  /** Pause (the pause menu): everything waits, the background included. */
  setPaused(paused         )       {
    this.paused = paused;
    this.sync();
  }

  // ---------------------------------------------------------------- songs (Owner, 2026-10-01)

  /** Plays a song; asking for the one already loaded carries on where it was. */
  playSong(id        , title        )       {
    if (!this.ctx) return;
    if (this.song?.id !== id) {
      this.stopSong();
      const el = new Audio(`audio/songs/${id}.mp3`);
      el.preload = "auto";
      const gain = this.ctx.createGain();
      gain.gain.value = 0.8;
      this.ctx.createMediaElementSource(el).connect(gain).connect(this.out);
      if (!this.analyser) {
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.7;
        this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
      }
      gain.connect(this.analyser);
      el.addEventListener("ended", () => {
        if (this.song?.el === el) this.song.wanted = false;
        this.applyMusic(1);
        this.onSong?.();
      });
      this.song = { el, gain, id, title, wanted: true };
    }
    this.song.wanted = true;
    this.syncSong();
    this.applyMusic(0.8);
    this.onSong?.();
  }

  pauseSong()       {
    if (!this.song) return;
    this.song.wanted = false;
    this.syncSong();
    this.applyMusic(0.8);
    this.onSong?.();
  }

  resumeSong()          {
    if (!this.song) return false;
    this.playSong(this.song.id, this.song.title);
    return true;
  }

  /** Stops and forgets the song (a terminated connection, leaving to the menu, leaving the Archive). */
  stopSong()       {
    if (!this.song) return;
    this.song.el.pause();
    this.song.el.removeAttribute("src");
    this.song.gain.disconnect();
    this.song = null;
    this.applyMusic(0.8);
    this.onSong?.();
  }

  /** playing: the player wants it on; sounding: it is actually running (not while paused or hidden). */
  get songState()                                                                            {
    return this.song ? { id: this.song.id, title: this.song.title, playing: this.song.wanted, sounding: !this.song.el.paused } : null;
  }

  /**
   * The song's loudness in `bands` bands, low to high, each 0 to 1, for the beat bars. All zeros when
   * nothing sounds (paused, ended, sound off), so the screen can tell and keep its own beat.
   */
  songLevels(bands        )           {
    const a = this.analyser;
    const data = this.spectrum;
    if (!a || !data || !this.song || this.song.el.paused) return new Array(bands).fill(0);
    a.getByteFrequencyData(data);
    // The useful range of a song sits in the lower two thirds of the bins.
    const usable = Math.floor(data.length * 0.66);
    const out           = [];
    for (let b = 0; b < bands; b++) {
      const from = Math.floor((usable * b) / bands);
      const to = Math.max(from + 1, Math.floor((usable * (b + 1)) / bands));
      let sum = 0;
      for (let i = from; i < to; i++) sum += data[i];
      out.push(sum / (to - from) / 255);
    }
    return out;
  }

  /** Called whenever the song starts, pauses or ends, so the screen can show it. */
  onSong                      = null;

  /** The element plays only while wanted and while the game is neither paused nor hidden. */
          syncSong()       {
    const s = this.song;
    if (!s) return;
    if (s.wanted && !this.paused && !this.hidden) void s.el.play().catch(() => {});
    else s.el.pause();
  }

  /**
   * Every flicker (Owner, 2026-09-30): digital distortion, a slight electric whine, a deep hum and
   * short glitch bursts — not TV static. Builds, peaks and fades with the picture. `strength` 0–1.
   */
  glitch(seconds        , strength        )       {
    const ctx = this.ctx;
    if (!ctx) return;
    const sample = this.buffers.glitch;
    if (sample) {
      // The Owner's glitch, faded in and out with the picture (its own silence at each end skipped).
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = sample;
      const g = ctx.createGain();
      const peak = 0.9 * strength;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.3 * seconds);
      g.gain.setValueAtTime(peak, t + 0.7 * seconds);
      g.gain.linearRampToValueAtTime(0.0001, t + seconds);
      src.connect(g).connect(this.master);
      const usable = sample.duration - 1.3;
      const from = 0.3 + Math.random() * Math.max(0, usable - seconds);
      src.start(t, from, Math.min(seconds + 0.05, sample.duration - from));
      return;
    }
    this.synthGlitch(seconds, strength);
  }

  /** The synthesised glitch, used until (or if) the Owner's sample cannot load. */
          synthGlitch(seconds        , strength        )       {
    const ctx = this.ctx ;
    const t = ctx.currentTime;
    const T = seconds;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(strength, t + 0.3 * T);
    env.gain.setValueAtTime(strength, t + 0.75 * T);
    env.gain.linearRampToValueAtTime(0.0001, t + T);
    env.connect(this.master);
    // Digital distortion: a square wave hopping between pitches, crushed to a few levels.
    const osc = ctx.createOscillator();
    osc.type = "square";
    for (let at = 0; at < T; at += 0.05 + Math.random() * 0.07) osc.frequency.setValueAtTime(80 + Math.random() * 900, t + at);
    const crush = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) curve[i] = Math.round(((i / 511) * 2 - 1) * 3) / 3;
    crush.curve = curve;
    const dg = ctx.createGain();
    dg.gain.value = 0.05;
    osc.connect(crush).connect(dg).connect(env);
    // A slight electric whine.
    const whine = ctx.createOscillator();
    whine.frequency.setValueAtTime(9500, t);
    whine.frequency.linearRampToValueAtTime(12500, t + T);
    const wg = ctx.createGain();
    wg.gain.value = 0.012;
    whine.connect(wg).connect(env);
    // A deep hum.
    const hum = ctx.createOscillator();
    hum.frequency.value = 45;
    const hum2 = ctx.createOscillator();
    hum2.frequency.value = 90;
    const hg = ctx.createGain();
    hg.gain.value = 0.16;
    hum.connect(hg);
    hum2.connect(hg);
    hg.connect(env);
    for (const o of [osc, whine, hum, hum2]) {
      o.start(t);
      o.stop(t + T + 0.05);
    }
    // Short glitch bursts: stuttering chirps and clicks.
    for (let k = 0; k < Math.round(12 * T * strength); k++) {
      const at = t + Math.random() * T;
      this.burstInto(env, at, 0.015 + Math.random() * 0.05, 1800 + Math.random() * 5000, 0.25);
      if (Math.random() < 0.5) this.toneInto(env, at, 300 + Math.random() * 2400, 0.03, 0.06, "square");
    }
  }

          burstInto(dest           , t        , dur        , freq        , level        )       {
    const ctx = this.ctx ;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  /** For automated checks: whether the background loop plays, and how loud it is set to be. */
  get musicState()                                                        {
    return { loaded: this.buffers.buzz !== undefined, gain: this.ctx ? this.musicGain.gain.value : 0, keystrokes: this.keyOnsets.length };
  }

  get running()          {
    return this.ctx?.state === "running";
  }

  /** Sound on or off (Settings). Off silences at once and suspends the audio clock. */
  setEnabled(on         )       {
    this.enabled = on;
    this.sync();
  }

  /** The page was hidden or shown: nothing plays while no one can see the screen. */
  setHidden(hidden         )       {
    this.hidden = hidden;
    this.sync();
  }

          sync()       {
    const ctx = this.ctx;
    if (!ctx) return;
    const audible = this.enabled && !this.hidden && !this.paused;
    this.syncSong();
    this.out.gain.cancelScheduledValues(ctx.currentTime);
    this.out.gain.setValueAtTime(this.enabled ? 1 : 0, ctx.currentTime);
    // A browser may refuse to resume outside a key press or tap; the next one tries again. Not an error.
    (audible ? ctx.resume() : ctx.suspend()).catch(() => {});
  }

  /** Creates the audio on a key press or tap. Safe to call on every one: it runs once, then only resumes. */
  start()       {
    if (this.ctx) {
      this.sync();
      return;
    }
    let ctx              ;
    try {
      ctx = this.ctx = new AudioContext();
    } catch {
      return; // no Web Audio: the game plays silently
    }
    this.out = ctx.createGain();
    this.out.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.effectsLevel;
    this.master.connect(this.out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // The background: the Owner's fluorescent buzz, looped (it replaces the old synthesised hum).
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.out);
    void this.load("buzz").then((b) => b && this.startMusic(b));
    void this.load("glitch");
    void this.load("keys").then((b) => b && (this.keyOnsets = keystrokes(b)));
    void this.load("bootKeys");
    this.sync();
  }

  play(name           )       {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (name) {
      case "key": {
        // The player (Owner, 2026-10-01): a loud, mechanical 1990s keyboard, one real keystroke from
        // the Owner's recording each time.
        const keys = this.buffers.keys;
        if (keys && this.keyOnsets.length > 0) {
          const at = this.keyOnsets[Math.floor(Math.random() * this.keyOnsets.length)];
          const src = ctx.createBufferSource();
          src.buffer = keys;
          src.playbackRate.value = 0.94 + Math.random() * 0.12;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.9, t);
          g.gain.setValueAtTime(0.9, t + 0.06);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
          src.connect(g).connect(this.master);
          src.start(t, Math.max(0, at - 0.004), 0.12);
          return;
        }
        this.burst(t, 0.016, "highpass", 3400 + Math.random() * 1200, 0.14);
        return this.tone(t, 4200 + Math.random() * 400, 0.012, 0.025, "sine");
      }
      case "johnKey":
        // John (Owner, 2026-10-01): a modern keyboard, softer and slightly muffled: a short, low,
        // damped tap, clearly unlike the player's clatter.
        this.burst(t, 0.035, "lowpass", 900 + Math.random() * 200, 0.07, 0.7);
        return this.tone(t, 260 + Math.random() * 30, 0.018, 0.02, "sine");
      case "deny":
        // Denied (Owner, 2026-09-30): TV static, a low hum and one short, soft crash. No sustained distortion.
        this.burst(t, 2, "bandpass", 3000, 0.07, 0.5);
        this.tone(t, 55, 2, 0.1, "sine");
        this.burst(t + 0.3, 0.45, "lowpass", 420, 0.2);
        return this.sweep(t + 0.3, 70, 38, 0.35, 0.12, "sine");
      case "whoosh":
        // The command center opening: a soft electrical whoosh.
        return this.whoosh(t);
      case "click":
        // The panels settle.
        this.burst(t, 0.012, "highpass", 2500, 0.1);
        return this.tone(t, 1200, 0.018, 0.04, "square");
      case "rustle": return this.burst(t, 0.26, "bandpass", 1400, 0.09, 0.6);
      case "bip": return this.tone(t, 880, 0.07, 0.05, "sine");
      case "tick": return this.burst(t, 0.02, "highpass", 2600 + Math.random() * 1500, 0.05);
      case "denied":
        // A harsh denied buzzer.
        this.tone(t, 92, 0.55, 0.16, "square");
        return this.tone(t, 97, 0.55, 0.1, "square");
      case "crtOn":
        // A soft thump, then the rising whine of a tube warming up.
        this.sweep(t, 55, 38, 0.25, 0.12, "sine");
        this.sweep(t + 0.05, 9000, 15700, 0.8, 0.01, "sine");
        return this.burst(t, 0.3, "lowpass", 500, 0.06);
      case "buzz":
        // Level 1: a quick, low electrical buzz, about half a second.
        this.sweep(t, 120, 110, 0.5, 0.05, "sawtooth");
        return this.burst(t, 0.45, "bandpass", 2400, 0.05, 2);
      case "surge":
        // Level 2: a tearing, crackling surge, about 1.6 seconds, louder.
        this.sweep(t, 60, 180, 1.6, 0.12, "sawtooth");
        for (let i = 0; i < 14; i++) this.burst(t + i * 0.11 + Math.random() * 0.05, 0.06 + Math.random() * 0.08, "highpass", 1500 + Math.random() * 3500, 0.22 + Math.random() * 0.2);
        return this.burst(t, 1.6, "lowpass", 600, 0.18);
      case "arrival":
        this.sweep(t, 110, 48, 0.45, 0.09, "sawtooth");
        return this.burst(t, 0.35, "lowpass", 900, 0.05);
      case "chime":
        // Low and uneasy: a root, a fifth and a slightly flat sixth, slow in and slow out.
        for (const [f, g] of [[98, 0.07], [146.8, 0.05], [155.6, 0.035], [49, 0.05]]         ) this.pad(t, f, g, 1.2, 3.2);
        return;
      case "fade":
        // A reset: the background fades out...
        return this.holdMusic(true, 1.1);
      case "hum":
        // ...and comes back when the new connection begins.
        return this.holdMusic(false, 1.6);
    }
  }

  // ---------------------------------------------------------------- the boot (Owner, 2026-10-01)
  // A Matrix-style boot: a low hum and a rising swell carry it; the old keyboard sits under them,
  // filtered and echoed so it sounds distant, at about half its old level. It builds with the
  // windows, peaks loud but not painful (a compressor holds the peak), and cuts to silence at once.

  bootStart()       {
    const ctx = this.ctx;
    if (!ctx || this.boot) return;
    const t = ctx.currentTime;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -20;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.2;
    limiter.connect(this.master);
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.5, t + 0.8);
    bus.connect(limiter);
    const sources                             = [];
    // The hum: two low sines, felt more than heard.
    const hum = ctx.createGain();
    hum.gain.value = 0.06;
    hum.connect(bus);
    for (const [f, g] of [[55, 1], [110, 0.45], [165, 0.12]]         ) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(hum);
      o.start(t);
      sources.push(o);
    }
    // The swell: filtered noise that opens and rises as the windows multiply.
    const swellFilter = ctx.createBiquadFilter();
    swellFilter.type = "bandpass";
    swellFilter.Q.value = 0.8;
    swellFilter.frequency.value = 220;
    const swell = ctx.createGain();
    swell.gain.value = 0.015;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    noise.loop = true;
    noise.connect(swellFilter).connect(swell).connect(bus);
    noise.start(t);
    sources.push(noise);
    // The keys: dulled and pushed back with a short echo, under the hum and the swell.
    const keys = ctx.createGain();
    keys.gain.value = 0.42;
    const dull = ctx.createBiquadFilter();
    dull.type = "lowpass";
    dull.frequency.value = 2600;
    const echo = ctx.createDelay(0.5);
    echo.delayTime.value = 0.085;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    keys.connect(dull);
    dull.connect(bus);
    dull.connect(echo);
    echo.connect(feedback).connect(echo);
    echo.connect(wet).connect(bus);
    this.boot = { bus, keys, hum, swell, swellFilter, sources };
    // The Owner's modern mechanical keyboard (2026-10-01): the boot's soundtrack, looped, under the
    // chaos; it rises with the windows. Its quiet first and last moments are skipped.
    const track = this.buffers.bootKeys;
    if (track) {
      const src = ctx.createBufferSource();
      src.buffer = track;
      src.loop = true;
      src.loopStart = Math.min(0.3, track.duration / 4);
      src.loopEnd = Math.max(src.loopStart + 1, track.duration - 0.3);
      src.connect(keys);
      src.start(t, src.loopStart);
      sources.push(src);
      this.boot.track = src;
      keys.gain.value = 0.32;
    }
  }

  /** How far the boot has built, 0 to 1: everything rises together, the keys least. */
  bootLevel(p        )       {
    const ctx = this.ctx;
    const b = this.boot;
    if (!ctx || !b) return;
    const t = ctx.currentTime;
    const q = Math.min(1, Math.max(0, p));
    b.bus.gain.setTargetAtTime(0.5 + 0.5 * q, t, 0.15);
    b.hum.gain.setTargetAtTime(0.06 + 0.07 * q, t, 0.2);
    b.swell.gain.setTargetAtTime(0.015 + 0.13 * q * q, t, 0.15);
    b.swellFilter.frequency.setTargetAtTime(220 + 2600 * q * q, t, 0.15);
    if (b.track) {
      // The recording louder and a little faster as the windows multiply; never painful (the compressor holds the peak).
      b.keys.gain.setTargetAtTime(0.32 + 0.5 * q, t, 0.2);
      b.track.playbackRate.setTargetAtTime(0.96 + 0.24 * q, t, 0.3);
    } else b.keys.gain.setTargetAtTime(0.42 + 0.12 * q, t, 0.2);
  }

  /** One keystroke of the old keyboard, into the boot's distant key bus. */
  bootKey()       {
    const ctx = this.ctx;
    const b = this.boot;
    const keys = this.buffers.keys;
    if (!ctx || !b || b.track) return; // the soundtrack plays instead of single keystrokes
    const t = ctx.currentTime;
    if (!keys || this.keyOnsets.length === 0) {
      this.burstInto(b.keys, t, 0.016, 3000 + Math.random() * 1200, 0.12);
      return;
    }
    const at = this.keyOnsets[Math.floor(Math.random() * this.keyOnsets.length)];
    const src = ctx.createBufferSource();
    src.buffer = keys;
    src.playbackRate.value = 0.9 + Math.random() * 0.16;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.setValueAtTime(0.5, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(g).connect(b.keys);
    src.start(t, Math.max(0, at - 0.004), 0.12);
  }

  /** The screen goes black: the boot's sound fades out smoothly (about a third of a second), the background with it. */
  bootCut()       {
    const ctx = this.ctx;
    const b = this.boot;
    this.holdMusic(true, 0.3);
    if (!ctx || !b) return;
    const t = ctx.currentTime;
    b.bus.gain.cancelScheduledValues(t);
    b.bus.gain.setTargetAtTime(0, t, 0.09);
    for (const s of b.sources) s.stop(t + 0.8);
    setTimeout(() => b.bus.disconnect(), 1000);
    this.boot = null;
  }

  /** Loads one of the Owner's sounds from the game's own folder (no other site is contacted). */
          async load(name                                         )                              {
    const file = { buzz: "fluorescent-buzz", glitch: "glitch", keys: "keyboard-80s", bootKeys: "keyboard-modern" }[name];
    try {
      const data = await (await fetch(`audio/${file}.mp3`)).arrayBuffer();
      const buffer = await this.ctx .decodeAudioData(data);
      this.buffers[name] = buffer;
      return buffer;
    } catch {
      return null; // the game plays on without it
    }
  }

  /**
   * Loops the buzz without a gap or a click: its silent ends are cut, and the last 150 ms fade into
   * the first so the seam is continuous. Starts silent and rises to the setting's level.
   */
          startMusic(source             )       {
    const ctx = this.ctx ;
    const rate = source.sampleRate;
    const start = Math.round(0.12 * rate);
    const end = source.length - Math.round(0.08 * rate);
    const fade = Math.round(0.15 * rate);
    const length = end - start - fade;
    const loop = ctx.createBuffer(source.numberOfChannels, length, rate);
    for (let c = 0; c < source.numberOfChannels; c++) {
      const from = source.getChannelData(c);
      const to = loop.getChannelData(c);
      for (let i = 0; i < length; i++) to[i] = from[start + i];
      for (let i = 0; i < fade; i++) to[i] = from[start + i] * (i / fade) + from[start + length + i] * (1 - i / fade);
    }
    const src = ctx.createBufferSource();
    src.buffer = loop;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.applyMusic(1.5);
  }

  /**
   * The connection terminated (Owner, 2026-10-01): a virus bomb over `seconds`. Alarms, crashes and
   * torn glitches, sparse at first and escalating to the end. The background is held down meanwhile.
   */
  virus(seconds        )       {
    const ctx = this.ctx;
    if (!ctx) return;
    this.holdMusic(true, 0.3);
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.9, t + seconds * 0.85);
    bus.gain.setValueAtTime(0.9, t + seconds);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.25);
    const crush = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) curve[i] = Math.round(((i / 511) * 2 - 1) * 5) / 5;
    crush.curve = curve;
    bus.connect(crush).connect(this.master);
    // A two-tone alarm that climbs.
    const alarm = ctx.createOscillator();
    alarm.type = "square";
    for (let at = 0, hi = false; at < seconds; at += 0.28 - 0.18 * (at / seconds), hi = !hi) {
      alarm.frequency.setValueAtTime((hi ? 880 : 660) * (1 + at / seconds), t + at);
    }
    const ag = ctx.createGain();
    ag.gain.value = 0.05;
    alarm.connect(ag).connect(bus);
    alarm.start(t);
    alarm.stop(t + seconds + 0.3);
    // Crashes and chirps, closer together as the screen fills.
    for (let at = 0; at < seconds; at += 0.5 - 0.42 * (at / seconds) + Math.random() * 0.08) {
      this.burstInto(bus, t + at, 0.08 + Math.random() * 0.25, 300 + Math.random() * 3000, 0.5);
      this.toneInto(bus, t + at, 200 + Math.random() * 1800, 0.05, 0.12, "sawtooth");
    }
    // Torn pieces of the glitch.
    const g = this.buffers.glitch;
    if (g) {
      for (let at = 0; at < seconds; at += 0.6 - 0.45 * (at / seconds)) {
        const src = ctx.createBufferSource();
        src.buffer = g;
        src.playbackRate.value = 0.7 + Math.random() * 0.8;
        const sg = ctx.createGain();
        sg.gain.value = 0.35;
        src.connect(sg).connect(bus);
        const from = 0.3 + Math.random() * 3;
        src.start(t + at, from, 0.12 + Math.random() * 0.2);
      }
    }
  }

  /**
   * The fake terminal's bomb (Owner, 2026-10-01): sharp high taps, rapid aggressive typing, distorted
   * crashes and bursts of static, closer together toward the end; over `seconds`.
   */
  trapBomb(seconds        )       {
    const ctx = this.ctx;
    if (!ctx) return;
    this.holdMusic(true, 0.3);
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.85, t + seconds * 0.3);
    bus.gain.setValueAtTime(0.85, t + seconds);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.3);
    const crush = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) curve[i] = Math.round(((i / 511) * 2 - 1) * 6) / 6;
    crush.curve = curve;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.ratio.value = 6;
    bus.connect(limiter).connect(this.master);
    // Sharp high taps: short, bright clicks.
    for (let at = 0; at < seconds; at += 0.07 + Math.random() * (0.22 - 0.15 * (at / seconds))) {
      this.toneInto(bus, t + at, 3200 + Math.random() * 3800, 0.012 + Math.random() * 0.01, 0.16, "square");
    }
    // Rapid, aggressive typing: the Owner's keyboard recordings, cut into strokes and sped up.
    const keys = this.buffers.bootKeys ?? this.buffers.keys;
    if (keys) {
      for (let at = 0; at < seconds; at += 0.035 + Math.random() * 0.06) {
        const src = ctx.createBufferSource();
        src.buffer = keys;
        src.playbackRate.value = 1.2 + Math.random() * 0.5;
        const g = ctx.createGain();
        g.gain.value = 0.45;
        src.connect(g).connect(bus);
        src.start(t + at, Math.random() * Math.max(0, keys.duration - 0.2), 0.06);
      }
    }
    // Crashes, distorted; static bursts.
    for (let at = 0.2; at < seconds; at += 0.6 - 0.4 * (at / seconds) + Math.random() * 0.15) {
      this.burstInto(crush, t + at, 0.12 + Math.random() * 0.3, 120 + Math.random() * 600, 0.6);
      this.burstInto(bus, t + at + 0.05, 0.08 + Math.random() * 0.18, 2500 + Math.random() * 4000, 0.3);
    }
    crush.connect(bus);
    const g = this.buffers.glitch;
    if (g) {
      for (let at = 0; at < seconds; at += 0.5 - 0.35 * (at / seconds)) {
        const src = ctx.createBufferSource();
        src.buffer = g;
        src.playbackRate.value = 0.8 + Math.random() * 0.9;
        const sg = ctx.createGain();
        sg.gain.value = 0.3;
        src.connect(sg).connect(crush);
        src.start(t + at, 0.3 + Math.random() * 3, 0.1 + Math.random() * 0.2);
      }
    }
  }

  /** An old TV switching off: a thump, the tube's high whine dying away, a last crackle. Then silence. */
  tvOff()       {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.sweep(t, 70, 30, 0.35, 0.18, "sine");
    this.burst(t, 0.12, "lowpass", 900, 0.12);
    const whine = ctx.createOscillator();
    whine.frequency.setValueAtTime(15700, t);
    whine.frequency.exponentialRampToValueAtTime(9000, t + 1.8);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.05, t);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    whine.connect(wg).connect(this.master);
    whine.start(t);
    whine.stop(t + 1.85);
    this.burst(t + 0.35, 0.06, "highpass", 4000, 0.05);
  }

          burst(t        , dur        , type                  , freq        , level        , q = 1)       {
    const ctx = this.ctx ;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

          toneInto(dest           , t        , freq        , dur        , level        , type                )       {
    const osc = this.ctx .createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx .createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

          tone(t        , freq        , dur        , level        , type                )       {
    this.sweep(t, freq, freq, dur, level, type);
  }

          sweep(t        , from        , to        , dur        , level        , type                )       {
    const ctx = this.ctx ;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

          whoosh(t        )       {
    const ctx = this.ctx ;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.7);
    f.frequency.exponentialRampToValueAtTime(600, t + 1.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 1.4);
    this.sweep(t, 90, 180, 1.2, 0.03, "sine");
  }

          pad(t        , freq        , level        , attack        , release        )       {
    const ctx = this.ctx ;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + release + 0.05);
  }
}

/** Finds the single keystrokes in a typing recording: sharp rises in loudness, at least 70 ms apart. */
function keystrokes(b             )           {
  const d = b.getChannelData(0);
  const step = Math.round(b.sampleRate * 0.005);
  const env           = [];
  for (let i = 0; i + step < d.length; i += step) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += d[i + j] * d[i + j];
    env.push(Math.sqrt(sum / step));
  }
  const at           = [];
  let last = -Infinity;
  for (let k = 2; k < env.length; k++) {
    if (env[k] > 0.08 && env[k] > env[k - 2] * 3 && k - last > 14) {
      at.push(k * 0.005);
      last = k;
    }
  }
  return at.filter((t) => t + 0.12 < b.duration);
}
