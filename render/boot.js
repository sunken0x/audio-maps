/*  RENDER CARD — the marketing renderer.
 *
 *  Draws a piece exactly as the token draws it, then mounts that picture in a
 *  card with a frame and a caption, and records the whole thing to video with
 *  the music on the same track.
 *
 *  The artwork half of this file is the token's own boot script, unminified.
 *  It must stay in step with it: same wave table, same chaos curve, same
 *  linewidth, same flicker. If a render looks unlike the piece it is named
 *  after, suspect these tables first — they have been wrong twice.
 */

const bin = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function gz(u){
  if (u[0] !== 31 || u[1] !== 139) return new TextDecoder().decode(u);
  return await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
}
const run = s => (0, eval)(s);
const mod = (a, b) => a - Math.floor(a / b) * b;
const TAU = Math.PI * 2;

const WAVES = [
  (x,y,t)=>Math.sin(t*0.0016-Math.sqrt(x*x+y*y)*2.0)*2.5,
  (x,y,t)=>Math.sin(t*0.001-Math.sqrt(x*x+y*y)*0.6)*2,
  (x,y,t)=>Math.sin(t*0.001+x*2)*2,
  (x,y,t)=>Math.sin(t*0.001+(x+y)*1.5)*2,
  (x,y,t)=>Math.sin(t*0.002+Math.atan2(y,x)*3)*2,
  (x,y,t)=>Math.sin(t*0.001+x*2)*Math.cos(t*0.001+y*2)*2,
  (x,y,t)=>Math.sin(t*0.001+x*1.5)*2.2,
  (x,y,t)=>((mod(t*0.001+x*2,TAU)/Math.PI)-1)*2,
  (x,y,t)=>(Math.sin(t*0.001+(x+y)*1.5)+Math.sin(t*0.001+(x-y)*1.5))*1.2,
  (x,y,t)=>Math.sin(t*0.001-Math.max(Math.abs(x),Math.abs(y))*0.8)*2
];

/*  The ten wave names. These are a PRESENTATION layer: the engine holds ten
 *  unnamed maths functions and knows nothing about these strings, so the two
 *  lists are only in step because they sit next to each other. Reorder or edit
 *  WAVES above and every wave name ever published silently points at a
 *  different pattern. Keep them adjacent, and change them together or not at
 *  all. Same list as render/mint.html. */
const WAVE_NAMES = ["Smooth Center","Circular Ripple","Linear Wave","Diagonal Sweep",
  "Radial Burst","Cross Pattern","Square Wave","Sawtooth Wave","Zigzag Pattern",
  "Concentric Squares"];


/*  Read off CHAOS_GLITCH / CHAOS_OCTAVES in the engine, never from a summary.
 *  A wrong table here makes a render show a different amount of destruction
 *  than the piece actually plays, and that has happened in both directions. */
const CG = [0, 0, 0.3, 0.7, 1.2, 2.0, 3.0, 4.5, 3.75, 3.3];
const CO = [0, 1, 1, 2, 2, 2, 3, 3, 4, 4];

function fn2(x, y, t, o){
  let r = Math.sin(x*0.5+t*0.003)*Math.cos(y*0.3+t*0.004);
  if (o >= 2) r += Math.sin(x*1.2+t*0.007)*Math.cos(y*0.8+t*0.005)*0.5;
  if (o >= 3) r += Math.sin(x*2.1+t*0.012)*Math.cos(y*1.5+t*0.009)*0.25
                 + Math.sin((x+y)*0.2+t*0.002)*Math.cos((x-y)*0.15+t*0.003)*0.3;
  if (o >= 4) r += Math.sin(x*3.5+t*0.018)*Math.cos(y*2.8+t*0.014)*0.125;
  return r;
}

// ── note ripples ──────────────────────────────────────────────────────────
const rip = [];
let bassFlash = 0;
function ripAt(d, t){
  let z = 0;
  for (let i = rip.length - 1; i >= 0; i--){
    const r = rip[i], age = t - r.t0;
    if (age > r.decay){ rip.splice(i, 1); continue; }
    const env = 1 - age / r.decay, dr = d - r.speed * age;
    z += r.amp * env * env * Math.cos(dr * r.k) * Math.exp(-(dr*dr)/(r.width*r.width));
  }
  return z;
}
function spawn(name, vel, now){
  const oct = parseInt(name.slice(-1), 10);
  let amp = 2.25, sp = 0.014, k = 1.1, wd = 2.4, dc = 1500;
  if (oct <= 2){ amp = 5.625; sp = 0.0085; k = 0.55; wd = 4.5; dc = 2600; }
  let v = vel; if (!(v > 0.4)) v = 0.4; if (v > 1) v = 1;
  rip.push({ t0: now, amp: amp*v, speed: sp, k, width: wd, decay: dc });
  if (oct <= 2) bassFlash = Math.min(1, bassFlash + 1.4 * v);
  if (rip.length > 14) rip.shift();
}

// ── card layout ───────────────────────────────────────────────────────────
const FORMATS = {
  "1:1":  [1080, 1080],
  "4:5":  [1080, 1350],
  "9:16": [1080, 1920],
  "16:9": [1920, 1080]
};
const COLLECTION = "AUDIOMAPS";
/*  The matte is the CARD, not the artwork. The picture's own background comes
 *  from the seed (p.scheme.bgColor) and is never touched here, so a piece
 *  rendered on any matte is still the true piece. Recolouring the artwork
 *  itself would be showing a token that does not exist. */
const MATTES = {
  paper: { bg: "#efece4", ink: "#16161d", rule: "rgba(22,22,29,0.30)" },
  ink:   { bg: "#0c0c11", ink: "#e8e5dd", rule: "rgba(232,229,221,0.28)" },
  green: { bg: "#00c805", ink: "#04220a", rule: "rgba(4,34,10,0.32)" },
  lime:  { bg: "#ccff00", ink: "#1c3d00", rule: "rgba(28,61,0,0.34)" }
};

/* Letter-spaced text. ctx.letterSpacing exists in Chrome but not everywhere,
 * and a render that silently loses its tracking on one machine is worse than
 * one that never had it, so this is drawn a glyph at a time. */
function track(ctx, text, x, y, sp){
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + sp;
  w -= sp;
  let cx = x;
  if (ctx.textAlign === "center") cx = x - w / 2;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of text){ ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
  ctx.textAlign = prev;
  return w;
}

const $ = id => document.getElementById(id);
const say = m => { $("log").textContent = m; };

/*  keccak256 — needed to turn an ENS name into the address the piece is
 *  composed from. Written out rather than pulled from a library so the page
 *  stays self-contained, and used to DERIVE the two function selectors below
 *  instead of quoting them: a selector written from memory has been wrong here
 *  before. Verified at load against two published vectors.
 *  64-bit lanes as BigInt — slower than a 32-bit split and called perhaps ten
 *  times a session, so the trade is entirely on the side of being right. */
const M64 = (1n << 64n) - 1n;
const RC = ["1","8082","800000000000808A","8000000080008000","808B","80000001",
  "8000000080008081","8000000000008009","8A","88","80008009","8000000A",
  "8000808B","800000000000008B","8000000000008089","8000000000008003",
  "8000000000008002","8000000000000080","800A","800000008000000A",
  "8000000080008081","8000000000008080","80000001","8000000080008008"]
  .map(h => BigInt("0x" + h));
const ROT = [1,3,6,10,15,21,28,36,45,55,2,14,27,41,56,8,25,43,62,18,39,61,20,44];
const PIL = [10,7,11,17,18,3,5,16,8,21,24,4,15,23,19,13,12,2,20,14,22,9,6,1];
const rotl = (v, n) => ((v << n) | (v >> (64n - n))) & M64;

function keccakF(A){
  const C = new Array(5), T = new Array(5);
  for (let r = 0; r < 24; r++){
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x+5] ^ A[x+10] ^ A[x+15] ^ A[x+20];
    for (let x = 0; x < 5; x++){
      const D = C[(x+4)%5] ^ rotl(C[(x+1)%5], 1n);
      for (let y = 0; y < 25; y += 5) A[x+y] ^= D;
    }
    let last = A[1];
    for (let i = 0; i < 24; i++){
      const j = PIL[i], tmp = A[j];
      A[j] = rotl(last, BigInt(ROT[i]));
      last = tmp;
    }
    for (let y = 0; y < 25; y += 5){
      for (let x = 0; x < 5; x++) T[x] = A[y+x];
      for (let x = 0; x < 5; x++) A[y+x] = T[x] ^ ((~T[(x+1)%5] & M64) & T[(x+2)%5]);
    }
    A[0] ^= RC[r];
  }
  return A;
}
function keccak256(bytes){
  const RATE = 136;
  const pad = RATE - (bytes.length % RATE);
  const msg = new Uint8Array(bytes.length + pad);
  msg.set(bytes);
  msg[bytes.length] |= 0x01;          // keccak padding, not the SHA-3 0x06
  msg[msg.length - 1] |= 0x80;
  let A = new Array(25).fill(0n);
  for (let off = 0; off < msg.length; off += RATE){
    for (let i = 0; i < RATE / 8; i++){
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(msg[off + i*8 + b]);
      A[i] ^= lane;
    }
    A = keccakF(A);
  }
  let out = "";
  for (let i = 0; i < 4; i++){
    let lane = A[i];
    for (let b = 0; b < 8; b++){ out += (lane & 0xffn).toString(16).padStart(2, "0"); lane >>= 8n; }
  }
  return out;
}
const utf8 = s => new TextEncoder().encode(s);
const hexBytes = h => Uint8Array.from(h.match(/../g).map(x => parseInt(x, 16)));
const selector = sig => keccak256(utf8(sig)).slice(0, 8);

function namehash(name){
  let node = "00".repeat(32);
  if (name){
    for (const label of name.split(".").reverse())
      node = keccak256(hexBytes(node + keccak256(utf8(label))));
  }
  return node;
}

const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
/* No RPC field on the page any more, so there is nowhere to type a working one
 * if the first is down. Hence a list: they are tried in order and the first
 * that answers wins. Only ever used to turn a name into an address. */
const RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://cloudflare-eth.com"
];
async function rpc(to, data, url){
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
      params: [{ to, data: "0x" + data }, "latest"] }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
/// name -> address, straight off the ENS registry. Null if it does not resolve.
async function resolveOn(name, url){
  const node = namehash(name.toLowerCase());
  const res = await rpc(ENS_REGISTRY, selector("resolver(bytes32)") + node, url);
  if (!res || /^0x0*$/.test(res)) return null;
  const resolver = "0x" + res.slice(-40);
  const got = await rpc(resolver, selector("addr(bytes32)") + node, url);
  if (!got || /^0x0*$/.test(got)) return null;
  return "0x" + got.slice(-40);
}
/*  AUDIO MAPS, live on mainnet. Typing a token number reads that token's own
 *  seed off the contract and renders the actual piece somebody owns, rather
 *  than composing something new from a wallet. Post-reveal this is what most
 *  people want from the tool: hear mine, hear theirs.
 *
 *  The name comes from the metadata contract, so a revealed token renders as
 *  "BRINE PULSE" and an unrevealed one as "Audio Maps #417" without this file
 *  needing to know which is which. */
const AUDIOMAPS = "0x31e107afb3e76ca66f91be62b8b65a1a30ed55d8";
const METADATA  = "0xa569216ca382e548a5162eb0c2888c289b7ef44c";

/// ABI-decode a single returned string.
function decodeString(hex){
  if (!hex || hex === "0x") return "";
  const b = hex.slice(2);
  const len = parseInt(b.slice(64, 128), 16);
  let out = "";
  for (let i = 0; i < len; i++) out += String.fromCharCode(parseInt(b.substr(128 + i * 2, 2), 16));
  return out;
}

/// seed and name for one token, over whichever endpoint answers first.
async function tokenPiece(id){
  const arg = BigInt(id).toString(16).padStart(64, "0");
  let last = null;
  for (const url of RPCS){
    try {
      const seed = decodeString(await rpc(AUDIOMAPS, selector("seedHex(uint256)") + arg, url));
      if (!/^0x[0-9a-f]{64}$/.test(seed)) throw new Error("no seed for token " + id);
      let name = "";
      try { name = decodeString(await rpc(METADATA, selector("nameOf(uint256)") + arg, url)); }
      catch (e){ /* unrevealed or metadata swapped: the piece still plays */ }
      return { seed, name: name || ("Audio Maps #" + id) };
    } catch (e){ last = e; }
  }
  throw last || new Error("no endpoint answered");
}

/*  THE TOKEN INDEX.
 *
 *  Collectors know their piece by its NAME. Almost nobody has looked up the
 *  number - the name is what the marketplace shows and what they say out loud.
 *  So the tool has to accept "LATE SWARM" as readily as 66.
 *
 *  Searching by name means holding all 1,000 names, and asking the chain for
 *  them one at a time is 1,000 round trips per visitor. They are written on
 *  chain once and do not drift, so pull-names.mjs pulls them into tokens.json
 *  and this reads that. If the file is missing, numbers still work and only
 *  name search is lost - the tool degrades rather than dying. */
let TOKENS = null, BY_NAME = null, TOKENS_P = null, TOKENS_FAILED = false;
/*  Guard on the PROMISE, not the result. Guarding on the value let the startup
 *  load and the first compose both get past the check before either finished,
 *  so the list was fetched twice and every name appeared twice in the
 *  autocomplete. */
function loadTokens(){ return TOKENS_P || (TOKENS_P = _loadTokens()); }
async function _loadTokens(){
  try {
    /*  Versioned like the scripts. A stale tokens.json is less dangerous than
     *  stale code, but a cached one from before the rare flags existed would
     *  let the forge accept a moment, which is the one thing it must not do. */
    const r = await fetch("tokens.json?v=20260821d");
    if (!r.ok) throw new Error(r.status);
    TOKENS = await r.json();
  } catch (e){
    /*  SAY SO. When this file fails to load, every name stops resolving and the
     *  only symptom was "not a token number, ENS name, wallet or 0x hash" on a
     *  name that is obviously a piece. That reads as COMPOSE being broken, not
     *  as a missing file, and it sent us hunting a bug that was not there. */
    TOKENS = []; TOKENS_FAILED = true;
    return TOKENS;
  }
  BY_NAME = new Map();
  for (const t of TOKENS) BY_NAME.set(t.n.toLowerCase(), t);
  const dl = $("names");
  if (dl){
    const frag = document.createDocumentFragment();
    for (const t of TOKENS){
      const o = document.createElement("option");
      o.value = t.n; o.label = "#" + t.i;
      frag.appendChild(o);
    }
    dl.appendChild(frag);
  }
  return TOKENS;
}
/*  Loose name matching, because people type what they remember. Exact first,
 *  then unique prefix, then unique substring. AMBIGUOUS IS AN ERROR, not a
 *  guess: silently picking the first of several matches would render somebody
 *  else's piece under the name they typed, and they would never know. */
function findByName(q){
  if (!BY_NAME) return null;
  const k = q.trim().toLowerCase();
  if (!k) return null;
  const exact = BY_NAME.get(k);
  if (exact) return exact;
  let hits = TOKENS.filter(t => t.n.toLowerCase().startsWith(k));
  if (!hits.length) hits = TOKENS.filter(t => t.n.toLowerCase().includes(k));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1){
    const e = new Error(`"${q}" matches ${hits.length} pieces - ${hits.slice(0,3).map(t => t.n).join(", ")}${hits.length>3?"…":""}`);
    e.ambiguous = true; throw e;
  }
  return null;
}

/// Same, over whichever endpoint answers first. Throws only if none of them do,
/// which is the one case worth telling the user about.
async function resolveENS(name){
  let last = null;
  for (const url of RPCS){
    try { return await resolveOn(name, url); }
    catch (e){ last = e; }
  }
  throw last || new Error("no endpoint answered");
}

(async () => {
try {
  say("unpacking three.js, tone.js, the engine and the piano…");
  run(await gz(bin(B.three)));
  run(await gz(bin(B.line2)));
  run(await gz(bin(B.tone)));
  run(await gz(bin(B.engine)));

  const card = $("card");
  const cctx = card.getContext("2d");
  const art  = document.createElement("canvas");

  const SP = 0.345, NLB = 72, PTB = 72;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const rn = new THREE.WebGLRenderer({ canvas: art, antialias: true });
  rn.setPixelRatio(1);
  const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ color: 0x000000 }));
  bgMesh.position.z = -10; scene.add(bgMesh);
  const mat = new THREE.LineMaterial({ color: 0xffffff, linewidth: 2.5,
    transparent: true, opacity: 0.9, worldUnits: false });
  const grp = new THREE.Group(); scene.add(grp);
  const lines = [];
  let NL = NLB, PT = PTB, hx = 0, hy = 0;

  let p = null, urls = null, seedLabel = "", seedAddr = "";
  /*  THE FORGED DUET, previewed. pB is the second parent; when it is null
   *  everything below behaves exactly as it always has, so solo is untouched. */
  let pB = null;
  const SPLIT = 52;                                    // E3 - bass below, top above
  function midiOf(n){ const q = split(n), k = PC.indexOf(q[0]); return k < 0 ? -1 : k + (1 + q[1]) * 12; }
  function dur16(d){ const dot = d.indexOf(".") >= 0, tri = d.indexOf("t") >= 0;
    const b = {1:16,2:8,4:4,8:2,16:1,32:0.5}[parseInt(d,10)] || 2; return b*(dot?1.5:1)*(tri?2/3:1); }
  function at16(t){ const q = String(t).split(":"); return (+q[0])*16 + (+q[1])*4 + (+(q[2]||0)); }
  function mixHex(a, b, t){
    const r = Math.round(((a>>16)&255) + (((b>>16)&255)-((a>>16)&255))*t);
    const g = Math.round(((a>>8)&255)  + (((b>>8)&255) -((a>>8)&255)) *t);
    const c = Math.round((a&255)       + ((b&255)      -(a&255))      *t);
    return (r<<16)|(g<<8)|c;
  }
  /*  Bass from one parent, top from the other, split at E3 - the merge the
   *  forge performs. The bass is forced MONOPHONIC: two parents overlapping in
   *  the bottom octaves turns to mud on the Kawai, so the earliest note wins
   *  its slot and anything starting inside it is dropped.
   *
   *  PLACE each parent in its register before splitting, do not merely filter
   *  by it. Filtering alone was the first version and it is wrong for most
   *  pairs. Measured on 417 + 233: ROLLING is treble-heavy, so only 8 of its 84
   *  notes fell below E3, and STAGGER is bass-heavy, so NONE of its 72 reached
   *  it. The result was eight notes of one parent and silence from the other -
   *  a "duet" that was a thinned-out solo. Across a thousand tokens people will
   *  pair anything, and a merge that only works when both parents happen to
   *  suit their roles does not work.
   *
   *  Each parent is moved by WHOLE OCTAVES until its middle note sits in the
   *  register it has been given. Octaves preserve the key, and the two halves
   *  must still agree harmonically - that is what ks aligns.
   *
   *  Loop length is the BASS parent's. Where the top parent is longer its
   *  overhanging notes are dropped rather than stretching the loop, because a
   *  loop long enough for both leaves the bass silent for half of it. */
  function duetEvents(A, B, oct){
    const ks  = A.transposeSemis - B.transposeSemis;
    const tsA = A.transposeSemis + (A.octaveShift + oct) * 12;
    const tsB = B.transposeSemis + (B.octaveShift + oct) * 12 + ks;
    const bars16 = A.motif.loopBars * 16;
    const median = (mel, ts) => {
      const v = mel.map(a => midiOf(a[1]) + ts).filter(m => m >= 0).sort((x, y) => x - y);
      return v.length ? v[v.length >> 1] : 60;
    };
    const fit = (mel, ts, centre) => {
      let k = Math.round((centre - median(mel, ts)) / 12);
      if (k > 3) k = 3; if (k < -3) k = -3;            // never fling a part off the keyboard
      return ts + k * 12;
    };
    const fA = fit(A.motif.melody, tsA, 40);           // around E2, under the split
    const fB = fit(B.motif.melody, tsB, 64);           // around E4, over it

    /*  FOLD into the register, never discard.
     *
     *  Filtering after the octave fit still threw most of the bass away, and
     *  the reason is shift(): it clamps to MIDI 36..96, so a note pushed under
     *  36 folds back UP an octave, lands above E3 and is then dropped for not
     *  being bass. Measured on 417 + 233 that left 8 bass notes against 66 top.
     *
     *  Folding by octave keeps the pitch class - which is what makes it still
     *  the same tune - while guaranteeing the note lands in the half it was
     *  assigned to. Contour compresses, exactly as a bass reduction does. */
    const NAME = v => PC[mod(v, 12)] + (Math.floor(v / 12) - 1);
    const fold = (v, lo, hi) => { while (v >= hi) v -= 12; while (v < lo) v += 12; return v; };
    const low = A.motif.melody
      .map(a => { const m = midiOf(a[1]); return m < 0 ? null
        : [a[0], NAME(fold(m + fA, 33, SPLIT)), a[2], a[3] * A.velMul]; })
      .filter(Boolean)
      .sort((x, y) => at16(x[0]) - at16(y[0]));
    const mono = []; let free = -1;
    for (const e of low){ const st = at16(e[0]); if (st < free) continue; mono.push(e); free = st + dur16(e[2]); }
    const high = B.motif.melody
      .map(a => { const m = midiOf(a[1]); return m < 0 || at16(a[0]) >= bars16 ? null
        : [a[0], NAME(fold(m + fB, SPLIT, 85)), a[2], a[3] * B.velMul * 0.92]; })
      .filter(Boolean);
    return mono.concat(high).map(e => ({
      time: e[0], note: e[1], dur: e[2],
      vel: Math.max(0.05, Math.min(1, e[3])) }));
  }
  let msd = null;
  let smp = null, part = null, t0 = performance.now();

  function build(aw, ah){
    for (const l of lines){ l.mesh.geometry.dispose(); grp.remove(l.mesh); }
    lines.length = 0;
    const asp = aw / ah, vert = (p.orientation === "vertical");
    if (vert){ NL = Math.round(NLB*Math.max(1,asp)); PT = Math.round(PTB/Math.min(1,asp)); }
    else     { NL = Math.round(NLB/Math.min(1,asp)); PT = Math.round(PTB*Math.max(1,asp)); }
    hx = 0; hy = 0;
    for (let li = 0; li < NL; li++){
      const pos = [], orig = [];
      for (let pi = 0; pi < PT; pi++){
        let X, Y;
        if (vert){ X = (li-NL/2)*SP; Y = (pi-PT/2)*SP; }
        else     { X = (pi-PT/2)*SP; Y = (li-NL/2)*SP; }
        pos.push(X, Y, 0); orig.push({ x: X, y: Y });
        if (Math.abs(X) > hx) hx = Math.abs(X);
        if (Math.abs(Y) > hy) hy = Math.abs(Y);
      }
      const g = new THREE.LineGeometry(); g.setPositions(pos);
      /* A material PER LINE. One shared material cannot crossfade, and the
       * forged duet's whole idea is that colour walks from one parent to the
       * other down the field with no seam. ~40 lines, so the extra draw state
       * costs nothing measurable. */
      const lm = mat.clone();
      const m = new THREE.Line2(g, lm); m.computeLineDistances();
      grp.add(m); lines.push({ mesh: m, mat: lm, orig, buf: new Float32Array(PT*3) });
    }
    /* The token page scales linewidth in CSS pixels against the window. Here
     * the canvas is 1080 tall regardless of the screen, so the weight has to
     * be scaled to that or a render comes out spidery next to the live page. */
    mat.linewidth = 2.5 * (ah / 900);
    mat.resolution.set(aw, ah);
    for (const l of lines){ l.mat.linewidth = mat.linewidth; l.mat.resolution.set(aw, ah); }
    const th = Math.tan(75 * Math.PI / 360);
    cam.aspect = asp;
    cam.position.set(0, 0, Math.max(hy/th, hx/(th*asp)) * 1.20);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    rn.setSize(aw, ah, false);
  }

  // ── the card ────────────────────────────────────────────────────────────
  let L = null;
  function layout(){
    const [W, H] = FORMATS[$("fmt").value];
    const M = MATTES[$("matte").value];
    card.width = W; card.height = H;

    /* Type is sized off the SHORT side, not the width. Scaling off width made
     * every measurement in the landscape card half again too big, and the
     * caption block then ate most of the 1080 of height it had to share —
     * which is what left the picture long and thin. */
    const U = Math.min(W, H);
    const pad = Math.round(U * 0.062);
    let aw, ah, cap;

    if (W > H * 1.2){
      /* Landscape puts the caption BESIDE the picture. Stacked, a caption deep
       * enough to read leaves the art a letterbox strip, and an Audio Map needs
       * height to show the terrain coming at the camera. */
      ah = H - pad * 2;
      aw = Math.min(Math.round(ah * 1.34), Math.round(W * 0.68));
      const gap = Math.round(U * 0.058);
      cap = { x: pad + aw + gap, w: W - (pad + aw + gap) - pad, beside: true };
    } else {
      const capH = Math.round(U * 0.155);
      aw = W - pad * 2;
      ah = H - pad * 2 - capH;
      if (ah > aw * 1.35) ah = Math.round(aw * 1.35);
      cap = { x: pad, w: aw, beside: false };
    }
    L = { W, H, M, U, pad, aw, ah, ax: pad, ay: pad, cap };
    art.width = aw; art.height = ah;
    build(aw, ah);
  }

  function frameCard(){
    const { W, H, M, U, pad, aw, ah, ax, ay, cap } = L;
    cctx.fillStyle = M.bg; cctx.fillRect(0, 0, W, H);
    cctx.drawImage(art, ax, ay, aw, ah);

    // the frame: a hairline on the picture, and a second rule set off from it
    cctx.strokeStyle = M.rule; cctx.lineWidth = 2;
    cctx.strokeRect(ax + 1, ay + 1, aw - 2, ah - 2);
    const o = Math.round(U * 0.014);
    cctx.globalAlpha = 0.45; cctx.lineWidth = 1;
    cctx.strokeRect(ax - o, ay - o, aw + o*2, ah + o*2);
    cctx.globalAlpha = 1;

    // ── caption ────────────────────────────────────────────────────────────
    const big = Math.round(U * 0.040);
    const L2  = Math.round(U * 0.045);   // name,   from the title baseline
    const L3  = Math.round(U * 0.077);   // traits
    const bx  = cap.x;
    const by  = cap.beside
      ? ay + Math.round((ah - L3) / 2) + big      // centred against the picture
      : ay + ah + Math.round(U * 0.052);

    cctx.fillStyle = M.ink;
    cctx.textAlign = "left"; cctx.textBaseline = "alphabetic";
    cctx.font = `700 ${big}px ui-sans-serif,-apple-system,Helvetica,Arial,sans-serif`;
    track(cctx, COLLECTION, bx, by, big * 0.16);

    /* Anything wider than the column steps DOWN in size rather than
     * truncating. The name is whatever was typed, ENS or hex, never swapped
     * for the other — and a half-shown wallet is not something anyone can
     * check. In landscape the column is much narrower, so this matters. */
    const fit = (text, px) => {
      let s = px;
      cctx.font = `500 ${s}px ui-monospace,Menlo,monospace`;
      while (cctx.measureText(text).width > cap.w && s > 9){
        s -= 1;
        cctx.font = `500 ${s}px ui-monospace,Menlo,monospace`;
      }
    };

    cctx.globalAlpha = 0.8;
    fit(seedLabel, Math.round(U * 0.0245));
    cctx.fillText(seedLabel, bx, by + L2);

    const traits = pB
      ? `FORGED   ${p.motif.name} BASS   ${pB.motif.name} TOP   ${p.tempo} BPM   ${p.scheme.name} \u2192 ${pB.scheme.name}`
      : `${p.motif.name}   ${p.tempo} BPM   CHAOS ${p.chaos}   ${p.scheme.name}   ${WAVE_NAMES[p.waveIdx]}`;
    cctx.globalAlpha = 0.5;
    fit(traits, Math.round(U * 0.019));
    cctx.fillText(traits, bx, by + L3);
    cctx.globalAlpha = 1;

    // bass bloom, over the picture only
    if (bassFlash > 0.004){
      const g = cctx.createRadialGradient(ax+aw/2, ay+ah/2, 0, ax+aw/2, ay+ah/2, aw*0.62);
      const c2 = p.scheme.color2;
      const r = (c2>>16)&255, gg = (c2>>8)&255, b = c2&255;
      const a = Math.min(1, bassFlash * 1.2);
      g.addColorStop(0,    `rgba(${r},${gg},${b},${(0.55*a).toFixed(3)})`);
      g.addColorStop(0.35, `rgba(${r},${gg},${b},${(0.25*a).toFixed(3)})`);
      g.addColorStop(1,    `rgba(${r},${gg},${b},0)`);
      cctx.save(); cctx.beginPath(); cctx.rect(ax, ay, aw, ah); cctx.clip();
      cctx.fillStyle = g; cctx.fillRect(ax, ay, aw, ah); cctx.restore();
    }
  }

  let fc = 0, flip = 0;
  function frame(t){
    fc++; if (fc >= 7){ fc = 0; flip = 1 - flip; }
    bassFlash *= 0.88;
    const CGV = CG[p.chaos], OCT = CO[p.chaos], WF = WAVES[p.waveIdx];
    /*  HORIZON. One field, but the terrain at one end belongs to one parent and
     *  the other end to the other, crossfading through the middle so there is no
     *  seam. Colour walks with it. Earlier two-parent pictures put the parents
     *  side by side and read as two artworks sharing a frame; this does not.
     *
     *  Each parent shows ITS OWN colour for the current flash, not the inverted
     *  one. Inverting B looks fine until the two palettes are inverses of each
     *  other - Plasma is magenta/cyan and Classic Sunken is cyan/magenta, so
     *  both ends landed on the same colour every frame and the crossfade
     *  vanished. Same index always shows two parents. */
    const bCGV = pB ? CG[pB.chaos] : 0, bOCT = pB ? CO[pB.chaos] : 0,
          bWF  = pB ? WAVES[pB.waveIdx] : null;
    const cA = flip === 0 ? p.scheme.color1 : p.scheme.color2;
    const cB = pB ? (flip === 0 ? pB.scheme.color1 : pB.scheme.color2) : 0;
    if (!pB) mat.color.setHex(cA);
    const span = Math.max(1, lines.length - 1);
    for (let i = 0; i < lines.length; i++){
      const Ln = lines[i], o = Ln.orig, b = Ln.buf;
      const bt = pB ? i / span : 0;
      Ln.mat.color.setHex(pB ? mixHex(cA, cB, bt) : cA);
      for (let j = 0; j < o.length; j++){
        const q = o[j], d = Math.sqrt(q.x*q.x + q.y*q.y);
        let z = WF(q.x, q.y, t) * 0.22;
        if (CGV > 0) z += fn2(q.x, q.y, t, OCT) * CGV;
        if (pB){
          let zb = bWF(q.x, q.y, t) * 0.22;
          if (bCGV > 0) zb += fn2(q.x, q.y, t, bOCT) * bCGV;
          z = z * (1 - bt) + zb * bt;
        }
        z += ripAt(d, t);
        b[j*3] = q.x; b[j*3+1] = q.y; b[j*3+2] = z;
      }
      Ln.mesh.geometry.setPositions(b);
      Ln.mesh.computeLineDistances();
    }
    rn.render(scene, cam);
    frameCard();
  }

  // ── the piano ───────────────────────────────────────────────────────────
  const SH = String.fromCharCode(35);
  const PC = ["C","C"+SH,"D","D"+SH,"E","F","F"+SH,"G","G"+SH,"A","A"+SH,"B"];
  function split(n){ let i = 1; if (n.charAt(1) === SH) i = 2; return [n.slice(0,i), parseInt(n.slice(i),10)]; }
  function shift(n, s){
    const q = split(n), k = PC.indexOf(q[0]);
    if (k < 0) return n;
    let v = k + (1 + q[1]) * 12 + s;
    while (v < 36) v += 12;
    while (v > 96) v -= 12;
    return PC[mod(v,12)] + (Math.floor(v/12) - 1);
  }
  {
    const pb = bin(B.piano), dv = new DataView(pb.buffer), ml = dv.getUint32(0);
    const man = JSON.parse(new TextDecoder().decode(pb.slice(4, 4+ml)));
    urls = {};
    const up = n => { const q = split(n); return q[0] + (q[1] + 1); };
    for (const m of man){
      if (m[0] === "C7") continue;                     // known broken sample
      urls[up(m[0])] = URL.createObjectURL(
        new Blob([pb.slice(4+ml+m[1], 4+ml+m[1]+m[2])], { type: "audio/ogg" }));
    }
  }

  /*  One input -> one address to compose from, plus the label the card shows.
   *  A token number is looked up on chain and comes back wearing its real name;
   *  an ENS is resolved only to find its address and is never replaced by the
   *  hex it points at. Throws something sayable rather than returning a quiet
   *  null, because two of these run back to back for a duet. */
  async function resolveInput(raw){
    const asToken = raw.replace(/^#/, "");
    if (/^\d{1,4}$/.test(asToken) && +asToken >= 1 && +asToken <= 1000){
      /*  The index already holds this token's seed, so a number needs no chain
       *  call either. It falls back to the contract when the file is absent. */
      const hit = TOKENS && TOKENS.find(t => t.i === +asToken);
      if (hit) return { addr: hit.s, label: hit.n, id: hit.i, rare: !!hit.r };
      let got;
      try { got = await tokenPiece(+asToken); }
      catch (e){ throw new Error("could not read token " + asToken + ": " + e.message); }
      return { addr: got.seed, label: got.name, id: +asToken };
    }
    /*  A NAME. Checked before ENS, because a piece called something with a dot
     *  in it must not be sent to the ENS registry. */
    const named = findByName(raw);
    if (named) return { addr: named.s, label: named.n, id: named.i, rare: !!named.r };
    if (/^0x[0-9a-fA-F]{8,64}$/.test(raw)) return { addr: raw.toLowerCase(), label: raw };
    if (raw.includes(".")){
      let got;
      try { got = await resolveENS(raw); }
      catch (e){ throw new Error("could not reach the chain to resolve that name: " + e.message); }
      if (!got) throw new Error(raw + " does not resolve to an address");
      return { addr: got.toLowerCase(), label: raw };
    }
    if (TOKENS_FAILED)
      throw new Error(`could not load the piece list, so names are unavailable \u2014 reload the page, or use the number instead of "${raw}"`);
    throw new Error("not a token number, ENS name, wallet or 0x hash: " + raw);
  }

  /*  INGREDIENT CHIP. A small still of one piece's own field, in its own
   *  colours, so the forge shows what is going IN and not only what comes out.
   *  Drawn in 2D at t=0 rather than as another three.js scene - three live
   *  scenes to decorate a sidebar is a lot of GPU for a thumbnail. */
  function chipDraw(cv, pp){
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.fillStyle = "#" + pp.scheme.bgColor.toString(16).padStart(6, "0");
    g.fillRect(0, 0, W, H);
    const WF = WAVES[pp.waveIdx], CGV = CG[pp.chaos], OCT = CO[pp.chaos];
    const NLc = 26, PTc = 34, SPc = 1.15;
    g.lineWidth = 1; g.globalAlpha = 0.85;
    for (let li = 0; li < NLc; li++){
      g.strokeStyle = "#" + (li % 8 < 4 ? pp.scheme.color1 : pp.scheme.color2)
        .toString(16).padStart(6, "0");
      g.beginPath();
      for (let pi = 0; pi < PTc; pi++){
        const x = (pi - PTc/2) * SPc, y = (li - NLc/2) * SPc;
        let z = WF(x, y, 0) * 0.22;
        if (CGV > 0) z += fn2(x, y, 0, OCT) * CGV;
        const sx = (pi / (PTc - 1)) * W;
        const sy = (li / (NLc - 1)) * (H * 0.78) + H * 0.11 - z * (H * 0.055);
        pi ? g.lineTo(sx, sy) : g.moveTo(sx, sy);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  function showIngredient(id, got, pp, rare){
    const box = $(id); if (!box) return;
    box.hidden = false;
    chipDraw(box.querySelector("canvas"), pp);
    /*  Say when a piece is a moment. Somebody looking at the forge needs to
     *  know WHY it was refused, not just that it was. */
    box.querySelector("b").innerHTML = (rare ? '<span class=rare>MOMENT</span> ' : "")
      + got.label.replace(/[<&]/g, c => c === "<" ? "&lt;" : "&amp;");
    /*  .tr, not "span". The rare badge is a span injected INSIDE <b>, so a bare
     *  querySelector("span") found the badge and wrote the traits into it -
     *  leaving the real trait line showing the PREVIOUS piece's values. A chip
     *  that displays one piece's name beside another's traits is the same
     *  mislabelling the render card already had once. */
    box.querySelector(".tr").innerHTML =
      `${pp.motif.name} \u00b7 ${pp.tempo} bpm \u00b7 chaos ${pp.chaos}<br>` +
      `${pp.scheme.name} \u00b7 ${WAVE_NAMES[pp.waveIdx]}`;
  }

  /*  WHICH PAGE THIS IS.
   *
   *  Rendering your own piece and forging two into a third are separate pages,
   *  not tabs. They were tabs for one build and it was wrong: the forge needs
   *  two inputs, two ingredient panels and a result panel, and stacking that
   *  behind a tab on a panel that was already full pushed the COMPOSE button
   *  off the bottom of the screen. Two jobs, two pages, one engine.
   *
   *  The page announces itself by having the forge's second input. No flag, no
   *  query string, nothing to keep in sync. */
  const MODE = $("seedA") ? "duet" : "one";

  /*  Which forge box a tapped wallet piece lands in. Tracks the last box the
   *  person actually touched, so tapping fills the one they are looking at. */
  let lastBox = "seedA";
  if (MODE === "duet"){
    $("seedA").addEventListener("focus", () => { lastBox = "seedA"; });
    $("seedB").addEventListener("focus", () => { lastBox = "seedB"; });
  }

  /*  CONNECT WALLET, read only.
   *
   *  This asks for the account and nothing else. It never requests a signature
   *  and never sends a transaction - there is nothing here to sign. The token
   *  contract has no enumeration, so ownership is found by asking ownerOf
   *  across the supply in batches. */
  let OWNED = [];
  async function batchOwners(url, ids){
    const sel = selector("ownerOf(uint256)");
    const body = ids.map((id, i) => ({ jsonrpc: "2.0", id: i, method: "eth_call",
      params: [{ to: AUDIOMAPS, data: "0x" + sel + BigInt(id).toString(16).padStart(64, "0") }, "latest"] }));
    const r = await fetch(url, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("rpc " + r.status);
    const j = await r.json();
    const out = new Array(ids.length).fill(null);
    for (const row of j) if (!row.error && row.result) out[row.id] = "0x" + row.result.slice(-40);
    return out;
  }
  $("connect").onclick = async () => {
    if (!window.ethereum){ say("no wallet in this browser \u2014 type a name or number instead"); return; }
    let acct;
    try {
      const got = await window.ethereum.request({ method: "eth_requestAccounts" });
      acct = (got && got[0] || "").toLowerCase();
    } catch (e){ say("wallet not connected"); return; }
    if (!acct){ say("wallet not connected"); return; }
    await loadTokens();
    $("connect").disabled = true;
    $("connect").textContent = acct.slice(0, 6) + "\u2026" + acct.slice(-4);
    say("looking through the collection for your pieces\u2026");
    /*  Twenty batched sweeps of the whole collection rate-limited every
     *  endpoint by the SECOND connect, which is why the first was fast and the
     *  rest crawled. The chain already knows which pieces ever reached this
     *  wallet: one log query for Transfer(*, wallet, *) since deploy, then one
     *  ownership check over just those ids. Cached for ten minutes, so
     *  reconnecting is instant. */
    const CK = "am_owned_" + acct;
    let mine = [];
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(CK) || "null"); } catch (e){}
    if (cached && Date.now() - cached.t < 600000){ mine = cached.ids; }
    else {
      const TT = "0x" + keccak256(utf8("Transfer(address,address,uint256)"));
      const acctTopic = "0x" + acct.slice(2).padStart(64, "0");
      /*  Free endpoints refuse a 60k-block log range but allow 10k, so the
       *  history is read in windows. dRPC first - it states the 10k limit
       *  plainly instead of failing mysteriously. */
      const LOGS_RPCS = ["https://eth.drpc.org"].concat(RPCS);
      const DEPLOY = 25777053, SPAN = 10000;
      const logCall = async (u, m, prm) => {
        const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: prm }) });
        const j = await r.json();
        if (j.error) throw new Error(j.error.message);
        return j.result;
      };
      let latest = null, li = 0;
      for (; li < LOGS_RPCS.length; li++){
        try { latest = Number(BigInt(await logCall(LOGS_RPCS[li], "eth_blockNumber", []))); break; }
        catch (e){}
      }
      const candSet = new Set(); let failed = latest === null ? new Error("no endpoint would answer") : null;
      for (let from = DEPLOY; !failed && from <= latest; from += SPAN){
        const to = Math.min(from + SPAN - 1, latest);
        let got = null, err = null;
        for (let t = 0; t < LOGS_RPCS.length && !got; t++){
          const u = LOGS_RPCS[(li + t) % LOGS_RPCS.length];
          try { got = await logCall(u, "eth_getLogs", [{ address: AUDIOMAPS,
            fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16),
            topics: [TT, null, acctTopic] }]); }
          catch (e){ err = e; }
        }
        if (!got){ failed = err; break; }
        got.forEach(l => candSet.add(Number(BigInt(l.topics[3]))));
        say("reading the wallet's history\u2026 " + Math.round((to - DEPLOY) / (latest - DEPLOY) * 100) + "\u0025");
      }
      if (failed){
        say("could not read the chain: " + failed.message);
        $("connect").disabled = false; $("connect").textContent = "CONNECT WALLET"; return;
      }
      const cand = [...candSet];
      say("checking " + cand.length + " candidate piece" + (cand.length === 1 ? "" : "s") + "\u2026");
      try {
        for (let i = 0; i < cand.length; i += 100){
          const slice = cand.slice(i, i + 100);
          let owners = null, err2 = null;
          for (const u of RPCS){ try { owners = await batchOwners(u, slice); break; } catch (e){ err2 = e; } }
          if (!owners) throw err2 || new Error("no endpoint would answer");
          owners.forEach((o, k) => { if (o === acct) mine.push(slice[k]); });
        }
      } catch (e){
        say("could not finish reading ownership: " + e.message);
        $("connect").disabled = false; $("connect").textContent = "CONNECT WALLET"; return;
      }
      mine.sort((a, b) => a - b);
      try { sessionStorage.setItem(CK, JSON.stringify({ ids: mine, t: Date.now() })); } catch (e){}
    }
    OWNED = mine;
    const box = $("owned"); box.innerHTML = "";
    if (!mine.length){ say("that wallet holds no Audio Maps"); $("walletHint").hidden = true; return; }
    for (const id of mine){
      const t = TOKENS.find(x => x.i === id);
      const b = document.createElement("button");
      b.textContent = (t && t.r ? "\u25c6 " : "") + (t ? t.n : "#" + id);
      b.title = t && t.r ? "#" + id + " - a moment, cannot be forged" : "#" + id;
      if (t && t.r) b.classList.add("rareChip");
      b.onclick = () => {
        const target = MODE === "duet" ? lastBox : "seed";
        $(target).value = t ? t.n : String(id);
        if (MODE === "duet") lastBox = lastBox === "seedA" ? "seedB" : "seedA";
      };
      box.appendChild(b);
    }
    $("walletHint").hidden = false;
    $("walletHint").textContent = MODE === "duet"
      ? "Tap a piece to load it into whichever box you used last."
      : "Tap a piece to render it.";
    say(`${mine.length} piece${mine.length === 1 ? "" : "s"} in that wallet. Tap one to load it.`);
  };

  /*  Swap the parents. Not cosmetic - A gives the bass, so this is genuinely a
   *  different piece and the quickest way to hear that for yourself. */
  if ($("swapAB")) $("swapAB").onclick = () => {
    const a = $("seedA").value; $("seedA").value = $("seedB").value; $("seedB").value = a;
    compose();
  };

  /* ── forged pieces ────────────────────────────────────────────────────
   *  A forged piece IS a pair: its parents are burned, but their seeds and
   *  the parentage live in the forge contract forever. So a holder - or a
   *  buyer who picked one up on secondary - types the token number or the
   *  name and the page fetches the parents itself. Nobody should have to
   *  work out what went into their own artwork.
   *  Selectors derived with cast sig, never from memory. */
  const FORGE_ADDR = "0x45Ac3a8da7cd547185Cba257DC2c0622a78F29dE";
  const META_ADDR  = "0xf0498169B1B3cA7781385D836d91A32A8d77e42c";
  const SEL_PARENTS = "26de059d", SEL_NAMEOF = "051a2664", SEL_MINTED = "a2309ff8";
  let FORGED_LIST = null;
  async function forgedIndex(){
    if (FORGED_LIST) return FORGED_LIST;
    let url = null, minted = null;
    for (const u of RPCS){
      try { minted = Number(BigInt(await rpc(AUDIOMAPS, SEL_MINTED, u))); url = u; break; }
      catch (e){}
    }
    if (minted === null) return (FORGED_LIST = []);
    const ids = []; for (let i = 1001; i <= minted; i++) ids.push(i);
    if (!ids.length) return (FORGED_LIST = []);
    const body = [];
    ids.forEach((id, k) => {
      body.push({ jsonrpc:"2.0", id: k*2,   method:"eth_call",
        params:[{ to: FORGE_ADDR, data: "0x" + SEL_PARENTS + BigInt(id).toString(16).padStart(64,"0") }, "latest"] });
      body.push({ jsonrpc:"2.0", id: k*2+1, method:"eth_call",
        params:[{ to: META_ADDR, data: "0x" + SEL_NAMEOF + BigInt(id).toString(16).padStart(64,"0") }, "latest"] });
    });
    try {
      const r = await fetch(url, { method:"POST", headers:{ "content-type":"application/json" },
                                   body: JSON.stringify(body) });
      const j = await r.json();
      const byId = {}; j.forEach(x => byId[x.id] = x.result);
      FORGED_LIST = ids.map((id, k) => {
        const pr = byId[k*2], nm = byId[k*2+1];
        if (!pr) return null;
        const a = Number(BigInt("0x" + pr.slice(2, 66))), b = Number(BigInt("0x" + pr.slice(66, 130)));
        let n = "Forged #" + id;
        if (nm){ try {
          const off = Number(BigInt("0x" + nm.slice(2, 66)));
          const len = Number(BigInt("0x" + nm.slice(2 + off*2, 2 + off*2 + 64)));
          const hexs = nm.slice(2 + off*2 + 64, 2 + off*2 + 64 + len*2);
          n = decodeURIComponent(hexs.replace(/(..)/g, "%$1"));
        } catch(e){} }
        return { i: id, n: n, a: a, b: b };
      }).filter(Boolean);
    } catch (e){ FORGED_LIST = []; }
    return FORGED_LIST;
  }
  async function forgedLookup(raw){
    raw = (raw || "").trim();
    if (!raw) return null;
    const num = raw.replace(/^#/, "");
    const isNum = /^\d{4}$/.test(num) && +num > 1000;
    if (!isNum && !/[A-Za-z]/.test(raw)) return null;
    const list = await forgedIndex();
    let hit = null;
    if (isNum) hit = list.find(t => t.i === +num);
    else { const up = raw.toUpperCase(); hit = list.find(t => t.n.toUpperCase() === up); }
    if (!hit) return null;
    await loadTokens();
    const label = id => { const t = TOKENS && TOKENS.find(x => x.i === id); return t ? t.n : String(id); };
    return { i: hit.i, n: hit.n, pa: label(hit.a), pb: label(hit.b) };
  }

  // ── compose ─────────────────────────────────────────────────────────────
  let timer = null;
  async function compose(){
    await loadTokens();

    /*  Which tab is open decides what is being made. No parsing of the single
     *  field into two - the forge has its own pair of inputs, because that is
     *  what the thing actually is: two pieces going in. */
    if (MODE === "duet"){
      let ra = $("seedA").value.trim(), rb = $("seedB").value.trim();
      /*  A forged piece in either box expands to its parents - the duet you
       *  hear IS that piece, reproducible forever from the recorded seeds. */
      const fg = (await forgedLookup(ra)) || (await forgedLookup(rb));
      if (fg){
        $("seedA").value = fg.pa; $("seedB").value = fg.pb;
        say(fg.n + " was forged from " + fg.pa + " and " + fg.pb + " \u2014 loading both");
        ra = fg.pa; rb = fg.pb;
      }
      if (!ra || !rb){ say("the forge needs two pieces"); return; }
      say("looking both up\u2026");
      let A, B;
      try { A = await resolveInput(ra); B = await resolveInput(rb); }
      catch (e){ say(e.message); return; }
      if (A.addr === B.addr){ say("a piece cannot duet with itself \u2014 pick two different pieces"); return; }
      /*  A RARE IS NOT AN INGREDIENT.
       *
       *  The 52 moments are the pieces Ethereum already contained, and the
       *  forge consumes what goes into it. Burning one would destroy something
       *  that cannot be minted again, so the contract will not permit it and
       *  this preview must not imply otherwise.
       *
       *  This page shipped for one build with a rare as its DEFAULT example -
       *  Etheria sitting in the A box, being forged, on the page that teaches
       *  people what the forge does. A preview that demonstrates the forbidden
       *  thing is worse than no preview. */
      const bad = [A, B].filter(x => x.rare);
      if (bad.length){
        say(bad.length === 2
          ? `${A.label} and ${B.label} are both moments \u2014 rares cannot be forged, they would be destroyed`
          : `${bad[0].label} is one of the 52 moments \u2014 rares cannot be forged, they would be destroyed`);
        showIngredient("ingA", A, AM125.derive(A.addr), A.rare);
        showIngredient("ingB", B, AM125.derive(B.addr), B.rare);
        $("forgedName").textContent = "\u2014";
        $("forgedTraits").textContent = "A moment cannot go into the forge.";
        return;
      }
      seedAddr = A.addr; seedLabel = A.label + "  \u00d7  " + B.label;
      p = AM125.derive(A.addr); pB = AM125.derive(B.addr);
      showIngredient("ingA", A, p, A.rare); showIngredient("ingB", B, pB, B.rare);
      $("forgedName").textContent = A.label + " \u00d7 " + B.label;
      $("forgedTraits").innerHTML =
        `${p.motif.name} bass over ${pB.motif.name} top<br>${p.tempo} bpm \u00b7 ` +
        `${p.scheme.name} \u2192 ${pB.scheme.name}`;
      bgMesh.material.color.setHex(p.scheme.bgColor);
      layout();
      rip.length = 0; bassFlash = 0;
      if (!timer){ t0 = performance.now(); timer = setInterval(() => frame(performance.now() - t0), 16); }
      if (part){ part.dispose(); part = null; Tone.Transport.stop(); Tone.Transport.cancel(); }
      say(`FORGED \u2014 ${p.motif.name} bass \u00b7 ${pB.motif.name} top \u00b7 ${p.tempo} bpm \u00b7 ${p.scheme.name} into ${pB.scheme.name}`);
      $("rec").disabled = !canRecord;
      $("saverow").hidden = true;
      $("loopsec").textContent = loopSeconds().toFixed(1);
      return;
    }
    pB = null;
    const raw = $("seed").value.trim();
    if (!raw){ say("type a piece name or number"); return; }

    /*  ONE resolver for both tabs, so a piece name works everywhere a number
     *  does. It used to be duplicated here and understood only numbers, ENS and
     *  hex - typing a piece NAME fell through to the error branch and returned.
     *
     *  ⚠ AND THE LABEL WAS ALREADY SET. seedLabel was assigned from the raw
     *  text BEFORE resolution, so bailing out left the previous artwork on
     *  screen wearing the name that had just been typed: LATE SWARM printed
     *  over Etheria's picture, traits and all. Somebody would have screenshot
     *  that and posted the wrong piece under the wrong name.
     *
     *  Nothing is labelled until it has resolved. */
    let got;
    try { got = await resolveInput(raw); }
    catch (e){ say(e.message); return; }
    seedAddr = got.addr;
    seedLabel = got.label;
    p = AM125.derive(seedAddr);
    showIngredient("ingOne", { label: seedLabel }, p, got.rare);
    bgMesh.material.color.setHex(p.scheme.bgColor);
    layout();
    rip.length = 0; bassFlash = 0;
    if (!timer){ t0 = performance.now(); timer = setInterval(() => frame(performance.now() - t0), 16); }
    if (part){ part.dispose(); part = null; Tone.Transport.stop(); Tone.Transport.cancel(); }
    say(`${p.motif.name} · ${p.tempo} bpm · chaos ${p.chaos} · ${p.scheme.name} · ${WAVE_NAMES[p.waveIdx]} · ${Object.keys(urls).length} notes`);
    $("rec").disabled = !canRecord;
    $("saverow").hidden = true;
    $("loopsec").textContent = loopSeconds().toFixed(1);
  }
  const loopSeconds = () => p ? p.motif.loopBars * 4 * 60 / p.tempo : 0;

  async function startAudio(){
    await Tone.start();
    if (!smp){
      smp = new Tone.Sampler({ urls, release: 2.1 }).toDestination();
      await Tone.loaded();
    }
    Tone.Transport.stop(); Tone.Transport.cancel();
    /* the old Part is still scheduled until it is disposed; without this a
     * second take plays the previous piece underneath the new one */
    if (part){ try { part.dispose(); } catch(e){} part = null; }
    Tone.Transport.bpm.value = p.tempo;
    /*  OCTAVE, a performance control on the RENDER only.
     *
     *  ⚠ This does NOT change the token. The piece on chain plays at the octave
     *  its seed chose, forever. This shifts the recording so a piece that sits
     *  too low on the Kawai's muddy bottom end can be heard properly in a video.
     *  A card rendered at +1 is a performance of the piece, not a copy of it.
     *
     *  shift() clamps to C2..C7, so notes that would leave the sampled range
     *  fold back rather than disappearing. */
    const oct = parseInt(($("oct") && $("oct").value) || "0", 10) || 0;
    const ts = p.transposeSemis + (p.octaveShift + oct) * 12;
    const ev = pB ? duetEvents(p, pB, oct) : p.motif.melody.map(a => {
      let v = a[3] * p.velMul; if (v < 0.05) v = 0.05; if (v > 1) v = 1;
      return { time: a[0], note: shift(a[1], ts), dur: a[2], vel: v };
    });
    part = new Tone.Part((tm, e) => {
      smp.triggerAttackRelease(e.note, e.dur, tm, e.vel);
      const lead = Math.max(0, (tm - Tone.now()) * 1000);
      setTimeout(() => spawn(e.note, e.vel, performance.now() - t0), lead);
    }, ev);
    part.loop = true; part.loopEnd = p.motif.loopBars + "m"; part.start(0);
    Tone.Transport.start();
  }

  // ── record ──────────────────────────────────────────────────────────────
  async function record(){
    if (!p) return;
    $("rec").disabled = true;
    await startAudio();

    /*  ONE tap, made once and left connected.
     *
     *  This used to build a MediaStreamDestination per take and disconnect it
     *  afterwards with Tone.Destination.disconnect(msd). That call takes the
     *  Destination's outputs with it, so the FIRST record worked and every one
     *  after it captured silence. An idle stream destination costs nothing, so
     *  it is made once and never torn down. */
    const rawCtx = Tone.context.rawContext || Tone.context;
    if (!msd){
      msd = rawCtx.createMediaStreamDestination();
      Tone.Destination.connect(msd);
    }

    const vs = card.captureStream(60);
    const stream = new MediaStream([...vs.getVideoTracks(), ...msd.stream.getAudioTracks()]);
    /* MP4 straight out of the recorder — H.264 and AAC, which is what every
     * platform wants. Chrome will happily record this; the webm fallback is
     * only there so an older browser degrades to a file rather than an error. */
    const CANDIDATES = [
      ["video/mp4;codecs=avc1.640028,mp4a.40.2", "mp4"],
      ["video/mp4;codecs=avc1,mp4a.40.2",        "mp4"],
      ["video/mp4",                              "mp4"],
      ["video/webm;codecs=vp9,opus",             "webm"],
      ["video/webm",                             "webm"]
    ];
    const pick = CANDIDATES.find(c => MediaRecorder.isTypeSupported(c[0]));
    if (!pick){ say("this browser cannot record video"); $("rec").disabled = false; return; }
    const [type, ext] = pick;
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16e6 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    const loops = parseInt($("loops").value, 10);
    const secs = loopSeconds() * loops;
    rec.start();
    const t = Date.now();
    const tick = setInterval(() => {
      const left = secs - (Date.now() - t) / 1000;
      say(`recording… ${Math.max(0, left).toFixed(1)}s left`);
    }, 200);

    await new Promise(r => setTimeout(r, secs * 1000));
    clearInterval(tick);
    rec.stop();
    await new Promise(r => rec.onstop = r);
    Tone.Transport.stop();
    /* msd deliberately stays connected — see the note where it is created */

    const slug = seedLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const name = `audiomaps-${slug}-${$("fmt").value.replace(":","x")}.${ext}`;
    const blob = new Blob(chunks, { type: type.split(";")[0] });
    const mb = (blob.size / 1e6).toFixed(1);

    /* The take is mounted in the player and NOTHING is saved until asked.
     * Dropping a file on someone's machine unbidden is rude on a desktop and
     * simply fails on most phones, where the way you keep a video is the share
     * sheet — into Photos, or straight into the app you are posting from. */
    const url = URL.createObjectURL(blob);
    const v = $("out");
    if (v.src) URL.revokeObjectURL(v.src);
    v.src = url; v.hidden = false;
    $("saverow").hidden = false;
    $("dl").onclick = async () => say(await saveTo(blob, name));

    /*  THE CAPTION IS DELIBERATELY GONE — 2026-08-17.
     *
     *  This page used to hand over a written post and a POST ON X button. It
     *  was the right call while the ask was volume, and it is the wrong call
     *  now: spots are given for saying something true about the collection in
     *  your own words, and a canned caption makes every entry read the same.
     *  Handing someone the words removes the only thing being judged.
     *
     *  The file share stays. On a phone the share sheet is how a video reaches
     *  Photos or the app you are posting from, so removing it would stop people
     *  posting at all. It carries the video and nothing else. The words are
     *  theirs. */
    const file = new File([blob], name, { type: blob.type });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    $("share").hidden = !canShare;
    if (canShare) $("share").onclick = async () => {
      try { await navigator.share({ files: [file] }); }
      catch (e){ if (e.name !== "AbortError") say("share failed: " + e.message); }
    };

    say(`${mb} MB, ${secs.toFixed(1)}s — ready below`);
    $("rec").disabled = false;
  }

  async function saveTo(blob, name){
    if (window.showSaveFilePicker){
      try {
        const mp4 = name.endsWith(".mp4");
        const h = await showSaveFilePicker({ suggestedName: name,
          types: [mp4 ? { description: "MP4 video", accept: { "video/mp4": [".mp4"] } }
                      : { description: "WebM video", accept: { "video/webm": [".webm"] } }] });
        const w = await h.createWritable();
        await w.write(blob); await w.close();
        return "written to disk";
      } catch (e){
        if (e.name === "AbortError") return "save cancelled, still in the player below";
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return "sent to downloads — if nothing arrived, press and hold the player to save it";
  }

  $("go").onclick = compose;
  $("rec").onclick = record;
  $("play").onclick = () => {
    if (Tone.Transport.state === "started"){ Tone.Transport.pause(); $("play").textContent = "play"; }
    else { startAudio(); $("play").textContent = "pause"; }
  };
  for (const id of ["fmt","matte"])
    $(id).onchange = () => { if (p) layout(); };
  for (const id of ["seed", "seedA", "seedB"])
    if ($(id)) $(id).addEventListener("keydown", e => { if (e.key === "Enter") compose(); });
  /*  Load the name index up front so the autocomplete list is populated before
   *  anybody types, not after their first compose. */
  loadTokens().then(t => {
    if (t.length) return;
    console.warn("tokens.json did not load - numbers still work, name search does not");
    say("could not load the piece list \u2014 names will not work until you reload. Numbers still do.");
  });

  // The hash implementation is load-bearing for ENS, so it is checked against
  // published vectors at startup rather than trusted.
  const KV = keccak256(utf8("")) === "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
          && namehash("eth") === "93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae";
  if (!KV) console.error("keccak256 self-test FAILED — ENS resolution is not trustworthy");

  window.__ready = { three: THREE.REVISION, tone: Tone.version,
    fat: typeof THREE.Line2 !== "undefined", keccakOK: KV };
  /* Say up front if this browser cannot record, rather than letting someone
   * sit through a take that was never going to produce a file. Recording needs
   * canvas capture AND MediaRecorder, and some mobile browsers have neither. */
  const canRecord = typeof MediaRecorder !== "undefined"
    && typeof card.captureStream === "function"
    && !!MediaRecorder.isTypeSupported;
  if (!canRecord){
    $("rec").disabled = true;
    $("rec").title = "this browser cannot record video";
  }

  /*  Sharable links. ?a=<ens or wallet> composes that piece on load, so a link
   *  can be sent to a person and open on THEIR piece rather than on a form they
   *  have to fill in. Anything the field accepts works here: an ENS name, a
   *  wallet, or a block hash. */
  const q = new URLSearchParams(location.search);
  const who = q.get("a") || q.get("wallet") || q.get("hash");
  if (who) $("seed").value = who;

  await compose();
  if (!canRecord) say("this browser cannot record — the picture and sound still work");

  // and a way to get that link back out
  /*  The COPY SHARE LINK button was removed 2026-08-18. It only ever put a URL
   *  on the clipboard, and a URL is the one thing that should never travel:
   *  people were posting the link instead of the video, so the artwork never
   *  appeared in the timeline. The ?a= seed parameter is still read on load,
   *  so links already shared keep working. The SHARE button below stays —
   *  that one hands over the actual MP4. */
} catch (e){
  say("error: " + e.message);
  console.error(e);
}
})();
