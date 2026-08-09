/*  TEMPLATE — the 9:5 card.
 *
 *  Full-bleed Audio Map, a 30px border in the site's cream, the locked logo
 *  centred on top. Nothing else on the card: no traits, no wallet, no tempo.
 *
 *  CYCLE steps through a shortlist of compositions so a template can be judged
 *  against several pieces rather than the one that happened to look good.
 */

/*  Seeds are drawn at random, so the template is judged against whatever the
 *  collection actually produces rather than a shortlist chosen to flatter it.
 *  Every one is a real 20 byte seed, so anything that turns up here can be fed
 *  straight to the live site and will draw the same picture.
 *
 *  Seen seeds are kept so the back arrow can return to one worth saving. A
 *  random cycle with no history means losing a good piece the moment you
 *  press the button again. */
const randomSeed = () => "0x" + Array.from(crypto.getRandomValues(new Uint8Array(20)))
  .map(b => b.toString(16).padStart(2, "0")).join("");
const HISTORY = ["0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3"];

const W = 1800, H = 1000;          // 9:5
const BORDER = 30;                 // the site's cream, all the way round
const CREAM  = "#efece4";
const LOGO_W = 0.30;               // of card width

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
const CG = [0, 0, 0.3, 0.7, 1.2, 2.0, 3.0, 4.5, 3.75, 3.3];
const CO = [0, 1, 1, 2, 2, 2, 3, 3, 4, 4];

const $ = id => document.getElementById(id);
const say = m => { $("log").textContent = m; };

const PCN = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
/*  What the piece sounds in.
 *
 *  Key is NOT a property of the composition. The catalog motif is fixed, and
 *  the seed then transposes it and shifts its octave, so the same figure lands
 *  in a different key for every wallet. This reports what the piece actually
 *  sounds, transposition included, by scoring every major and minor scale
 *  against the notes it uses and keeping the best fit. */
function keyOf(pp){
  const sp = n => { let i = 1; if (n.charAt(1) === "#") i = 2; return [n.slice(0,i), parseInt(n.slice(i),10)]; };
  const md = n => { const q = sp(n); return PCN.indexOf(q[0]) + (q[1]+1)*12; };
  const ts = pp.transposeSemis + pp.octaveShift * 12;
  const hist = {};
  let lo = 999;
  for (const a of pp.motif.melody){
    const m = md(a[1]) + ts;
    const pc = ((m % 12) + 12) % 12;
    hist[pc] = (hist[pc] || 0) + 1;
    if (m < lo) lo = m;
  }
  const MAJ = [0,2,4,5,7,9,11], MIN = [0,2,3,5,7,8,10];
  let best = null;
  for (let root = 0; root < 12; root++) for (const [nm, sc] of [["maj", MAJ], ["min", MIN]]){
    let inside = 0, total = 0;
    for (const k in hist){ total += hist[k]; if (sc.includes((+k - root + 12) % 12)) inside += hist[k]; }
    const sco = inside / total;
    if (!best || sco > best.sco) best = { sco, key: PCN[root] + " " + nm };
  }
  return { key: best.key, low: PCN[((lo % 12) + 12) % 12] + (Math.floor(lo/12) - 1) };
}

/*  Note ripples. Same two-band behaviour as the token: low notes throw a wide,
 *  slow, heavy hit from the centre, everything else a tighter faster one. The
 *  pool is capped because overlapping ripples sum without limit. */
const rip = [];
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
  if (rip.length > 14) rip.shift();
}

(async () => {
try {
  say("unpacking…");
  run(await gz(bin(B.three)));
  run(await gz(bin(B.line2)));
  run(await gz(bin(B.tone)));
  run(await gz(bin(B.engine)));

  // the locked logo, loaded as the file rather than redrawn, so the card and
  // the brand folder can never drift apart
  const logo = new Image();
  const logoReady = new Promise(res => { logo.onload = res; logo.onerror = res; });
  logo.src = "brand/audiomaps-logo-light.svg";

  const card = $("card"); card.width = W; card.height = H;
  const cctx = card.getContext("2d");
  const art = document.createElement("canvas");
  const AW = W - BORDER*2, AH = H - BORDER*2;
  art.width = AW; art.height = AH;

  const SP = 0.345, BASE = 72;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(75, AW/AH, 0.1, 1000);
  const rn = new THREE.WebGLRenderer({ canvas: art, antialias: true });
  rn.setPixelRatio(1); rn.setSize(AW, AH, false);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(400,400),
    new THREE.MeshBasicMaterial({ color: 0 }));
  bg.position.z = -10; scene.add(bg);
  const mat = new THREE.LineMaterial({ color: 0xffffff, linewidth: 2.5,
    transparent: true, opacity: 0.9, worldUnits: false });
  mat.resolution.set(AW, AH);
  const grp = new THREE.Group(); scene.add(grp);
  const lines = [];
  let p = null, idx = 0, fc = 0, flip = 0;

  function build(){
    for (const l of lines){ l.mesh.geometry.dispose(); grp.remove(l.mesh); }
    lines.length = 0;
    const asp = AW/AH, vert = (p.orientation === "vertical");
    let NL, PT;
    if (vert){ NL = Math.round(BASE*Math.max(1,asp)); PT = Math.round(BASE/Math.min(1,asp)); }
    else     { NL = Math.round(BASE/Math.min(1,asp)); PT = Math.round(BASE*Math.max(1,asp)); }
    let hx = 0, hy = 0;
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
    mat.linewidth = 2.5 * (AH / 900);
    const th = Math.tan(75*Math.PI/360);
    cam.position.set(0, 0, Math.max(hy/th, hx/(th*asp)) * 1.20);
    cam.lookAt(0,0,0); cam.updateProjectionMatrix();
  }

  function load(i){
    if (i >= HISTORY.length) HISTORY.push(randomSeed());   // forward = a new roll
    idx = Math.max(0, Math.min(i, HISTORY.length - 1));
    p = AM125.derive(HISTORY[idx].toLowerCase());
    bg.material.color.setHex(p.scheme.bgColor);
    build();
    const k = keyOf(p);
    say(`${p.motif.name} · ${k.key} · ${p.tempo} bpm · chaos ${p.chaos}\n` +
        `${p.scheme.name} · low ${k.low} · oct ${p.octaveShift >= 0 ? "+" : ""}${p.octaveShift}` +
        ` · ${p.transposeSemis >= 0 ? "+" : ""}${p.transposeSemis} semis\n${HISTORY[idx]}`);
    // keep the selector honest when a random roll lands somewhere
    const s = $("tune");
    if (s && s.options.length > 1) s.value = p.motif.name;
  }

  function frame(t){
    fc++; if (fc >= 7){ fc = 0; flip = 1 - flip; }
    mat.color.setHex(flip === 0 ? p.scheme.color1 : p.scheme.color2);
    const CGV = CG[p.chaos], OCT = CO[p.chaos], WF = WAVES[p.waveIdx];
    for (const L of lines){
      const o = L.orig, b = L.buf;
      for (let j = 0; j < o.length; j++){
        const q = o[j];
        let z = WF(q.x, q.y, t) * 0.22;
        if (CGV > 0){
          let r = Math.sin(q.x*0.5+t*0.003)*Math.cos(q.y*0.3+t*0.004);
          if (OCT>=2) r += Math.sin(q.x*1.2+t*0.007)*Math.cos(q.y*0.8+t*0.005)*0.5;
          if (OCT>=3) r += Math.sin(q.x*2.1+t*0.012)*Math.cos(q.y*1.5+t*0.009)*0.25
                         + Math.sin((q.x+q.y)*0.2+t*0.002)*Math.cos((q.x-q.y)*0.15+t*0.003)*0.3;
          if (OCT>=4) r += Math.sin(q.x*3.5+t*0.018)*Math.cos(q.y*2.8+t*0.014)*0.125;
          z += r * CGV;
        }
        if (rip.length) z += ripAt(Math.sqrt(q.x*q.x + q.y*q.y), t);
        b[j*3] = q.x; b[j*3+1] = q.y; b[j*3+2] = z;
      }
      L.mesh.geometry.setPositions(b);
      L.mesh.computeLineDistances();
    }
    rn.render(scene, cam);

    // the card: cream all the way round, artwork inside it, logo centred
    cctx.fillStyle = CREAM; cctx.fillRect(0, 0, W, H);
    cctx.drawImage(art, BORDER, BORDER);
    if (logo.complete && logo.naturalWidth){
      const lw = Math.round(W * LOGO_W);
      const lh = Math.round(lw * logo.naturalHeight / logo.naturalWidth);
      cctx.drawImage(logo, Math.round((W-lw)/2), Math.round((H-lh)/2), lw, lh);
    }
  }

  await logoReady;
  load(0);
  let t0 = performance.now();
  setInterval(() => frame(performance.now() - t0), 16);

  // ── the piano ───────────────────────────────────────────────────────────
  const SH = String.fromCharCode(35);
  const PC = ["C","C"+SH,"D","D"+SH,"E","F","F"+SH,"G","G"+SH,"A","A"+SH,"B"];
  const split = n => { let i = 1; if (n.charAt(1) === SH) i = 2; return [n.slice(0,i), parseInt(n.slice(i),10)]; };
  function shift(n, s){
    const q = split(n), k = PC.indexOf(q[0]);
    if (k < 0) return n;
    let v = k + (1 + q[1]) * 12 + s;
    while (v < 36) v += 12;
    while (v > 96) v -= 12;
    return PC[mod(v,12)] + (Math.floor(v/12) - 1);
  }
  const urls = {};
  {
    const pb = bin(B.piano), dv = new DataView(pb.buffer), ml = dv.getUint32(0);
    const man = JSON.parse(new TextDecoder().decode(pb.slice(4, 4+ml)));
    const up = n => { const q = split(n); return q[0] + (q[1] + 1); };
    for (const m of man){
      if (m[0] === "C7") continue;                     // known broken sample
      urls[up(m[0])] = URL.createObjectURL(
        new Blob([pb.slice(4+ml+m[1], 4+ml+m[1]+m[2])], { type: "audio/ogg" }));
    }
  }

  let smp = null, part = null, playing = false;
  async function startPiece(){
    await Tone.start();
    if (!smp){
      say("decoding the piano…");
      smp = new Tone.Sampler({ urls, release: 2.1 }).toDestination();
      await Tone.loaded();
    }
    if (part){ part.dispose(); part = null; }
    Tone.Transport.stop(); Tone.Transport.cancel();
    Tone.Transport.bpm.value = p.tempo;
    const ts = p.transposeSemis + p.octaveShift * 12;
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
    playing = true; $("play").textContent = "PAUSE";
  }
  function stopPiece(){
    Tone.Transport.stop();
    playing = false; $("play").textContent = "PLAY";
  }

  /* Cycling while the music is running swaps the piece rather than stopping.
   * The template is being judged as picture AND sound together, so silence on
   * every cycle would hide half of what is being judged. */
  const cycle = i => { load(i); rip.length = 0; if (playing) startPiece(); };
  $("cycle").onclick = () => cycle(idx + 1);
  $("back").onclick  = () => cycle(idx - 1);
  $("play").onclick  = () => { playing ? stopPiece() : startPiece(); };
  /* Up and down step through the catalog in order, which is how you hunt for a
   * tune you have heard but cannot name. Left and right walk the history. */
  function step(d){
    const t = $("tune");
    t.selectedIndex = (t.selectedIndex + d + t.options.length) % t.options.length;
    t.onchange();
  }
  addEventListener("keydown", e => {
    if (e.target.tagName === "SELECT") return;
    if (e.key === "ArrowRight") cycle(idx + 1);
    if (e.key === "ArrowLeft")  cycle(idx - 1);
    if (e.key === "ArrowDown"){ e.preventDefault(); step(1); }
    if (e.key === "ArrowUp"){   e.preventDefault(); step(-1); }
    if (e.key === " "){ e.preventDefault(); playing ? stopPiece() : startPiece(); }
  });
  /*  Browse by tune name rather than by luck.
   *
   *  The engine goes seed -> composition, never the other way, so the only way
   *  to hear a NAMED piece is to find a seed that lands on it. Counter seeds
   *  are scanned until the motif matches, and the answer is cached, so a tune
   *  costs the search once and is instant afterwards. Every seed found this way
   *  is a real one: paste it into the site and it draws the same picture. */
  const seedCache = new Map();
  function seedFor(name){
    if (seedCache.has(name)) return seedCache.get(name);
    const hit = scanFrom(name, 1);
    if (hit) seedCache.set(name, hit.seed);
    return hit ? hit.seed : null;
  }

  /*  The same tune, a different version of it.
   *
   *  Key, octave, tempo, chaos and palette all come from the SEED, not from the
   *  composition. So HARPBLOOM at one seed and HARPBLOOM at another are the same
   *  figure in a different key at a different speed. Scanning onward from the
   *  last hit walks those versions. */
  function scanFrom(name, start){
    for (let i = start; i < 400000; i++){
      const s = "0x" + i.toString(16).padStart(40, "0");
      if (AM125.derive(s).motif.name === name) return { seed: s, at: i };
    }
    return null;
  }
  let variant = { name: null, at: 0 };


  const sel = $("tune");
  sel.innerHTML = AM125.CATALOG
    .map((c, i) => `<option value="${c.name}">${String(i).padStart(3," ")}  ${c.name}</option>`)
    .join("");
  sel.value = p.motif.name;
  window.__selBuilt = sel.options.length;
  const goTo = s => {
    HISTORY.push(s);
    load(HISTORY.length - 1);
    rip.length = 0;
    if (playing) startPiece();
  };
  sel.onchange = () => {
    const s = seedFor(sel.value);
    if (!s){ say(`no seed found for ${sel.value}`); return; }
    variant = { name: sel.value, at: parseInt(s.slice(2), 16) };
    goTo(s);
  };

  /* Next version of whatever is playing: same figure, different key, octave,
   * tempo, chaos and palette. Keeps walking forward from the last hit. */
  $("variant").onclick = () => {
    const name = p.motif.name;
    if (variant.name !== name) variant = { name, at: parseInt(HISTORY[idx].slice(2), 16) || 1 };
    const hit = scanFrom(name, variant.at + 1);
    if (!hit){ say(`no further versions of ${name}`); return; }
    variant.at = hit.at;
    goTo(hit.seed);
  };

  // ── record ──────────────────────────────────────────────────────────────
  const loopSec = () => p.motif.loopBars * 4 * 60 / p.tempo;
  async function record(){
    $("rec").disabled = true; $("cycle").disabled = true; $("back").disabled = true;
    if (!playing) await startPiece();

    const raw = Tone.context.rawContext || Tone.context;
    const msd = raw.createMediaStreamDestination();
    Tone.Destination.connect(msd);

    const vs = card.captureStream(30);
    const stream = new MediaStream([...vs.getVideoTracks(), ...msd.stream.getAudioTracks()]);
    const CAND = [
      ["video/mp4;codecs=avc1.640028,mp4a.40.2", "mp4"],
      ["video/mp4;codecs=avc1,mp4a.40.2",        "mp4"],
      ["video/mp4",                              "mp4"],
      ["video/webm;codecs=vp9,opus",             "webm"]
    ];
    const pick = CAND.find(c => MediaRecorder.isTypeSupported(c[0]));
    if (!pick){ say("this browser cannot record"); $("rec").disabled = false; return; }
    const [type, ext] = pick;
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16e6 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    /* Cut on the bar so the file loops seamlessly. Recording starts at the top
     * of the NEXT loop rather than wherever the transport happens to be, or the
     * clip begins mid phrase and the loop point is audible. */
    const L = loopSec();
    const pos = Tone.Transport.seconds % L;
    await new Promise(r => setTimeout(r, (L - pos) * 1000 + 20));

    const secs = L * parseInt($("loops").value, 10);
    rec.start(500);
    const t = Date.now();
    const tick = setInterval(() => {
      say(`recording… ${Math.max(0, secs - (Date.now()-t)/1000).toFixed(1)}s left`);
    }, 200);
    await new Promise(r => setTimeout(r, secs * 1000));
    clearInterval(tick);
    rec.stop();
    await new Promise(r => rec.onstop = r);
    Tone.Destination.disconnect(msd);

    const blob = new Blob(chunks, { type: type.split(";")[0] });
    const name = `audiomaps-template-${HISTORY[idx].slice(2,10)}.${ext}`;
    const url = URL.createObjectURL(blob);
    const v = $("out");
    if (v.src) URL.revokeObjectURL(v.src);
    v.src = url; v.hidden = false;
    $("saverow").hidden = false;
    $("dl").onclick = async () => say(await saveTo(blob, name));
    const file = new File([blob], name, { type: blob.type });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    $("share").hidden = !canShare;
    if (canShare) $("share").onclick = () =>
      navigator.share({ files: [file], title: "AUDIOMAPS" }).catch(() => {});

    say(`${(blob.size/1e6).toFixed(1)} MB, ${secs.toFixed(1)}s — ready below`);
    $("rec").disabled = false; $("cycle").disabled = false; $("back").disabled = false;
  }

  async function saveTo(blob, name){
    if (window.showSaveFilePicker){
      try {
        const h = await showSaveFilePicker({ suggestedName: name,
          types: [{ description: "MP4 video", accept: { "video/mp4": [".mp4"] } }] });
        const w = await h.createWritable();
        await w.write(blob); await w.close();
        return "written to disk";
      } catch (e){ if (e.name === "AbortError") return "save cancelled, still in the player"; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return "sent to downloads";
  }
  $("rec").onclick = record;

  $("png").onclick = () => {
    card.toBlob(b => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `audiomaps-template-${HISTORY[idx].slice(2,10)}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      say("png saved");
    }, "image/png");
  };
  window.__ready = { size: [W, H], border: BORDER, seen: () => HISTORY.length };
} catch (e){ say("error: " + e.message); console.error(e); }
})();
