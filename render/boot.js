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
const MATTES = {
  paper: { bg: "#efece4", ink: "#16161d", rule: "rgba(22,22,29,0.30)" },
  ink:   { bg: "#0c0c11", ink: "#e8e5dd", rule: "rgba(232,229,221,0.28)" }
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
      const m = new THREE.Line2(g, mat); m.computeLineDistances();
      grp.add(m); lines.push({ mesh: m, orig, buf: new Float32Array(PT*3) });
    }
    /* The token page scales linewidth in CSS pixels against the window. Here
     * the canvas is 1080 tall regardless of the screen, so the weight has to
     * be scaled to that or a render comes out spidery next to the live page. */
    mat.linewidth = 2.5 * (ah / 900);
    mat.resolution.set(aw, ah);
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

    const traits = `${p.motif.name}   ${p.tempo} BPM   CHAOS ${p.chaos}   ${p.scheme.name}   ${WAVE_NAMES[p.waveIdx]}`;
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
    mat.color.setHex(flip === 0 ? p.scheme.color1 : p.scheme.color2);
    bassFlash *= 0.88;
    const CGV = CG[p.chaos], OCT = CO[p.chaos], WF = WAVES[p.waveIdx];
    for (let i = 0; i < lines.length; i++){
      const Ln = lines[i], o = Ln.orig, b = Ln.buf;
      for (let j = 0; j < o.length; j++){
        const q = o[j], d = Math.sqrt(q.x*q.x + q.y*q.y);
        let z = WF(q.x, q.y, t) * 0.22;
        if (CGV > 0) z += fn2(q.x, q.y, t, OCT) * CGV;
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

  // ── compose ─────────────────────────────────────────────────────────────
  let timer = null;
  async function compose(){
    const raw = $("seed").value.trim();
    if (!raw){ say("type an ENS name or a wallet address"); return; }

    /* One field, either kind of input. What they typed is what the card says —
     * an ENS is resolved only to find the address to compose from, and the
     * name itself is never replaced with the hex it points at. */
    seedLabel = raw;
    /* Any hex seed, not just a 20-byte address. The engine takes a hash and
     * does not care how long it is, so a 32-byte BLOCK hash composes perfectly
     * well — the genesis block is a piece. Requiring exactly 40 characters was
     * the tool being narrower than the thing it drives. */
    /*  A bare number is a TOKEN, not a seed. 1 to 1000, with or without a #. */
    const asToken = raw.replace(/^#/, "");
    if (/^\d{1,4}$/.test(asToken) && +asToken >= 1 && +asToken <= 1000){
      say(`reading token ${asToken} off the chain…`);
      let got;
      try { got = await tokenPiece(+asToken); }
      catch (e){ say("could not read token " + asToken + ": " + e.message); return; }
      seedAddr = got.seed;
      seedLabel = got.name;                            // the card says its real name
    } else if (/^0x[0-9a-fA-F]{8,64}$/.test(raw)){
      seedAddr = raw.toLowerCase();                    // casing changes the art
    } else if (raw.includes(".")){
      say(`resolving ${raw}…`);
      let got;
      try { got = await resolveENS(raw); }
      catch (e){ say("could not reach the chain to resolve that name: " + e.message); return; }
      if (!got){ say(`${raw} does not resolve to an address`); return; }
      seedAddr = got.toLowerCase();
    } else {
      say("type a token number, an ENS name, a wallet, or a 0x hash");
      return;
    }
    p = AM125.derive(seedAddr);
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
    const ev = p.motif.melody.map(a => {
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
  $("seed").addEventListener("keydown", e => { if (e.key === "Enter") compose(); });

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
