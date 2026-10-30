# CLAIM PACK — poidh Base #1519 “Vibecode a Tacit Explorer”

- **Bounty:** https://poidh.xyz/base/bounty/1519 (Base, JUDGED — Useful / Correct / Clear / Honest-about-privacy)
- **Deadline:** Mon 16 Nov 2026 14:59 WIB (Sun 15 Nov 2026 11:59 PM PT)
- **Live URL:** https://hdr2804.github.io/tacitlens/
- **Repo (public):** https://github.com/hdr2804/tacitlens
- **Cover image:** `screenshot.png` (viewport, 2.880px) and `screenshot-full.png` (full page, 2.850px wide) in this folder / repo root — REAL browser screenshots of the live page at 2× retina with every panel populated, captured 30 Oct 2026 ~18:21 WIB. Use the full-page one for the claim; the viewport one is what the X post used.
- **Status:** CLAIM SUBMITTED & LIVE-VERIFIED 30 Oct 2026 ~18:34 WIB — **claim ID 9230** by hdr (title + description match this pack exactly, X link included). Field at verification: **1 claim — ours is the only entry so far**. X post live 18:15 WIB (https://x.com/Hdr284/status/2116126952235094526). Winner picked by contributors after the Mon 16 Nov 2026 14:59 WIB deadline.

---

## Claim title (paste into the claim title field)

**TACITLENS — one page, both chains: 3,762 live pool notes, 549 bridge burns, 81 Bitcoin assets, and a privacy panel that shows its own blind spots**

## Claim description (paste into the claim description field)

TACITLENS is a one-page live explorer for Tacit across both chains — no mock data, everything below is fetched in your browser from public mainnet sources when the page loads, and every panel names its source and shows when it was updated.

What it shows:
• Bridge / reflection: Bitcoin height folded into the pool (973,703 at build time), header-relay tip, reflection lag at 24 confirmations, 549 bridge burns vs 529 mints (the difference is in-flight traffic), burns awaiting bundle, 3,762 live confidential notes, relay state.
• Bitcoin side: live envelope feed (etches & burns from Tacit's own indexer, each linked to its tacitscan decode), chain tip + fees, the asset directory (81 assets; canonical TAC: 2,285 holders, 5,894 confidential transfers), and the Bitcoin-native tETH/TAC AMM pool (xcurve-verified, reserves + last swap).
• Ethereum side: the immutable ConfidentialPool read directly by eth_call — cBTC backing 11,949,754 sats (0.11949754 BTC, reflection-attested locks), cUSD CDP debt outstanding on the CollateralEngine, the open relay board, and live totalSupply for TAC (2,747,883.3), tacBTC, tacUSD and wTAC.
• EVM pool on Ethereum + Base: keeper head (note-tree size 660 on Ethereum, 131,692 on Base) and the latest Transact/Received events per chain, plus the launch farms (1,107.7776 TAC/day in wTAC, solvency health check).
• Privacy boundary panel: grounded in what the page itself can fetch — envelope existence, counts, timing, fees and public addresses are visible; amounts (Pedersen commitments), note-to-note links and blindings are not, and the panel says so, including the relay-witness caveat from Tacit's own build guide.
• Footprint lookup: paste a tacit1 ID, a Bitcoin txid, a Bitcoin address, an EVM address or tx hash — or an XNS name. XNS bonus implemented on-chain: the registry's getName/getAddress are read by eth_call (e.g. the famous 0xd8dA…6045 resolves to vitalik@eth), and names are shown wherever an address is looked up.

Method: one static HTML page + one JS file, no backend, no API keys, no wallet or sign-in, read-only by design (never asks for a seed/private key, never moves funds). Sources: api.tacit.finance (reflection, relay, indexer /assets, /amm/pools, farms, points), mempool.space, public Ethereum/Base RPC, the Tacit EVM-pool keepers, the XNS registry contract, and tacitscan (linked per-row; its JSON feed sends no CORS header, so the envelope feed is built from Tacit's own indexer API instead. The indexer's /assets and /amm endpoints only allow the tacit.finance origin via CORS, so those two feeds are read through a public CORS relay — the payload is Tacit's own JSON, and this is stated openly on the page and in the README). If a source is unreachable, a panel shows an error rather than an invented number.

Live: https://hdr2804.github.io/tacitlens/
Repo: https://github.com/hdr2804/tacitlens
X post: https://x.com/Hdr284/status/2116126952235094526

Numbers in this description are the live values observed on 30 Oct 2026 and will have moved by judging time — the page always shows the current ones.

---

## Draft X post (Hdr posts this himself — tags required by the brief)

Primary (fits 280 chars):

```
TACITLENS 🔍 one page, both chains for @tacitfi: BTC envelopes + AMM, ETH confidential pool, Base EVM pool, SP1 bridge — real mainnet data only.
Live: hdr2804.github.io/tacitlens
Repo: github.com/hdr2804/tacitlens
@z0r0zzz @davidpereIsHIM @xns
```

Attach: `screenshot.png` (this is what the actual X post used).

Longer alternative (if the account has X Premium):

```
Built TACITLENS 🔍 — a one-page explorer for @tacitfi across both chains.

Bitcoin Taproot envelopes + the native tETH/TAC AMM, the Ethereum ConfidentialPool (cBTC backing read by eth_call), the EVM pool on Ethereum + Base, and the SP1 reflection bridge — 549 burns, 523 mints, 3,761 live notes at build time. Plus an honest privacy panel: what an observer can see, and what stays hidden.

All real mainnet data, fetched live in your browser. No wallet, no keys, no mocks.
Live: https://hdr2804.github.io/tacitlens/
Code: https://github.com/hdr2804/tacitlens

@tacitfi @z0r0zzz @davidpereIsHIM @xns
```

(@xns is tagged because the XNS bonus is genuinely implemented — on-chain getName/getAddress resolution in the lookup panel.)

---

## Submission checklist for Hdr

1. ~~Post on X~~ — DONE 30 Oct 18:15 WIB: https://x.com/Hdr284/status/2116126952235094526 (verified: exact text, all tags, screenshot attached, public).
2. Go to https://poidh.xyz/base/bounty/1519 → Claim → title + description from this file (the X post link is already filled in) + attach `screenshot-full.png` → submit (small Base gas for the claim tx).
3. Deadline: **Mon 16 Nov 2026 14:59 WIB**. No KYC. Nothing else to pay.

## Notes / blockers

- Vercel: the connected Vercel MCP lacks the team-scope grant (403, scope "hdr2804s-projects", action grant_team_access), so the primary host is GitHub Pages (live, HTTP 200, built from `main`). The repo is Vercel-ready (`vercel.json`); if Hdr grants the scope or runs `vercel deploy --prod`, the same site serves from Vercel unchanged.
- tacitscan's `/api/feed` has no CORS header — documented limitation, handled by building the feed from Tacit's own indexer API and linking out to tacitscan decodes. The indexer `/assets` + `/amm` endpoints are CORS-locked to the tacit.finance origin (found during a real-browser screenshot check on 30 Oct — a Node/jsdom check had missed it because it doesn't enforce CORS); fixed the same day by reading those two feeds through the allorigins `/raw` CORS relay, with the relay disclosed on the page itself.
