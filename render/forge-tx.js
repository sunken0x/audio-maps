/*  THE TRANSACTION LAYER.
 *
 *  Everything else on this page is the preview - it composes, it plays, it
 *  records, and it burns nothing. This file is the part that burns. It is
 *  loaded by forge.html alone, touches none of boot.js's internals, and reads
 *  the same two input boxes the preview reads.
 *
 *  Selectors were generated with `cast sig`, never typed from memory. */
(function(){
  "use strict";
  var AM    = "0x31E107aFb3e76Ca66f91be62B8b65a1A30ed55d8";
  var FORGE = "0x45Ac3a8da7cd547185Cba257DC2c0622a78F29dE";
  var RPC   = "https://ethereum-rpc.publicnode.com";
  var SEL = {
    ownerOf:          "0x6352211e",
    isApprovedForAll: "0xe985e9c5",
    setApprovalForAll:"0xa22cb465",
    forge:            "0xef0b8784",
    open:             "0xfcfff16f",
    totalMinted:      "0xa2309ff8",
    maxSupply:        "0xd5abeb01"
  };
  var FORGED_TOPIC = "0xb0817a0583084fa2741dc20361dc99f3d4c17fb17fd97eccc007856cc28ede8a";

  var $ = function(id){ return document.getElementById(id); };
  var pad = function(v){ return BigInt(v).toString(16).padStart(64, "0"); };
  var padAddr = function(a){ return a.toLowerCase().replace("0x","").padStart(64, "0"); };

  var rpcId = 1;
  function rpcBatch(calls){
    var body = calls.map(function(c){
      return {jsonrpc:"2.0", id:rpcId++, method:"eth_call", params:[{to:c.to, data:c.data},"latest"]};
    });
    return fetch(RPC, {method:"POST", headers:{"content-type":"application/json"},
                       body:JSON.stringify(body)})
      .then(function(r){ return r.json(); })
      .then(function(j){
        var byId = {}; (Array.isArray(j)?j:[j]).forEach(function(x){ byId[x.id]=x; });
        return body.map(function(b){ return (byId[b.id]&&byId[b.id].result)?byId[b.id].result:null; });
      });
  }

  /*  The same piece list the preview uses. A number or a NAME becomes an id;
   *  anything else (a wallet, a hash, ENS) is not a piece and cannot burn. */
  var TK = null;
  function tokens(){
    if (TK) return Promise.resolve(TK);
    return fetch("tokens.json").then(function(r){ return r.json(); })
      .then(function(j){ TK = j; return TK; });
  }
  function toId(raw, list){
    raw = (raw||"").trim();
    var n = raw.replace(/^#/, "");
    if (/^\d{1,4}$/.test(n)){
      var hit = list.find(function(t){ return t.i === +n; });
      return hit || null;
    }
    var up = raw.toUpperCase();
    return list.find(function(t){ return (t.n||"").toUpperCase() === up; }) || null;
  }

  /* ── the injected panel ─────────────────────────────────────────────── */
  var host = document.createElement("div");
  host.className = "result";
  host.style.marginTop = "12px";
  host.innerHTML =
    '<div class=role>The real thing</div>' +
    '<div class=t id=txstate>Connect the wallet that holds your two pieces.</div>' +
    '<label id=txconfirmrow style="display:none;margin-top:9px;text-transform:none;' +
      'letter-spacing:0;font-size:11px;color:var(--dim);cursor:pointer">' +
      '<input type=checkbox id=txconfirm style="width:auto;margin-right:7px">' +
      '<span id=txconfirmtext></span></label>' +
    '<button class=go id=txapprove style="display:none;margin-top:9px">APPROVE THE FORGE</button>' +
    '<button class=go id=txforge disabled style="margin-top:9px">FORGE — BURN TWO, MINT ONE</button>' +
    '<div class=t id=txlog style="margin-top:7px"></div>' +
    '<div id=txresult></div>';
  var hint = $("walletHint");
  hint.parentNode.insertBefore(host, hint.nextSibling);

  var acct = null, approved = false, ready = null;

  function state(msg){ $("txstate").textContent = msg; }

  function reset(){
    $("txconfirmrow").style.display = "none";
    $("txconfirm").checked = false;
    $("txapprove").style.display = "none";
    $("txforge").disabled = true;
    ready = null;
  }

  function refresh(){
    reset();
    tokens().then(function(list){
      var A = toId($("seedA").value, list), B = toId($("seedB").value, list);
      if (!A || !B){ state("Only real pieces can be forged — both boxes need a piece name or number."); return; }
      if (A.i === B.i){ state("Two different pieces."); return; }
      if (A.r || B.r){ state("A moment cannot go into the forge. It would be destroyed and can never be minted again."); return; }
      if (!window.ethereum){ state("No wallet in this browser. The preview above still works."); return; }
      window.ethereum.request({method:"eth_accounts"}).then(function(accs){
        acct = accs && accs[0];
        if (!acct){ state("Connect the wallet that holds " + A.n + " and " + B.n + " to forge for real."); return; }
        state("checking the chain…");
        rpcBatch([
          {to:AM, data:SEL.ownerOf + pad(A.i)},
          {to:AM, data:SEL.ownerOf + pad(B.i)},
          {to:AM, data:SEL.isApprovedForAll + padAddr(acct) + padAddr(FORGE)},
          {to:FORGE, data:SEL.open},
          {to:AM, data:SEL.totalMinted},
          {to:AM, data:SEL.maxSupply}
        ]).then(function(r){
          var ownA = r[0] && ("0x"+r[0].slice(-40)).toLowerCase() === acct.toLowerCase();
          var ownB = r[1] && ("0x"+r[1].slice(-40)).toLowerCase() === acct.toLowerCase();
          approved = r[2] ? BigInt(r[2]) === 1n : false;
          var open = r[3] ? BigInt(r[3]) === 1n : false;
          var minted = r[4] ? Number(BigInt(r[4])) : 0;
          var cap = r[5] ? Number(BigInt(r[5])) : 0;
          if (!open){ state("The forge is closed. Nothing can be forged, ever again."); return; }
          if (minted >= cap){ state("The forge is at its ceiling. Nothing more can be minted."); return; }
          if (!ownA && !ownB){ state("This wallet holds neither " + A.n + " nor " + B.n + "."); return; }
          if (!ownA){ state("This wallet does not hold " + A.n + " (#" + A.i + ")."); return; }
          if (!ownB){ state("This wallet does not hold " + B.n + " (#" + B.i + ")."); return; }
          ready = {A:A, B:B, next: minted + 1};
          state("Both pieces are yours. This is real and it cannot be undone.");
          $("txconfirmtext").textContent =
            "Burn " + A.n + " (#" + A.i + ") and " + B.n + " (#" + B.i + ") forever. " +
            "One HORIZON is minted to my wallet in the same transaction. Nothing can bring them back.";
          $("txconfirmrow").style.display = "block";
          if (!approved) $("txapprove").style.display = "inline-block";
        });
      });
    }).catch(function(e){ state(String(e.message || e)); });
  }

  $("txconfirm") && document.addEventListener("change", function(ev){
    if (ev.target && ev.target.id === "txconfirm")
      $("txforge").disabled = !(ev.target.checked && approved && ready);
  });

  function sendTx(to, data, label){
    $("txlog").textContent = label + " — confirm in your wallet…";
    return window.ethereum.request({method:"eth_sendTransaction",
                                    params:[{from:acct, to:to, data:data}]})
      .then(function(hash){
        $("txlog").textContent = label + " sent — waiting for the chain…";
        return new Promise(function(res, rej){
          var tries = 0;
          (function poll(){
            if (++tries > 150) return rej(new Error("timed out waiting for the transaction"));
            setTimeout(function(){
              fetch(RPC, {method:"POST", headers:{"content-type":"application/json"},
                body:JSON.stringify({jsonrpc:"2.0", id:rpcId++,
                  method:"eth_getTransactionReceipt", params:[hash]})})
                .then(function(r){ return r.json(); })
                .then(function(j){
                  if (!j.result) return poll();
                  if (j.result.status !== "0x1") return rej(new Error(label + " failed on chain"));
                  res(j.result);
                }).catch(function(){ poll(); });
            }, 4000);
          })();
        });
      });
  }

  $("txapprove").onclick = function(){
    $("txapprove").disabled = true;
    sendTx(AM, SEL.setApprovalForAll + padAddr(FORGE) + pad(1), "approval")
      .then(function(){
        approved = true;
        $("txapprove").style.display = "none";
        $("txlog").textContent = "approved — the forge can burn only pieces you choose, in transactions you sign";
        $("txforge").disabled = !$("txconfirm").checked;
      })
      .catch(function(e){ $("txlog").textContent = String(e.message || e); $("txapprove").disabled = false; });
  };

  $("txforge").onclick = function(){
    if (!ready || !$("txconfirm").checked) return;
    var A = ready.A, B = ready.B;
    $("txforge").disabled = true;
    sendTx(FORGE, SEL.forge + pad(A.i) + pad(B.i), "forge")
      .then(function(rec){
        var log = (rec.logs||[]).find(function(l){
          return l.address.toLowerCase() === FORGE.toLowerCase() && l.topics[0] === FORGED_TOPIC;
        });
        var id = log ? Number(BigInt(log.topics[1])) : ready.next;
        $("txresult").innerHTML =
          '<div class=t style="margin-top:9px"><b>FORGED.</b> ' + A.n + " and " + B.n +
          " are gone. HORIZON #" + id + " is yours — its name is dealt from the " +
          'parents’ seeds. <a target=_blank rel=noopener href="https://opensea.io/assets/ethereum/' +
          AM + "/" + id + '">see it on OpenSea ↗</a></div>';
        $("txlog").textContent = "";
        refresh();
      })
      .catch(function(e){ $("txlog").textContent = String(e.message || e); $("txforge").disabled = false; });
  };

  /*  Follow the preview, never lead it: re-check whenever the pair or the
   *  wallet changes. */
  ["seedA","seedB"].forEach(function(id){ $(id).addEventListener("change", refresh); });
  $("go").addEventListener("click", function(){ setTimeout(refresh, 300); });
  $("swapAB").addEventListener("click", function(){ setTimeout(refresh, 300); });
  $("connect").addEventListener("click", function(){ setTimeout(refresh, 1200); });
  $("owned").addEventListener("click", function(){ setTimeout(refresh, 300); });
  refresh();
})();
