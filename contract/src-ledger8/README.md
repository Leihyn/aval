# Ledger 8 build

This directory exists to prove a single claim: **the contract compiles against the ledger
version Midnight Preprod actually runs**, not only against the newer one the default
toolchain targets.

`inflight.compact` here is byte-identical to `../src/inflight.compact` except for one line,
the `pragma language_version` floor, because toolchain 0.31.1 ships language 0.23.0.

| | canonical build | this build |
|---|---|---|
| source | `../src/inflight.compact` | `inflight.compact` |
| toolchain | 0.34.0 | 0.31.1 |
| language | 0.26.0 | 0.23.0 |
| **ledger** | **9.1.0.0-rc.3** | **8.0.2** (what Preprod runs) |
| runtime | 0.19.0 | 0.16.0 |
| output | `../out/` | `../out-ledger8/` |

`../out/` is canonical and is what the test suite imports. This one is evidence.

Reproduce:

```bash
compact update 0.31 --no-set-default          # installs alongside, does not change your default
compact compile +0.31.1 src-ledger8/inflight.compact out-ledger8
```

Every circuit compiles under both. Deployment to Preprod is therefore gated on a local
proof server and a faucet CAPTCHA, not on the contract.
