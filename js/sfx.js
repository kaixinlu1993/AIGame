export function createSfx() {
  let ctx = null;
  let muted = false;

  function context() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, delay = 0) {
    if (muted || !ctx) return;
    const audio = ctx;
    const t = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), t);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    setMuted(value) {
      muted = value;
    },
    unlock() {
      context();
    },
    drop() {
      tone(210, 0.06, "triangle", 0.045);
    },
    merge(tier, count) {
      const freq = 196 * 2 ** (tier / 8);
      tone(freq, 0.1 + tier * 0.008, "sine", 0.06);
      if (count > 1 || tier >= 6) tone(freq * 1.5, 0.12, "triangle", 0.03, 0.02);
    },
    rank() {
      tone(523, 0.08, "sine", 0.05, 0);
      tone(659, 0.1, "sine", 0.05, 0.07);
    },
    jackpot() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.16, "triangle", 0.06, i * 0.07));
    },
    over() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.16, "sine", 0.05, i * 0.08));
    },
  };
}
