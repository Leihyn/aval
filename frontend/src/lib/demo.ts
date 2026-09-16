// Drives the REAL simulator in the browser. This is not a mock of the protocol,
// it is the protocol: every value rendered comes from a circuit execution.
import { AvalSimulator, bytes32, leafFor, type LockRecord } from '@contract/test/simulator';

export const BOB = bytes32('bob-counterparty');
export const ALICE_KEY = bytes32('alice-key');
export const ATTESTOR_KEY = bytes32('bob-attestor-key');
export const EXPIRY = 9_000n;
export const NOW = 1_000;

export type LedgerView = {
  attestor_registered: boolean;
  attestor_id: string;
  merkle_root: string;
  nullifiers: string[];
  fills: string;
};

const hex = (b: Uint8Array) =>
  Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');

export const readLedger = (sim: AvalSimulator): LedgerView => ({
  attestor_registered: sim.public.attestor_registered,
  attestor_id: hex(sim.public.attestor).slice(0, 24) + '…',
  merkle_root: String(sim.public.attestations.root().field ?? '').slice(0, 24) + '…',
  nullifiers: [...sim.public.spent].map((n) => hex(n).slice(0, 24) + '…'),
  fills: sim.public.fills.toString(),
});

/** Alice genuinely holds this much. The chain must never learn it. */
export const DEMO_LOCK: LockRecord = {
  lockId: bytes32('eth-lock-8837'),
  amount: 2_000_000n,
  salt: bytes32('salt-8837'),
};

export async function bootstrap() {
  const sim = await AvalSimulator.create(ATTESTOR_KEY);
  await sim.registerAttestor(ATTESTOR_KEY, NOW);
  await sim.registerAttestation(ATTESTOR_KEY, leafFor(DEMO_LOCK, BOB, EXPIRY), NOW);
  return sim;
}

export async function prove(sim: AvalSimulator, required: bigint) {
  await sim.proveFundsInFlight({
    secretKey: ALICE_KEY,
    lock: DEMO_LOCK,
    required,
    counterparty: BOB,
    expiry: EXPIRY,
    time: NOW,
  });
}

/**
 * Bootstrap a FRESH contract whose single attested lock holds `amount`, then
 * prove it against `required`. Used by the indistinguishability control: the
 * viewer flips the amount and watches the public ledger fail to change.
 *
 * Additive. `bootstrap` and `prove` above are untouched.
 */
export async function runWithAmount(amount: bigint, required: bigint) {
  const sim = await AvalSimulator.create(ATTESTOR_KEY);
  await sim.registerAttestor(ATTESTOR_KEY, NOW);
  const lock: LockRecord = {
    lockId: bytes32('eth-lock-8837'),
    amount,
    salt: bytes32('salt-8837'),
  };
  await sim.registerAttestation(ATTESTOR_KEY, leafFor(lock, BOB, EXPIRY), NOW);
  let ok = true;
  let error: string | null = null;
  try {
    await sim.proveFundsInFlight({
      secretKey: ALICE_KEY, lock, required, counterparty: BOB, expiry: EXPIRY, time: NOW,
    });
  } catch (e) {
    ok = false;
    error = (e instanceof Error ? e.message : String(e)).replace(/^.*failed assert: /, '').split('\n')[0];
  }
  return { ledger: readLedger(sim), ok, error, amount };
}
