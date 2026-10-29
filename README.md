# TACITLENS — a one-page Tacit explorer across both chains

Built for [poidh bounty #1519 “Vibecode a Tacit Explorer”](https://poidh.xyz/base/bounty/1519) (Base, JUDGED, deadline Mon 16 Nov 2026 14:59 WIB / Sun 15 Nov 2026 11:59 PM PT).

Tacit issues and moves assets in Taproot envelopes on **Bitcoin**, the same confidential notes live in a pool on **Ethereum** (plus a separate multichain EVM pool on Ethereum, Base, Robinhood Chain and MegaETH), and SP1 proofs carry state between them. TACITLENS puts the whole system on one live page.

**Live URL:** https://tacitlens.vercel.app (fallback mirror: https://hdr2804.github.io/tacitlens/)
**Stack:** one static `index.html` + `app.js`. No backend, no build step, no API keys, no wallet, no sign-in. All data is fetched client-side at page load and refreshed every 2 minutes.

## Panels and their exact data sources

| Panel | Source (all public, CORS-enabled, keyless) |
| --- | --- |
| Bridge / reflection | `GET https://api.tacit.finance/reflection/status?network=mainnet` (attested height, relay tip, lag, bridge burns/mints, burns awaiting bundle, live notes, folded cross-outs) + `GET https://api.tacit.finance/confidential/relay` |
| Bitcoin tip + fees | `https://mempool.space/api/blocks/tip/height`, `https://mempool.space/api/v1/fees/recommended` |
| Recent envelopes (etches & burns) + asset directory | `GET https://api.tacit.finance/assets?network=mainnet` — etches (CETCH/T_PETCH) and burns (T_BURN) are envelope events in Tacit's own indexer; each row links to its tacitscan decode |
| Bitcoin-native AMM pool (tETH/TAC) | `GET https://api.tacit.finance/amm/pools?network=mainnet` — pool `aa3eab26…33eb79`, validation `verified` |
| ConfidentialPool (Ethereum) | Public RPC `https://ethereum-rpc.publicnode.com` — `eth_call cbtcBackingSats()` on the pool `0x000000000Ed1eabD231Be41d93b719056F7febFC`, `outstandingCusd()` on CollateralEngine `0x000000003f608BDdF0ca45934003ffb9DbDF70DB`; open relay board `GET https://api.tacit.finance/confidential/open?limit=10` |
| Canonical ERC-20 supplies (TAC, tacBTC/cBTC, tacUSD/cUSD, wTAC) | Same RPC: `symbol()` / `decimals()` / `totalSupply()` on `0xA1313eb9…58279`, `0xdf1d9914…0D696`, `0x23cACFFA…21564`, `0x2018139a…7AEf` |
| EVM pool on Ethereum + Base | Keeper `GET https://tacit-evm-pool-keepers.onrender.com/{1,8453}/evm-pool/keeper/head` and `/events?from=<block>`; chain block numbers via `https://ethereum-rpc.publicnode.com` / `https://base-rpc.publicnode.com` |
| Launch farms (wTAC rewards) | `GET https://api.tacit.finance/farm/program?network=mainnet` + `GET https://api.tacit.finance/farm/health` |
| Footprint lookup | tacit1 → tacitscan address page (linked); BTC txid → `mempool.space/api/tx/<txid>`; BTC address → `mempool.space/api/address/<addr>`; EVM address → RPC balances on ETH + Base, ERC-20 `balanceOf`, `GET https://api.tacit.finance/points/<address>`; EVM tx → `eth_getTransactionByHash` on both RPCs |
| **XNS bonus** | On-chain XNS registry `0x6e797ba2d3103aF167918e71a7E01DE40D45f74b` (Ethereum) via `eth_call getName(address)` / `getAddress(string)` — reverse names shown in lookup, and `name@namespace` search resolves to an address. Verified live: `0xd8dA…6045` → `vitalik@eth` |

### Known source limitation, stated honestly
tacitscan's own JSON feed (`https://tacitscan.io/api/feed`) sends **no `Access-Control-Allow-Origin` header**, so a browser page on another origin cannot embed it. TACITLENS therefore builds its envelope feed from Tacit's own indexer API (same chain data, CORS-enabled) and links every row out to its tacitscan decode page. No panel fakes a number: if a source is unreachable, the panel shows an error instead.

## Privacy boundary (the honest part)
The page itself demonstrates the boundary: it can display envelope existence, types, counts, timing, fees, public addresses, nullifiers and pool counters — and it *cannot* display confidential amounts (Pedersen commitments), note-to-note links inside the pool, blindings, or anyone's confidential balance. The in-page panel says exactly this, including the relay caveat from Tacit's build guide (a relay you ask to prove for you sees that op's witness; proving locally keeps it on your device).

## Run / deploy
- Local: `python3 -m http.server 8931` in this directory, open http://localhost:8931/
- Vercel: `vercel deploy --prod` (static, no config needed beyond `vercel.json`)
- GitHub Pages: Settings → Pages → deploy from `main` branch root.

Read-only by design: this page never asks for a seed phrase or private key, never asks for a signature, and never moves funds.

Contract addresses are copied from Tacit's official `docs/DEPLOYMENTS.md` (github.com/src-company/tacit). XNS contract from the XNSv2 README (github.com/Walodja1987/XNSv2).
