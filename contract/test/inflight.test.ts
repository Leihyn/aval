import { describe, it, expect, beforeEach } from 'vitest';
import { AvalSimulator, bytes32, leafFor, nullifierFor, type LockRecord } from './simulator.js';

const ATTESTOR = bytes32('attestor-key');
const ALICE = bytes32('alice-key');
const MALLORY = bytes32('mallory-key');
const BOB = bytes32('bob-counterparty');
const CAROL = bytes32('carol-counterparty');

const EXPIRY = 9_000n;
const NOW = 1_000n;

const lockOf = (id: string, amount: bigint): LockRecord => ({
  lockId: bytes32(id),
  amount,
  salt: bytes32(`salt-${id}`),
});

let sim: AvalSimulator;

/** Fresh contract with the attestor already bootstrapped. */
const freshWithAttestor = async () => {
  const s = await AvalSimulator.create(ATTESTOR);
  await s.registerAttestor(ATTESTOR);
  return s;
};

/** Attestor observes a source-chain lock and registers its commitment. */
const attest = async (s: AvalSimulator, lock: LockRecord, counterparty = BOB, expiry = EXPIRY) => {
  await s.registerAttestation(ATTESTOR, leafFor(lock, counterparty, expiry));
};

describe('attestor registration', () => {
  beforeEach(async () => {
    sim = await AvalSimulator.create(ATTESTOR);
  });

  it('starts with no attestor and an empty ledger', () => {
    expect(sim.public.attestor_registered).toBe(false);
    expect(sim.public.fills).toBe(0n);
    expect(sim.public.spent.isEmpty()).toBe(true);
  });

  it('registers an attestor exactly once', async () => {
    await sim.registerAttestor(ATTESTOR);
    expect(sim.public.attestor_registered).toBe(true);
    await expect(sim.registerAttestor(ATTESTOR)).rejects.toThrow(/already registered/);
  });

  it('never writes the attestor secret key to the public ledger', async () => {
    await sim.registerAttestor(ATTESTOR);
    const published = Buffer.from(sim.public.attestor).toString('hex');
    expect(published).not.toBe(Buffer.from(ATTESTOR).toString('hex'));
    expect(published).toHaveLength(64);
  });
});

describe('attestation registry access control', () => {
  beforeEach(async () => {
    sim = await freshWithAttestor();
  });

  it('lets the attestor register a commitment', async () => {
    const lock = lockOf('lock-1', 50_000n);
    await attest(sim, lock);
    expect(sim.public.attestations.findPathForLeaf(leafFor(lock, BOB, EXPIRY))).toBeDefined();
  });

  it('rejects a non-attestor trying to register a commitment', async () => {
    const lock = lockOf('forged', 1_000_000n);
    await expect(
      sim.registerAttestation(MALLORY, leafFor(lock, BOB, EXPIRY)),
    ).rejects.toThrow(/not the attestor/);
  });
});

describe('prove_funds_in_flight, the money path', () => {
  const lock = lockOf('lock-1', 50_000n);

  beforeEach(async () => {
    sim = await freshWithAttestor();
    await attest(sim, lock);
  });

  it('proves a registered lock clears the threshold', async () => {
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 40_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    expect(sim.public.fills).toBe(1n);
  });

  it('proves an exact-threshold lock (amount == required)', async () => {
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 50_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    expect(sim.public.fills).toBe(1n);
  });

  it('rejects a lock below the required threshold', async () => {
    await expect(
      sim.proveFundsInFlight({
        secretKey: ALICE, lock, required: 50_001n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
      }),
    ).rejects.toThrow(/below required threshold/);
    expect(sim.public.fills).toBe(0n);
  });

  it('rejects a lock that was never registered by the attestor', async () => {
    const unregistered = lockOf('ghost', 999_999n);
    await expect(
      sim.proveFundsInFlight({
        secretKey: ALICE, lock: unregistered, required: 1n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
      }),
    ).rejects.toThrow(/no merkle path|not registered/);
  });
});

describe('nullifier, one lock backs exactly one proof', () => {
  const lock = lockOf('lock-1', 50_000n);

  beforeEach(async () => {
    sim = await freshWithAttestor();
    await attest(sim, lock);
  });

  it('records the nullifier on first use', async () => {
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    expect(sim.public.spent.member(nullifierFor(lock))).toBe(true);
    expect(sim.public.spent.size()).toBe(1n);
  });

  it('rejects the same lock being proven twice', async () => {
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    await expect(
      sim.proveFundsInFlight({
        secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
      }),
    ).rejects.toThrow(/already backed a proof/);
    expect(sim.public.fills).toBe(1n);
  });

  it('rejects double-spend even when a different party holds the same lock data', async () => {
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    await expect(
      sim.proveFundsInFlight({
        secretKey: MALLORY, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
      }),
    ).rejects.toThrow(/already backed a proof/);
  });

  it('allows two DIFFERENT locks to each back their own proof', async () => {
    const second = lockOf('lock-2', 70_000n);
    await attest(sim, second);
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock: second, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    expect(sim.public.fills).toBe(2n);
    expect(sim.public.spent.size()).toBe(2n);
  });
});

describe('binding, an attestation is not transferable', () => {
  const lock = lockOf('lock-1', 50_000n);

  beforeEach(async () => {
    sim = await freshWithAttestor();
    await attest(sim, lock, BOB, EXPIRY);
  });

  it('rejects replaying an attestation issued for Bob against Carol', async () => {
    await expect(
      sim.proveFundsInFlight({
        secretKey: ALICE, lock, required: 10_000n, counterparty: CAROL, expiry: EXPIRY, time: Number(NOW),
      }),
    ).rejects.toThrow(/no merkle path|not registered/);
  });

  it('rejects a prover who inflates the amount they claim to hold', async () => {
    const inflated = { ...lock, amount: 5_000_000n };
    await expect(
      sim.proveFundsInFlight({
        secretKey: ALICE, lock: inflated, required: 1_000_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
      }),
    ).rejects.toThrow(/no merkle path|not registered/);
  });

  it('rejects a prover who extends their own expiry', async () => {
    await expect(
      sim.proveFundsInFlight({
        secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: 99_999n, time: Number(NOW),
      }),
    ).rejects.toThrow(/no merkle path|not registered/);
  });
});

describe('expiry, enforced by ledger block time', () => {
  const lock = lockOf('lock-1', 50_000n);

  beforeEach(async () => {
    sim = await freshWithAttestor();
    await attest(sim, lock);
  });

  it('accepts a proof before expiry', async () => {
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: 8_999,
    });
    expect(sim.public.fills).toBe(1n);
  });

  it('rejects a proof after expiry', async () => {
    await expect(
      sim.proveFundsInFlight({
        secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: 9_001,
      }),
    ).rejects.toThrow(/expired/);
    expect(sim.public.fills).toBe(0n);
  });
});

describe('privacy, what the public ledger does and does not reveal', () => {
  const lock = lockOf('lock-1', 50_000n);

  beforeEach(async () => {
    sim = await freshWithAttestor();
    await attest(sim, lock);
    await sim.proveFundsInFlight({
      secretKey: ALICE, lock, required: 10_000n, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
  });

  it('never exposes the locked amount anywhere in public state', () => {
    const dump = JSON.stringify(
      {
        attestor: Array.from(sim.public.attestor),
        fills: sim.public.fills.toString(),
        spent: [...sim.public.spent].map((n) => Array.from(n)),
        root: Array.from(sim.public.attestations.root().field ?? []),
      },
    );
    expect(dump).not.toContain('50000');
    expect(dump).not.toContain(lock.amount.toString());
  });

  it('never exposes the private lock id', () => {
    const spent = [...sim.public.spent].map((n) => Buffer.from(n).toString('hex'));
    expect(spent).not.toContain(Buffer.from(lock.lockId).toString('hex'));
  });

  it('publishes a nullifier that is unlinkable to the registered leaf', () => {
    const leafHex = Buffer.from(leafFor(lock, BOB, EXPIRY)).toString('hex');
    const nulHex = Buffer.from(nullifierFor(lock)).toString('hex');
    expect(nulHex).not.toBe(leafHex);
    expect(sim.public.spent.member(nullifierFor(lock))).toBe(true);
  });

  it('reveals only an aggregate fill count, not per-proof amounts', () => {
    expect(sim.public.fills).toBe(1n);
  });
});
