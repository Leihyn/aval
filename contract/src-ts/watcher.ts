// File: contract/src-ts/watcher.ts
//
// The attestor side. Observes a lock on the source chain and registers a commitment
// to it on Midnight. In the bilateral deployment the counterparty runs this process
// themselves: their CONTRACT cannot see Ethereum even though they can, which is why
// the trust assumption collapses to "Bob trusts Bob's own node".
import { pureCircuits } from '../out/contract/index.js';
import type { AvalSimulator } from '../test/simulator.js';
import type { LockedEvent, LockRecord } from './types.js';

/** Randomness for the commitment. Stops two identical locks from colliding. */
export const freshSalt = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

export type Attestation = {
  leaf: Uint8Array;
  /** Sent to the beneficiary off-chain. Never published. */
  preimage: LockRecord;
  counterparty: Uint8Array;
  expiry: bigint;
};

/**
 * Register a commitment to an observed lock, and return the preimage for out-of-band
 * delivery to the beneficiary.
 *
 * The leaf is computed with `pureCircuits.leaf_hash`, exported by the compiler from
 * the same source the circuit enforces. There is exactly one definition of the
 * commitment in this system. A hand-rolled reimplementation that drifted by a single
 * byte would break every proof silently.
 */
export async function attestLock(
  sim: AvalSimulator,
  attestorKey: Uint8Array,
  event: LockedEvent,
  salt: Uint8Array = freshSalt(),
): Promise<Attestation> {
  const preimage: LockRecord = { lockId: event.lockId, amount: event.amount, salt };

  const leaf = pureCircuits.leaf_hash(
    preimage.lockId,
    preimage.amount,
    event.beneficiary,
    event.expiry,
    preimage.salt,
  );

  await sim.registerAttestation(attestorKey, leaf);

  return { leaf, preimage, counterparty: event.beneficiary, expiry: event.expiry };
}
