// Seeded, deterministic PRNG for Kill a Tower.
// Pure/synchronous, no DOM or Node deps — works identically in the browser and
// under node:test. Used to make runs reproducible given a fixed seed.
//
// Implementation: mulberry32, a small, well-known 32-bit seedable generator.

// Turn a string (or number) seed into a 32-bit unsigned int.
export function hashSeed(str) {
  if (typeof str === 'number') {
    // normalize to a 32-bit unsigned int
    return (str >>> 0);
  }
  const s = String(str);
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  return h >>> 0;
}

// Factory: makeRng(seed) -> rng object.
// seed may be a number or a string; strings (and non-integer seeds) are hashed.
export function makeRng(seed) {
  let a = (typeof seed === 'number' && Number.isInteger(seed))
    ? (seed >>> 0)
    : hashSeed(seed);

  // mulberry32 step -> float in [0, 1)
  function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // integer in [0, nMaxExclusive)
  function int(nMaxExclusive) {
    if (nMaxExclusive <= 0) return 0;
    return Math.floor(next() * nMaxExclusive);
  }

  // random element of a (non-empty) array
  function pick(array) {
    if (!array || array.length === 0) return undefined;
    return array[int(array.length)];
  }

  // return a NEW array shuffled with Fisher-Yates driven by next()
  function shuffle(array) {
    const out = [...array];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // expose/restore internal state (useful for tests + deriving sub-streams)
  function getState() {
    return a >>> 0;
  }

  // derive an independent child RNG deterministically from this stream + a label
  function fork(label = 0) {
    const mix = (getState() ^ hashSeed(label)) >>> 0;
    return makeRng(mix);
  }

  return { next, int, pick, shuffle, getState, fork };
}
