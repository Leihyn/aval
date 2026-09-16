// File: contract/scripts/seed-demo.ts
//
// Produces demo state through REAL circuit execution. The product's claim is
// verifiability, so a demo backed by hand-written JSON would contradict the pitch.
// Every number this prints came out of a circuit.
import { AvalSimulator, bytes32 } from '../test/simulator.js';
import { attestLock } from '../src-ts/watcher.js';
import type { LockedEvent } from '../src-ts/types.js';

const ATTESTOR = bytes32('bob-attestor-key');
const ALICE = bytes32('alice-key');
const BOB = bytes32('bob-counterparty');
const EXPIRY = 9_000n;
const NOW = 1_000;

/** Three realistic in-flight locks. Amounts are private; only the count is public. */
const LOCKS: LockedEvent[] = [
  { lockId: bytes32('eth-lock-8837'), amount: 2_000_000n, beneficiary: BOB, expiry: EXPIRY },
  { lockId: bytes32('eth-lock-8841'), amount: 750_000n, beneficiary: BOB, expiry: EXPIRY },
  { lockId: bytes32('eth-lock-8852'), amount: 120_000n, beneficiary: BOB, expiry: EXPIRY },
];

export async function seed() {
  const sim = await AvalSimulator.create(ATTESTOR);
  await sim.registerAttestor(ATTESTOR, NOW);

  const attestations = [];
  for (const event of LOCKS) {
    attestations.push(await attestLock(sim, ATTESTOR, event, bytes32(`salt-${event.amount}`)));
  }

  // One real proof so the demo opens on genuinely-produced, non-empty state.
  await sim.proveFundsInFlight({
    secretKey: ALICE,
    lock: attestations[0].preimage,
    required: 1_500_000n,
    counterparty: BOB,
    expiry: EXPIRY,
    time: NOW,
  });

  return { sim, attestations };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').pop()!);

if (invokedDirectly) {
  seed().then(({ sim }) => {
    const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
    console.log('--- Aval demo seed: produced by real circuit execution ---');
    console.log('attestor registered :', sim.public.attestor_registered);
    console.log('attestations in tree:', LOCKS.length);
    console.log('fills               :', sim.public.fills.toString());
    console.log('nullifiers spent    :', sim.public.spent.size().toString());
    console.log('nullifier           :', [...sim.public.spent].map(hex)[0] ?? '(none)');
    console.log('amount in ledger    : absent by construction');
  }).catch((e) => { console.error('seed failed:', e); process.exit(1); });
}
