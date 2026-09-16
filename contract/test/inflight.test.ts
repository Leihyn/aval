import { describe, it, expect, beforeEach } from 'vitest';
import { AvalSimulator, bytes32, leafFor, nullifierFor, type LockRecord } from './simulator.js';
import { pureCircuits } from '../out/contract/index.js';

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
const freshWithAttestor = async () => await AvalSimulator.create(ATTESTOR);

/** Attestor observes a source-chain lock and registers its commitment. */
const attest = async (s: AvalSimulator, lock: LockRecord, counterparty = BOB, expiry = EXPIRY) => {
  await s.registerAttestation(ATTESTOR, leafFor(lock, counterparty, expiry));
};

describe('attestor registration', () => {
  beforeEach(async () => {
    sim = await AvalSimulator.create(ATTESTOR);
  });

  it('starts with the deploy-time attestor and an otherwise empty ledger', () => {
    expect(sim.public.attestor_registered).toBe(true);
    expect(sim.public.fills).toBe(0n);
    expect(sim.public.spent.isEmpty()).toBe(true);
  });

  it('fixes the attestor at deploy, leaving no bootstrap to front-run', async () => {
    // The attestor is set by the constructor from the deployer's own key. There is
    // no post-deploy bootstrap circuit, so a stranger cannot claim the role and
    // brick the deployment, which an earlier permissionless version allowed.
    expect(sim.public.attestor_registered).toBe(true);
    expect(Buffer.from(sim.public.attestor).toString('hex'))
      .toBe(Buffer.from(pureCircuits.derive_id(ATTESTOR)).toString('hex'));
  });

  it('never writes the attestor secret key to the public ledger', async () => {
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

describe('privacy, indistinguishability of the amount', () => {
  const lock = lockOf('lock-1', 50_000n);

  /**
   * Serialise EVERY reachable field of public ledger state.
   *
   * Deliberately not a hand-picked projection: an earlier version of this suite
   * asserted the amount was absent from a 4-field object that never had an amount
   * field, so it could not fail. Enumerating the whole surface means a future field
   * that did leak the amount would be caught here rather than silently pass.
   */
  const dumpPublic = (s: AvalSimulator) => ({
    attestor: Buffer.from(s.public.attestor).toString('hex'),
    attestor_registered: s.public.attestor_registered,
    fills: s.public.fills.toString(),
    spent: [...s.public.spent].map((n) => Buffer.from(n).toString('hex')).sort(),
    spent_size: s.public.spent.size().toString(),
    merkle_root: String(s.public.attestations.root().field),
    tree_first_free: s.public.attestations.firstFree().toString(),
  });

  /** Fresh contract, one attested lock of `amount`, one successful proof. */
  const runWithAmount = async (amount: bigint, required = 1_000n) => {
    const s = await AvalSimulator.create(ATTESTOR);
    const l = { lockId: bytes32('lock-1'), amount, salt: bytes32('salt-lock-1') };
    await s.registerAttestation(ATTESTOR, leafFor(l, BOB, EXPIRY), Number(NOW));
    await s.proveFundsInFlight({
      secretKey: ALICE, lock: l, required, counterparty: BOB, expiry: EXPIRY, time: Number(NOW),
    });
    return dumpPublic(s);
  };

  it('produces IDENTICAL public state for amounts 100x apart, except the merkle root', async () => {
    const small = await runWithAmount(50_000n);
    const large = await runWithAmount(5_000_000n);

    // The striking one: the nullifier is byte-identical across a 100x difference,
    // because nullifier_of hashes lock_id and salt only. An observer watching the
    // nullifier set cannot tell the two worlds apart.
    expect(large.spent).toEqual(small.spent);
    expect(large.attestor).toBe(small.attestor);
    expect(large.attestor_registered).toBe(small.attestor_registered);
    expect(large.fills).toBe(small.fills);
    expect(large.spent_size).toBe(small.spent_size);
    expect(large.tree_first_free).toBe(small.tree_first_free);

    // Only the root differs, and a root is a hash: it commits to the leaf without
    // revealing it. This is the single field an observer can distinguish, and it
    // tells them nothing about the amount.
    expect(large.merkle_root).not.toBe(small.merkle_root);

    // Everything except merkle_root must match, checked structurally rather than
    // field by field so a newly added leaking field fails this test.
    const strip = (d: Record<string, unknown>) => {
      const { merkle_root, ...rest } = d;
      return rest;
    };
    expect(strip(large)).toEqual(strip(small));
  });

  it('holds the indistinguishability across three decades of amount', async () => {
    const dumps = await Promise.all([1_000n, 100_000n, 10_000_000n].map((a) => runWithAmount(a)));
    const stripped = dumps.map(({ merkle_root, ...rest }) => rest);
    expect(stripped[1]).toEqual(stripped[0]);
    expect(stripped[2]).toEqual(stripped[0]);
    expect(new Set(dumps.map((d) => d.merkle_root)).size).toBe(3);
  });

  it('never writes the decimal amount into any public field', async () => {
    const d = await runWithAmount(123_456_789n);
    const flat = JSON.stringify(d);
    expect(flat).not.toContain('123456789');
    // and the hex encoding of the same value
    expect(flat).not.toContain((123_456_789).toString(16));
  });

  it('never exposes the private lock id or salt in public state', async () => {
    const d = await runWithAmount(50_000n);
    const flat = JSON.stringify(d);
    expect(flat).not.toContain(Buffer.from(bytes32('lock-1')).toString('hex'));
    expect(flat).not.toContain(Buffer.from(bytes32('salt-lock-1')).toString('hex'));
  });

  it('publishes a nullifier that is not the registered leaf', async () => {
    const leafHex = Buffer.from(leafFor(lock, BOB, EXPIRY)).toString('hex');
    const nulHex = Buffer.from(nullifierFor(lock)).toString('hex');
    expect(nulHex).not.toBe(leafHex);
  });
});
