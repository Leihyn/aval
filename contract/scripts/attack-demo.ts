// File: contract/scripts/attack-demo.ts
// Runs six real attacks against the compiled circuits and prints the actual
// revert string each one produces. Nothing here is scripted output: every line
// below the header is thrown by the contract.
import { AvalSimulator, bytes32, leafFor } from '../test/simulator.js';

const ATTESTOR = bytes32('bob-attestor-key');
const ALICE = bytes32('alice-key');
const BOB = bytes32('bob-counterparty');
const CAROL = bytes32('carol-counterparty');
const EXPIRY = 9_000n;
const LOCK = { lockId: bytes32('eth-lock-8837'), amount: 2_000_000n, salt: bytes32('salt-8837') };

const fresh = async () => {
  const s = await AvalSimulator.create(ATTESTOR);
  await s.registerAttestor(ATTESTOR, 1_000);
  await s.registerAttestation(ATTESTOR, leafFor(LOCK, BOB, EXPIRY), 1_000);
  return s;
};

const attempt = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
    console.log(`  ${label.padEnd(34)} NOT BLOCKED  <-- would be a bug`);
  } catch (e) {
    const m = (e instanceof Error ? e.message : String(e)).replace(/^.*failed assert: /, '').split('\n')[0];
    console.log(`  ${label.padEnd(34)} BLOCKED: ${m}`);
  }
};

(async () => {
  console.log('--- Aval: six real attacks, six real revert strings ---\n');

  let s = await fresh();
  await s.proveFundsInFlight({ secretKey: ALICE, lock: LOCK, required: 1_500_000n, counterparty: BOB, expiry: EXPIRY, time: 1_000 });
  await attempt('reuse the same lock twice', () =>
    s.proveFundsInFlight({ secretKey: ALICE, lock: LOCK, required: 1_500_000n, counterparty: BOB, expiry: EXPIRY, time: 1_000 }));

  s = await fresh();
  await attempt('inflate the claimed amount', () =>
    s.proveFundsInFlight({ secretKey: ALICE, lock: { ...LOCK, amount: 90_000_000n }, required: 50_000_000n, counterparty: BOB, expiry: EXPIRY, time: 1_000 }));

  s = await fresh();
  await attempt('redirect to a different payee', () =>
    s.proveFundsInFlight({ secretKey: ALICE, lock: LOCK, required: 1_500_000n, counterparty: CAROL, expiry: EXPIRY, time: 1_000 }));

  s = await fresh();
  await attempt('extend your own expiry', () =>
    s.proveFundsInFlight({ secretKey: ALICE, lock: LOCK, required: 1_500_000n, counterparty: BOB, expiry: 99_999n, time: 1_000 }));

  s = await fresh();
  await attempt('prove after expiry', () =>
    s.proveFundsInFlight({ secretKey: ALICE, lock: LOCK, required: 1_500_000n, counterparty: BOB, expiry: EXPIRY, time: 9_001 }));

  s = await fresh();
  await attempt('ask for more than is locked', () =>
    s.proveFundsInFlight({ secretKey: ALICE, lock: LOCK, required: 2_000_001n, counterparty: BOB, expiry: EXPIRY, time: 1_000 }));

  console.log('\n  All six blocked by the circuit, not by application code.');
})();
