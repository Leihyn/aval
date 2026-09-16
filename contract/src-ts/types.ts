// File: contract/src-ts/types.ts
/** One source-chain lock, as known privately by its holder. */
export type LockRecord = {
  lockId: Uint8Array;
  amount: bigint;
  salt: Uint8Array;
};

/** Private state: the caller's key plus whichever lock they are proving. */
export type AvalPrivateState = {
  secretKey: Uint8Array;
  lock: LockRecord | null;
};

/** A lock event observed on the source chain. */
export type LockedEvent = {
  lockId: Uint8Array;
  amount: bigint;
  beneficiary: Uint8Array;
  expiry: bigint;
};
