/* TACITLENS — all data fetched live client-side from public mainnet sources.
   No backend, no API keys, no wallet. Every panel labels its source in index.html. */
"use strict";
const $ = (s, r) => (r || document).querySelector(s);
const API = "https://api.tacit.finance";
const MEMPOOL = "https://mempool.space/api";
const RPC_ETH = "https://ethereum-rpc.publicnode.com";
const RPC_BASE = "https://base-rpc.publicnode.com";
const RPC_RH = "https://rpc.mainnet.chain.robinhood.com";
const KEEPER = { 1: "https://tacit-evm-pool-keepers.onrender.com/1/evm-pool/keeper", 8453: "https://tacit-evm-pool-keepers.onrender.com/8453/evm-pool/keeper", 4663: "https://tacit-evm-pool-keepers.onrender.com/4663/evm-pool/keeper" };
const POOL = "0x000000000Ed1eabD231Be41d93b719056F7febFC";
const ENGINE = "0x000000003f608BDdF0ca45934003ffb9DbDF70DB";
const XNS = "0x6e797ba2d3103aF167918e71a7E01DE40D45f74b";
const TOKENS = [
  { sym: "TAC", name: "Tacit Token (bridged)", addr: "0xA1313eb9f3A445606D9583bcAc3ebeB56a858279" },
  { sym: "tacBTC", name: "cBTC in public ERC-20 form", addr: "0xdf1d99148bEb7a9AFf1d95C49B3d22b7ed90D696" },
  { sym: "tacUSD", name: "cUSD in public ERC-20 form", addr: "0x23cACFFAc2674514A6d4F6cD420B4cc2aC921564" },
  { sym: "wTAC", name: "Wrapped TAC (farm rewards)", addr: "0x2018139a8FDd3666855BE3315C7683b4D6aB7AEf" },
];
const ASSET_NAMES = { "3cba71e1114af183cdeacc6b8457a474d17529fd28704480ca799d0d03126f34": "tETH / cETH", "f0bbe868af10c6c67652a99709bf32048d1aa7194efe3e9a1ef1bde43f94762b": "TAC", "62a20d98fc1cd20289621d1315294cb8772f934d822e404b71e1f471cf0679c8": "cBTC", "8f4490dd3728b0ee904d7a67c11b37ffd463a5c7f08b79810006995ee8a9679d": "cUSD" };

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => Number(n).toLocaleString("en-US");
const short = (s, a, b) => s && s.length > (a + b + 1) ? s.slice(0, a) + "…" + s.slice(-b) : s;
const ago = ts => { const d = Date.now() / 1000 - ts; const u = (n, w) => n + " " + w + (n === 1 ? "" : "s") + " ago"; if (d < 90) return "just now"; if (d < 3600) return u(Math.round(d / 60), "minute"); if (d < 86400) return u(Math.round(d / 3600), "hour"); return u(Math.round(d / 86400), "day"); };
function stamp(panel) { const el = $(panel + " [data-ts]"); if (el) el.textContent = "· updated " + new Date().toLocaleTimeString(); }
function fail(panel, msg) { const el = $(panel); if (el) { const p = document.createElement("p"); p.className = "err"; p.textContent = "⚠ " + msg; el.appendChild(p); } }
async function jget(url, ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 20000); try { const r = await fetch(url, { signal: c.signal, cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); } }
/* The indexer endpoints (/assets, /amm) set Access-Control-Allow-Origin to the tacit.finance
   origin only, so from any other origin they are read through public CORS relays.
   Direct is tried first in case Tacit widens the allowlist; then a chain of independent
   relays (each is a free public service and can be flaky, so several are tried in order). */
async function jgetIndexer(path) {
  /* Cache-bust every fetch: the public relays cache by URL, so a unique target URL is what
     makes relayed data actually realtime instead of minutes-old relay cache. */
  const target = API + path + (path.includes("?") ? "&" : "?") + "_t=" + Date.now();
  const enc = encodeURIComponent(target);
  /* Direct first (instant CORS failure if Tacit still restricts it), then all public relays
     raced in parallel — first good JSON wins. Sequential chaining wasted minutes whenever
     one relay hung; the race caps the worst case at one timeout round. One retry round. */
  const attempts = [
    () => jget(target, 6000),
    () => jget("https://api.allorigins.win/raw?url=" + enc, 12000),
    () => jget("https://api.allorigins.win/get?url=" + enc, 12000).then(w => JSON.parse(w.contents)),
    () => jget("https://api.codetabs.com/v1/proxy?quest=" + target, 12000),
    () => jgetText("https://r.jina.ai/" + target, 12000).then(txt => { const i = txt.indexOf("{"); if (i < 0) throw new Error("bad relay payload"); return JSON.parse(txt.slice(i)); }),
  ];
  const race = () => new Promise((resolve, reject) => {
    let left = attempts.length, done = false;
    attempts.forEach(fn => { fn().then(v => { if (!done) { done = true; resolve(v); } }, () => { if (--left === 0 && !done) reject(new Error("indexer unreachable via every relay")); }); });
  });
  const liveP = (async () => { try { return await race(); } catch (e) { await new Promise(r => setTimeout(r, 1200)); return await race(); } })();
  const snap = SNAPSHOT_FILES[path];
  if (!snap) return await liveP;
  /* Speed fuse: if no live relay has answered within 8 seconds, serve the labelled
     same-origin snapshot (refreshed every hour) instead of leaving panels blank.
     If the live fetch lands afterwards, the page upgrades itself to live data once. */
  const slowSnap = (async () => { await new Promise(r => setTimeout(r, 8000)); return { __snap: true, d: await jget(snap, 10000) }; })();
  try {
    const out = await Promise.any([liveP, slowSnap]);
    if (out && out.__snap) {
      markSnapshot();
      if (!G.upgradeArmed) { G.upgradeArmed = true; liveP.then(() => { const el = $("#snap-note"); if (el) el.style.display = "none"; G.snapShown = false; loadAll(); }).catch(() => {}); }
      return out.d;
    }
    return out;
  } catch (e) { const d = await jget(snap, 10000); markSnapshot(); return d; }
}
const SNAPSHOT_FILES = { "/assets?network=mainnet": "data/assets.json", "/amm/pools?network=mainnet": "data/amm-pools.json", "/market?network=mainnet": "data/market.json" };
async function jgetText(url, ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms || 20000); try { const r = await fetch(url, { signal: c.signal, cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); } finally { clearTimeout(t); } }
function markSnapshot() {
  if (G.snapShown) return; G.snapShown = true;
  const show = ts => { const el = $("#snap-note"); if (!el) return; el.style.display = "block"; el.textContent = "⚠ The live CORS relays are unreachable from your browser right now, so the indexer-fed panels (envelopes, assets, AMM, market, freshness check) are showing an auto-refreshed snapshot of the same Tacit indexer JSON" + (ts ? " — fetched " + ts : "") + ", refreshed every hour. Every other panel on this page is live. The snapshot is labelled, never passed off as live."; };
  jget("data/meta.json", 8000).then(m => show(m && m.fetched_at)).catch(() => show(null));
}
/* Shared values for the measured-privacy row + one shared /market fetch (cross-checks + market panel). */
const G = {};
let marketDataP = null;
function marketData() { if (!marketDataP) { marketDataP = jgetIndexer("/market?network=mainnet"); marketDataP.catch(() => { marketDataP = null; }); } return marketDataP; }
function renderPriv() {
  /* Render whatever has arrived — the row must never sit blank waiting on the slowest source. */
  const s = [];
  if (G.liveNotes != null) s.push(stat(fmt(G.liveNotes), "live notes in the pool right now — the anonymity set every spend hides inside"));
  if (G.transfers != null) s.push(stat(fmt(G.transfers), "confidential transfers counted by the indexer — every one's amount hidden"));
  if (G.burns != null) s.push(stat(fmt(G.burns), "bridge burns on Bitcoin — the public leg: amounts visible, notes on the other side not"));
  if (G.assets != null) s.push(stat(fmt(G.assets), "assets etched on Bitcoin · " + fmt(G.holders || 0) + " holders whose balances the indexer can total"));
  if (s.length) $("#priv-stats").innerHTML = s.join("");
}
async function rpc(url, method, params) { const c = new AbortController(); const t = setTimeout(() => c.abort(), 20000); try { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: c.signal, cache: "no-store" }); const j = await r.json(); if (j.error) throw new Error(j.error.message || "RPC error"); return j.result; } finally { clearTimeout(t); } }
const ethCall = (to, data, url) => rpc(url || RPC_ETH, "eth_call", [{ to, data }, "latest"]);
const u256 = hex => BigInt(hex);
function fmtUnits(raw, dec, maxFrac) { const v = Number(raw) / Math.pow(10, dec); return v.toLocaleString("en-US", { maximumFractionDigits: maxFrac == null ? 4 : maxFrac }); }
function decodeString(hex) { if (!hex || hex === "0x") return ""; const b = hex.slice(2); const len = Number(u256("0x" + b.slice(64, 128))); let out = ""; for (let i = 0; i < len; i++) out += String.fromCharCode(parseInt(b.slice(128 + i * 2, 130 + i * 2), 16)); return out; }
function encString(s) { const bytes = new TextEncoder().encode(s); const pad = Math.ceil(bytes.length / 32) * 32 || 32; let data = ""; bytes.forEach(x => data += x.toString(16).padStart(2, "0")); return (32).toString(16).padStart(64, "0") + bytes.length.toString(16).padStart(64, "0") + data.padEnd(pad * 2, "0"); }
const SEL = { totalSupply: "0x18160ddd", decimals: "0x313ce567", symbol: "0x95d89b41", balanceOf: a => "0x70a08231" + a.toLowerCase().replace("0x", "").padStart(64, "0"), cbtcBackingSats: "0x9f5b61d9", outstandingCusd: "0xa42542c0", getName: a => "0x5fd4b08a" + a.toLowerCase().replace("0x", "").padStart(64, "0"), getAddress: n => "0xbf40fac1" + encString(n) };
async function xnsName(addr) { try { const r = await ethCall(XNS, SEL.getName(addr)); const n = decodeString(r); return n || null; } catch (e) { return undefined; } } /* undefined = check failed, null = genuinely no name */
async function xnsResolve(name) { const r = await ethCall(XNS, SEL.getAddress(name.toLowerCase())); const a = "0x" + r.slice(-40); return a === "0x0000000000000000000000000000000000000000" ? null : a; }
function stat(b, s) { return `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`; }
function dot(id, ok) { const el = $(id); if (el) el.className = "dot " + (ok ? "ok" : "bad"); }

/* ---------- Bridge + relay ---------- */
async function loadBridge() {
  try {
    const [st, relay] = await Promise.all([jget(API + "/reflection/status?network=mainnet"), jget(API + "/confidential/relay").catch(() => null)]);
    $("#bridge-stats").innerHTML =
      stat(fmt(st.attestedHeight), "Bitcoin height folded into the pool (attested)") +
      stat(fmt(st.tipHeight), "Bitcoin header-relay tip height") +
      stat(fmt(st.lagBlocks) + " blocks", "reflection lag · folds at " + st.confirmations + " confirmations") +
      stat(fmt(st.bridgeBurns), "bridge burns seen on Bitcoin") +
      stat(fmt(st.bridgeMinted), "bridge mints completed in the pool") +
      stat(fmt(st.burnsAwaitingBundle), "burns awaiting bundle" + (st.oldestAwaitingHeight ? " · oldest at block " + fmt(st.oldestAwaitingHeight) : "")) +
      stat(fmt(st.liveNotes), "live confidential notes in the pool") +
      stat(fmt(st.foldedCrossoutCount), "cross-outs (EVM → Bitcoin) folded");
    $("#bridge-extra").innerHTML = `Relay state: <b class="${relay && relay.state === "ok" ? "ok-txt" : "warn-txt"}">${relay ? esc(relay.state) : "unreachable"}</b>${relay ? ` · proving ${relay.proving ? "on" : "off"} · settling ${relay.settling ? "on" : "off"} · ${fmt(st.burnDeposits)} burn deposits tracked · API updated ${esc(st.updatedAt || "")}` : ""}. Burns minus mints is the in-flight bridge traffic — value proven to have left one chain and not yet minted on the other.`;
    G.liveNotes = st.liveNotes; G.burns = st.bridgeBurns; renderPriv();
    dot("#dot-api", true); stamp("#p-bridge");
  } catch (e) { dot("#dot-api", false); fail("#p-bridge", "Reflection status unreachable from your browser right now (" + e.message + "). No number is shown rather than a stale one."); }
}

/* ---------- Bitcoin: chain tip, envelopes, assets, AMM ---------- */
let assetsCache = null;
async function loadBitcoin() {
  try {
    const tip = await jget(MEMPOOL + "/blocks/tip/height");
    const fees = await jget(MEMPOOL + "/v1/fees/recommended").catch(() => null);
    $("#btc-stats").innerHTML = stat(fmt(tip), "Bitcoin tip height (mempool.space)") + (fees ? stat(fees.halfHourFee + " sat/vB", "fees: half-hour target") : "");
    dot("#dot-btc", true);
  } catch (e) { dot("#dot-btc", false); fail("#p-env", "mempool.space unreachable (" + e.message + ")."); }
  try {
    const data = await jgetIndexer("/assets?network=mainnet");
    assetsCache = data.assets || [];
    // Envelope feed: etches (CETCH/T_PETCH) + burns (T_BURN) are envelope events in the indexer.
    const events = [];
    for (const a of assetsCache) {
      if (a.etched_at_height) events.push({ kind: "ETCH", ticker: a.ticker, txid: a.etch_txid, height: a.etched_at_height, ts: a.etched_at, id: a.asset_id });
      for (const m of (a.mints || [])) events.push({ kind: "MINT", ticker: a.ticker, txid: m.mint_txid, height: m.minted_at_height, ts: m.minted_at, attested: m.attestation && m.attestation.supply, dec: a.decimals, id: a.asset_id });
      for (const b of (a.burns || [])) events.push({ kind: "BURN", ticker: a.ticker, txid: b.burn_txid, height: b.burned_at_height, ts: b.burned_at, amount: b.burned_amount, dec: a.decimals, id: a.asset_id });
    }
    events.sort((x, y) => (y.height || 0) - (x.height || 0));
    $("#env-feed").innerHTML = events.slice(0, 12).map(e =>
      `<div><span class="pill">${esc(e.kind)}</span><b>${esc(e.ticker || "?")}</b>${e.amount != null ? " · burned " + esc(fmtUnits(BigInt(e.amount), e.dec == null ? 8 : e.dec)) : e.attested ? " · attested supply " + esc(fmtUnits(BigInt(e.attested), e.dec == null ? 8 : e.dec)) : " · supply hidden in a Pedersen commitment"} · block ${fmt(e.height)}${e.ts ? " · " + ago(e.ts) : ""}<br><a class="mono" href="https://tacitscan.io/tx/${esc(e.txid)}" target="_blank" rel="noopener">${esc(short(e.txid, 18, 10))}</a> <span class="note">on tacitscan</span></div>`).join("") ||
      '<p class="note">Indexer returned no envelope events.</p>';
    const tac = assetsCache.find(a => a.asset_id === "f0bbe868af10c6c67652a99709bf32048d1aa7194efe3e9a1ef1bde43f94762b");
    if (tac) $("#btc-stats").innerHTML += stat(fmt(tac.holder_count), "TAC holders on Bitcoin") + stat(fmt(tac.transfer_count), "confidential TAC transfers (amounts hidden)") + stat(fmt(assetsCache.length), "assets etched on Bitcoin mainnet");
    G.transfers = assetsCache.reduce((s, a) => s + (a.transfer_count || 0), 0);
    G.holders = assetsCache.reduce((s, a) => s + (a.holder_count || 0), 0);
    G.assets = assetsCache.length; renderPriv();
    // Assets table: by transfers desc
    const top = [...assetsCache].sort((a, b) => (b.transfer_count || 0) - (a.transfer_count || 0)).slice(0, 10);
    $("#assets-body").innerHTML = top.map(a => `<tr><td><a href="https://tacitscan.io/assets/${esc(a.asset_id)}" target="_blank" rel="noopener"><b>${esc(a.ticker || "?")}</b></a>${a.asset_id === "f0bbe868af10c6c67652a99709bf32048d1aa7194efe3e9a1ef1bde43f94762b" ? ' <span class="pill">canonical TAC</span>' : ""}</td><td>${fmt(a.holder_count || 0)}</td><td>${fmt(a.transfer_count || 0)}</td><td>${a.etched_at_height ? fmt(a.etched_at_height) : "—"}</td></tr>`).join("");
    stamp("#p-env"); stamp("#p-assets");
  } catch (e) { fail("#p-env", "Tacit indexer /assets unreachable (" + e.message + "). Envelope feed cannot be shown."); }
  try {
    const amm = await jgetIndexer("/amm/pools?network=mainnet");
    const p = (amm.pools || [])[0];
    if (!p) throw new Error("no pool returned");
    const nameA = ASSET_NAMES[p.asset_a] || short(p.asset_a, 8, 6), nameB = ASSET_NAMES[p.asset_b] || short(p.asset_b, 8, 6);
    $("#amm-box").innerHTML = `<p><b>Bitcoin-native AMM — ${esc(nameA)} / ${esc(nameB)}</b> <span class="pill">${esc(p.validation || "")}</span> <span class="pill">fee ${(p.fee_bps / 100)}%</span></p>
      <div class="grid">${stat(fmtUnits(BigInt(p.reserve_a), 8), "reserve " + nameA)}${stat(fmtUnits(BigInt(p.reserve_b), 8), "reserve " + nameB)}${stat(fmt(p.lp_total_shares), "LP shares (" + fmt(p.locked_shares) + " locked)")}${stat(p.last_swap_height ? fmt(p.last_swap_height) : "—", "last swap block" + (p.last_swap_at ? " · " + ago(p.last_swap_at) : ""))}</div>
      <p class="note">Pool <span class="mono">${esc(short(p.pool_id, 16, 10))}</span> · founded in reveal tx <a class="mono" href="https://mempool.space/tx/${esc(p.init_txid)}" target="_blank" rel="noopener">${esc(short(p.init_txid, 16, 10))}</a> at block ${fmt(p.init_height || 0)}. Reserves are Bitcoin-side notes — no Ethereum contract exists for this pool.</p>`;
  } catch (e) { fail("#p-assets", "AMM pool endpoint unreachable (" + e.message + ")."); }
}

/* ---------- ConfidentialPool + tokens ---------- */
async function loadPool() {
  try {
    const [backing, cusd] = await Promise.all([ethCall(POOL, SEL.cbtcBackingSats), ethCall(ENGINE, SEL.outstandingCusd)]);
    const sats = u256(backing);
    let stats = stat(fmt(sats.toString()) + " sats", "cBTC backing — reflection-attested BTC locks (" + (Number(sats) / 1e8).toFixed(8) + " BTC)") +
      stat(fmtUnits(u256(cusd), 10) + " cUSD", "CDP debt outstanding on CollateralEngine (raw " + fmt(u256(cusd).toString()) + " in-system units)");
    $("#pool-stats").innerHTML = stats;
    dot("#dot-eth", true); stamp("#p-pool");
  } catch (e) { dot("#dot-eth", false); fail("#p-pool", "Ethereum RPC read failed (" + e.message + ")."); }
  try {
    const open = await jget(API + "/confidential/open?limit=10");
    const jobs = open.jobs || [];
    $("#pool-extra").innerHTML = `Open relay board: <b>${jobs.length}</b> proven job(s) waiting for any sender${jobs.length ? " — types: " + esc([...new Set(jobs.map(x => x.type))].join(", ")) : ""}. Anyone can settle an open job and earn its bound fee; the board is public, the note contents in a job are not.`;
  } catch (e) { /* relay panel already reports API health */ }
  try {
    const rows = [];
    for (const t of TOKENS) {
      const [sup, dec, sym] = await Promise.all([ethCall(t.addr, SEL.totalSupply), ethCall(t.addr, SEL.decimals), ethCall(t.addr, SEL.symbol)]);
      rows.push(`<tr><td><b>${esc(decodeString(sym) || t.sym)}</b> <span class="note">${esc(t.name)}</span></td><td class="mono">${esc(fmtUnits(u256(sup), Number(u256(dec))))}</td><td><a class="mono" href="https://etherscan.io/address/${t.addr}" target="_blank" rel="noopener">${esc(short(t.addr, 10, 8))}</a></td></tr>`);
    }
    $("#tokens-body").innerHTML = rows.join("");
  } catch (e) { fail("#p-pool", "Token supply reads failed (" + e.message + ")."); }
}

/* ---------- EVM pool (ETH + Base) + farms ---------- */
async function keeperPanel(chainId, label, explorer, rpcUrl, win) {
  const head = await jget(KEEPER[chainId] + "/head");
  const blockHex = await rpc(rpcUrl, "eth_blockNumber", []);
  const from = Math.max(0, parseInt(blockHex, 16) - (win || 3000));
  let events = [];
  try { const ev = await jget(KEEPER[chainId] + "/events?from=" + from, 30000); events = (ev.events || []).slice(-5).reverse(); } catch (e) { /* head alone still renders */ }
  return { head, events, label, explorer, chainId };
}
async function loadEvm() {
  try {
    const panels = await Promise.all([keeperPanel(1, "Ethereum", "https://etherscan.io/tx/", RPC_ETH, 3000), keeperPanel(8453, "Base", "https://basescan.org/tx/", RPC_BASE, 3000), keeperPanel(4663, "Robinhood", "https://robinhoodchain.blockscout.com/tx/", RPC_RH, 8000000)]);
    $("#evm-stats").innerHTML = panels.map(p => stat(fmt(p.head.size), p.label + " EVM-pool notes (tree size)") ).join("");
    $("#evm-feed").innerHTML = panels.map(p => `<p style="margin:8px 0 2px"><b>${esc(p.label)}</b> <span class="note">root ${esc(short(String(p.head.root), 14, 8))}</span></p>` +
      (p.events.length ? p.events.map(e => `<div><span class="pill">${esc(e.kind)}</span>block ${fmt(e.block)} · <a class="mono" href="${p.explorer}${esc(e.tx)}" target="_blank" rel="noopener">${esc(short(e.tx, 16, 10))}</a> <span class="note">nullifiers + output leaves are public; the amount is not in the event.</span></div>`).join("") : '<p class="note">No events in the recent block window on this chain.</p>')).join("");
    dot("#dot-base", true); dot("#dot-rh", true); stamp("#p-evm");
  } catch (e) { dot("#dot-base", false); dot("#dot-rh", false); fail("#p-evm", "EVM-pool keeper unreachable (" + e.message + ")."); }
  try {
    const [prog, health] = await Promise.all([jget(API + "/farm/program?network=mainnet"), jget(API + "/farm/health").catch(() => null)]);
    const ep = prog.epoch || {};
    const pools = (prog.pools || []).map(p => { const r = p.reserves || {}; const nA = ASSET_NAMES[r.assetA] || "?", nB = ASSET_NAMES[r.assetB] || "?"; return `<div><span class="pill">pool ${p.pid} · ${esc(p.sharePct)}%</span><b>${esc(p.pair)}</b> · reserves ${esc(fmtUnits(BigInt(r.reserveA || "0"), 10))} ${esc(nA)} / ${esc(fmtUnits(BigInt(r.reserveB || "0"), 10))} ${esc(nB)} · ${esc(p.tacPerDayForPool)} TAC/day</div>`; }).join("");
    $("#farm-box").innerHTML = `<p>Launch farms pay <b>wTAC</b> at <b>${esc(ep.ratePerDayTac || "?")} TAC/day</b> · treasury ${esc(ep.treasuryTac || "?")} TAC · solvency: <b class="${health && health.status === "ok" ? "ok-txt" : "warn-txt"}">${health ? esc(health.status) : "unknown"}</b>${health ? " — " + esc((health.checks || []).map(c => c.name + ": " + c.detail).join(" · ")) : ""}</p><div class="feed">${pools}</div>`;
  } catch (e) { fail("#p-evm", "Farm program unreachable (" + e.message + ")."); }
}

/* ---------- Cross-checks: headline numbers read twice ---------- */
async function loadChecks() {
  const row = (name, a, b, ok, note) => `<tr><td><b>${esc(name)}</b><br><span class="note">${esc(note)}</span></td><td class="mono">${esc(a)}</td><td class="mono">${esc(b)}</td><td>${ok == null ? '<span class="warn-txt">unreachable</span>' : ok ? '<b class="ok-txt">✓ agree</b>' : '<b class="warn-txt">Δ differs</b>'}</td></tr>`;
  const rows = [];
  const render = () => { $("#checks-body").innerHTML = rows.join(""); };
  /* Each check is independent: one slow or blocked source can no longer blank the whole panel —
     it only marks its own row unreachable. */
  let tipM = null;
  const tipJob = (async () => {
    const [m, b] = await Promise.allSettled([jget(MEMPOOL + "/blocks/tip/height"), jget("https://blockstream.info/api/blocks/tip/height")]);
    if (m.status === "fulfilled") tipM = m.value;
    if (m.status === "fulfilled" && b.status === "fulfilled") rows.push(row("Bitcoin tip height", "mempool.space: block " + fmt(m.value), "blockstream.info: block " + fmt(b.value), Math.abs(m.value - b.value) <= 1, "Two independent Bitcoin explorers, read seconds apart."));
    else if (m.status === "fulfilled" || b.status === "fulfilled") { const ok = m.status === "fulfilled" ? m : b; rows.push(row("Bitcoin tip height", "block " + fmt(ok.value) + " (" + (m.status === "fulfilled" ? "mempool.space" : "blockstream.info") + ")", "second explorer unreachable this load", null, "Only one of the two explorers answered — shown as a single read, not dressed up as a cross-check.")); }
    else rows.push(row("Bitcoin tip height", "—", "—", null, "Both Bitcoin explorers were unreachable from your browser this load."));
    render();
  })();
  const reflJob = (async () => {
    try {
      const st = await jget(API + "/reflection/status?network=mainnet");
      const lagCalc = st.tipHeight - st.attestedHeight;
      rows.push(row("Reflection lag", "Tacit API reports " + fmt(st.lagBlocks) + " blocks", "recomputed here: tip " + fmt(st.tipHeight) + " − attested " + fmt(st.attestedHeight) + " = " + fmt(lagCalc), lagCalc === st.lagBlocks, "The lag is derived from the API's own two heights, recomputed in your browser — a wrong reported lag would show up here."));
      rows.push(row("Bridge traffic in flight (derived)", fmt(st.bridgeBurns) + " burns − " + fmt(st.bridgeMinted) + " mints", "= " + fmt(st.bridgeBurns - st.bridgeMinted) + " burns proven on Bitcoin, not yet minted in the pool", true, "Not a second source — arithmetic on the two counters above, done here so the API's summary is never taken on faith."));
    } catch (e) { rows.push(row("Reflection lag", "—", "—", null, "Tacit's reflection status was unreachable from your browser this load (" + e.message + ").")); }
    render();
  })();
  await Promise.allSettled([tipJob, reflJob]); stamp("#p-checks");
  /* The freshness row rides on the relay-fed /market fetch — append it whenever it lands
     instead of holding the whole panel hostage to the slowest source. */
  marketData().then(mk => { if (mk && mk.meta) { rows.push(row("Indexer freshness", "indexer last scanned block " + fmt(mk.meta.last_scanned), tipM != null ? "live tip (mempool.space): block " + fmt(tipM) : "live tip unavailable this load", tipM != null ? mk.meta.last_scanned >= tipM - 1 : null, "If the indexer lagged the chain, every indexer-fed panel on this page would be stale — this is the check that catches it.")); render(); } }).catch(() => {});
}

/* ---------- Bitcoin secondary market ---------- */
async function loadMarket() {
  try {
    const data = await marketData();
    const assets = data.assets || [];
    const byId = {}; for (const a of assets) byId[a.asset_id] = a;
    const live = (data.listings || []).filter(l => !l.expired);
    const vol24 = assets.reduce((s, a) => s + (a.volume_24h_sats || 0), 0);
    $("#market-stats").innerHTML =
      stat(fmt(live.length), "live listings right now") +
      stat((vol24 / 1e8).toFixed(6) + " BTC", "24h volume across all assets (" + fmt(vol24) + " sats)") +
      stat(fmt(assets.length), "assets tracked by the market indexer") +
      stat(fmt(assets.reduce((s, a) => s + (a.listing_count || 0), 0)), "listings counted per-asset by the indexer");
    const withListings = assets.filter(a => (a.listing_count || 0) > 0).sort((x, y) => (y.volume_24h_sats || 0) - (x.volume_24h_sats || 0) || (y.listing_count || 0) - (x.listing_count || 0));
    $("#market-body").innerHTML = withListings.length ? withListings.map(a => `<tr><td><a href="https://tacitscan.io/assets/${esc(a.asset_id)}" target="_blank" rel="noopener"><b>${esc(a.ticker || "?")}</b></a></td><td>${fmt(a.listing_count || 0)}</td><td>${a.volume_24h_sats ? (a.volume_24h_sats / 1e8).toFixed(6) + " BTC" : "—"}</td><td>${fmt(a.holder_count || 0)}</td></tr>`).join("") : '<tr><td colspan="4" class="note">No asset has a live listing right now.</td></tr>';
    const latest = [...live].sort((x, y) => (y.listed_at || 0) - (x.listed_at || 0)).slice(0, 8);
    $("#market-feed").innerHTML = latest.length ? latest.map(l => { const a = byId[l.asset_id] || {}; const dec = a.decimals == null ? 8 : a.decimals; return `<div><span class="pill">${esc(l.kind || "listing")}</span><b>${esc(a.ticker || short(l.asset_id, 8, 6))}</b> · ${esc(fmtUnits(BigInt(l.amount || "0"), dec))} @ <b>${fmt(l.price_sats || 0)} sats</b> (${((l.price_sats || 0) / 1e8).toFixed(8)} BTC)${l.listed_at ? " · listed " + ago(l.listed_at) : ""}<br><a class="mono" href="https://tacitscan.io/tx/${esc(l.txid)}" target="_blank" rel="noopener">${esc(short(l.txid, 18, 10))}</a> <span class="note">maker ${esc(short(l.maker_address || "", 14, 8))}</span></div>`; }).join("") : '<p class="note">No live listings.</p>';
    const trades = assets.filter(a => a.last_trade && a.last_trade.ts).sort((x, y) => y.last_trade.ts - x.last_trade.ts).slice(0, 5);
    $("#market-trades").innerHTML = trades.length ? trades.map(a => { const t = a.last_trade; const dec = a.decimals == null ? 8 : a.decimals; return `<div><span class="pill">trade</span><b>${esc(a.ticker || "?")}</b> · ${esc(fmtUnits(BigInt(t.amount || "0"), dec))} @ <b>${fmt(t.price_sats || 0)} sats</b>${t.fill_count ? " · " + fmt(t.fill_count) + " fill(s)" : ""} · ${ago(t.ts)}<br><a class="mono" href="https://tacitscan.io/tx/${esc(t.txid)}" target="_blank" rel="noopener">${esc(short(t.txid, 18, 10))}</a> <span class="note">on tacitscan</span></div>`; }).join("") : '<p class="note">No asset reports a last trade.</p>';
    stamp("#p-market");
  } catch (e) { fail("#p-market", "Market endpoint unreachable (" + e.message + ")."); }
}

/* ---------- Footprint lookup ---------- */
function out(html) { $("#look-out").innerHTML = html; }
async function lookupEvmAddress(addr, viaName) {
  const [balE, balB, balR, name, points] = await Promise.all([
    rpc(RPC_ETH, "eth_getBalance", [addr, "latest"]).catch(() => null),
    rpc(RPC_BASE, "eth_getBalance", [addr, "latest"]).catch(() => null),
    rpc(RPC_RH, "eth_getBalance", [addr, "latest"]).catch(() => null),
    xnsName(addr),
    jget(API + "/points/" + addr).catch(() => null),
  ]);
  let rows = "";
  for (const t of TOKENS) {
    try { const b = await ethCall(t.addr, SEL.balanceOf(addr)); if (t.dec == null) t.dec = Number(u256(await ethCall(t.addr, SEL.decimals))); const v = u256(b); if (v > 0n) rows += `<tr><td>${esc(t.sym)}</td><td class="mono">${esc(fmtUnits(v, t.dec))}</td></tr>`; } catch (e) { /* skip */ }
  }
  out(`<p><b>EVM address</b> <span class="mono">${esc(addr)}</span>${viaName ? ` <span class="pill">via XNS ${esc(viaName)}</span>` : ""}${name ? ` · XNS name: <b>${esc(name)}</b> ✅` : name === undefined ? " · XNS reverse check was unreachable this time (RPC) — not the same as having no name" : " · no XNS name registered for this address"}</p>
  <div class="grid">
    ${balE != null ? stat((Number(u256(balE)) / 1e18).toFixed(6) + " ETH", "public balance on Ethereum") : ""}
    ${balB != null ? stat((Number(u256(balB)) / 1e18).toFixed(6) + " ETH", "public balance on Base") : ""}
    ${balR != null ? stat((Number(u256(balR)) / 1e18).toFixed(6) + " ETH", "public balance on Robinhood Chain") : ""}
    ${points ? stat(fmt(points.points != null ? points.points : (points.total != null ? points.total : "?")), "Tacit points (public program)") : ""}
  </div>
  ${rows ? `<table><thead><tr><th>Public ERC-20</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="note">No public TAC / tacBTC / tacUSD / wTAC balance. Confidential pool notes held by this address are <b>not</b> visible here — by design, they are recoverable only from the owner\'s key.</p>'}
  <p class="note">Full history: <a href="https://etherscan.io/address/${esc(addr)}" target="_blank" rel="noopener">Etherscan</a> · <a href="https://basescan.org/address/${esc(addr)}" target="_blank" rel="noopener">Basescan</a> · <a href="https://robinhoodchain.blockscout.com/address/${esc(addr)}" target="_blank" rel="noopener">Robinhood Blockscout</a>. Public means public: balances, counterparties and timing of every public transaction this address ever made.</p>`);
}
async function lookup() {
  const q = $("#q").value.trim();
  if (!q) return;
  out('<p class="note">Looking up…</p>');
  try {
    if (/^tacit1[02-9ac-hj-np-z]+$/i.test(q)) {
      out(`<p><b>Tacit address (tacit1…)</b> <span class="mono">${esc(q)}</span></p>
      <p>What is public about a tacit1 ID: every Bitcoin envelope that pays it or spends from it — types, txids, blocks, timing — is visible to anyone running an indexer. What is not public: the amounts in those envelopes and which of its notes are spent, until a spend reveals a nullifier.</p>
      <p class="note">Decode + history: <a href="https://tacitscan.io/address/${encodeURIComponent(q)}" target="_blank" rel="noopener">tacitscan.io/address</a> · Tacit's address kit derives this ID from a signature locally in your wallet — this page never asks for one.</p>`);
      return;
    }
    if (/^[^@\s]+@[^@\s]+$/.test(q)) {
      const a = await xnsResolve(q);
      if (!a) { out(`<p class="err">XNS name <b>${esc(q)}</b> is not registered (registry returned the zero address).</p>`); return; }
      await lookupEvmAddress(a, q); return;
    }
    if (/^0x[0-9a-fA-F]{40}$/.test(q)) { await lookupEvmAddress(q); return; }
    if (/^[0-9a-fA-F]{64}$/.test(q)) {
      try {
        const tx = await jget(MEMPOOL + "/tx/" + q.toLowerCase());
        out(`<p><b>Bitcoin transaction</b> <span class="mono">${esc(short(q, 20, 12))}</span></p>
        <div class="grid">${stat(tx.status && tx.status.confirmed ? "confirmed" : "mempool", "status")}${tx.status && tx.status.block_height ? stat(fmt(tx.status.block_height), "block height") : ""}${stat(fmt(tx.fee || 0) + " sats", "fee — public")}${stat(fmt(tx.vin ? tx.vin.length : 0) + " in / " + fmt(tx.vout ? tx.vout.length : 0) + " out", "inputs / outputs — the graph is public")}</div>
        <p class="note">If this tx carries a Tacit envelope, tacitscan decodes its type — but a transfer envelope's amount stays hidden in its commitment. <a href="https://tacitscan.io/tx/${esc(q.toLowerCase())}" target="_blank" rel="noopener">tacitscan</a> · <a href="https://mempool.space/tx/${esc(q.toLowerCase())}" target="_blank" rel="noopener">mempool.space</a></p>`);
        return;
      } catch (e) { /* not a Bitcoin tx — try EVM */ }
      const eht = await rpc(RPC_ETH, "eth_getTransactionByHash", ["0x" + q.toLowerCase()]).catch(() => null);
      const bat = eht ? null : await rpc(RPC_BASE, "eth_getTransactionByHash", ["0x" + q.toLowerCase()]).catch(() => null);
      const rht = (eht || bat) ? null : await rpc(RPC_RH, "eth_getTransactionByHash", ["0x" + q.toLowerCase()]).catch(() => null);
      const t = eht || bat || rht;
      const chainName = eht ? "Ethereum" : bat ? "Base" : "Robinhood Chain";
      const explorer = eht ? "https://etherscan.io/tx/0x" : bat ? "https://basescan.org/tx/0x" : "https://robinhoodchain.blockscout.com/tx/0x";
      if (t) { out(`<p><b>EVM transaction</b> on ${chainName} <span class="mono">${esc(short("0x" + q, 20, 12))}</span></p><div class="grid">${stat(fmt(parseInt(t.blockNumber, 16)), "block")}${stat(esc(short(t.from, 12, 8)), "from — public")}${stat(esc(short(t.to || "contract creation", 12, 8)), "to — public")}${stat((Number(u256(t.value)) / 1e18) + " ETH", "public value (pool-internal amounts would stay hidden)")}</div><p class="note"><a href="${explorer}${esc(q.toLowerCase())}" target="_blank" rel="noopener">open in explorer</a></p>`); return; }
      out('<p class="err">That 64-hex ID was not found as a Bitcoin tx or as an EVM tx on Ethereum/Base/Robinhood.</p>'); return;
    }
    if (/^(bc1|tb1)[02-9ac-hj-np-z]+$/i.test(q)) {
      const a = await jget(MEMPOOL + "/address/" + q);
      const cs = a.chain_stats || {};
      out(`<p><b>Bitcoin address</b> <span class="mono">${esc(short(q, 20, 12))}</span></p>
      <div class="grid">${stat(fmt(cs.tx_count || 0), "transactions — all public")}${stat(fmt((cs.funded_txo_sum || 0) - (cs.spent_txo_sum || 0)) + " sats", "current balance — public")}${stat(fmt(cs.funded_txo_sum || 0) + " sats", "total received — public")}</div>
      <p class="note">A plain Bitcoin address hides nothing: full history on <a href="https://mempool.space/address/${esc(q)}" target="_blank" rel="noopener">mempool.space</a>. Tacit envelopes sent <i>from</i> it still hide their amounts.</p>`);
      return;
    }
    if (/^0x[0-9a-fA-F]{64}$/.test(q)) { $("#q").value = q; return lookup(); }
    out('<p class="err">Unrecognized format. Expected a tacit1… ID, a 64-hex txid/hash, a bc1… Bitcoin address, a 0x EVM address, or a name@namespace XNS name.</p>');
  } catch (e) { out('<p class="err">Lookup failed: ' + esc(e.message) + ' — the source was unreachable or returned nothing for that ID.</p>'); }
}

/* ---------- boot ---------- */
function tick() { $("#clock").textContent = "Last refresh cycle: " + new Date().toLocaleString(); }
function loadAll() { marketDataP = null; tick(); loadBridge(); loadBitcoin(); loadPool(); loadEvm(); loadChecks(); loadMarket(); }
$("#refresh").addEventListener("click", loadAll);
$("#go").addEventListener("click", lookup);
$("#q").addEventListener("keydown", e => { if (e.key === "Enter") lookup(); });
loadAll();
setInterval(loadAll, 30000); /* realtime posture: full re-read of every source every 30 seconds */
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadAll(); });
