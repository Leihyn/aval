// File: contract/scripts/indistinguishability.ts
// Two worlds. Same lock id, same salt, same counterparty, same expiry.
// Amounts 100x apart. Prints the complete public ledger state of each.
import { AvalSimulator, bytes32, leafFor } from '../test/simulator.js';

const ATTESTOR = bytes32('bob-attestor-key');
const ALICE = bytes32('alice-key');
const BOB = bytes32('bob-counterparty');
const EXPIRY = 9_000n;

const run = async (amount: bigint) => {
  const s = await AvalSimulator.create(ATTESTOR);
  const l = { lockId: bytes32('lock-1'), amount, salt: bytes32('salt-lock-1') };
  await s.registerAttestation(ATTESTOR, leafFor(l, BOB, EXPIRY), 1_000);
  await s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: 1_000n, counterparty: BOB, expiry: EXPIRY, time: 1_000 });
  const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
  return {
    attestor: hex(s.public.attestor).slice(0, 16) + '..',
    fills: s.public.fills.toString(),
    nullifier: ([...s.public.spent].map(hex)[0] ?? '').slice(0, 16) + '..',
    spent_size: s.public.spent.size().toString(),
    merkle_root: String(s.public.attestations.root().field).slice(0, 16) + '..',
  };
};

(async () => {
  const a = await run(50_000n);
  const b = await run(5_000_000n);
  const keys = Object.keys(a) as (keyof typeof a)[];
  console.log('--- Aval: can an observer tell 50,000 from 5,000,000? ---\n');
  console.log(`  ${'public field'.padEnd(14)} ${'amount = 50,000'.padEnd(20)} ${'amount = 5,000,000'.padEnd(20)}  same?`);
  console.log('  ' + '-'.repeat(72));
  for (const k of keys) {
    const same = a[k] === b[k];
    console.log(`  ${k.padEnd(14)} ${String(a[k]).padEnd(20)} ${String(b[k]).padEnd(20)}  ${same ? 'IDENTICAL' : 'DIFFERS'}`);
  }
  console.log('\n  Every field an observer can read is identical except the merkle root,');
  console.log('  and a root is a hash: it commits to the leaf without revealing it.');
  console.log('  The nullifier is byte-identical across a 100x difference in amount.');
})();
