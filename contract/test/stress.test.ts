import { describe, it, expect } from 'vitest';
import { AvalSimulator, bytes32, leafFor, type LockRecord } from './simulator.js';

const A = bytes32('attestor'), ALICE = bytes32('alice'), BOB = bytes32('bob');
const E = 9_000n;
const mk = (id: string, amt: bigint): LockRecord => ({ lockId: bytes32(id), amount: amt, salt: bytes32('s'+id) });

const ready = async () => await AvalSimulator.create(A);

describe('stress: boundary values', () => {
  it('handles amount = 0 against required = 0', async () => {
    const s = await ready(); const l = mk('zero', 0n);
    await s.registerAttestation(A, leafFor(l, BOB, E));
    await s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: 0n, counterparty: BOB, expiry: E, time: 1000 });
    expect(s.public.fills).toBe(1n);
  });

  it('rejects amount = 0 against required = 1', async () => {
    const s = await ready(); const l = mk('zero2', 0n);
    await s.registerAttestation(A, leafFor(l, BOB, E));
    await expect(s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: 1n, counterparty: BOB, expiry: E, time: 1000 }))
      .rejects.toThrow(/below required threshold/);
  });

  it('handles the maximum Uint<64> amount', async () => {
    const s = await ready(); const MAX = 18_446_744_073_709_551_615n; const l = mk('max', MAX);
    await s.registerAttestation(A, leafFor(l, BOB, E));
    await s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: MAX, counterparty: BOB, expiry: E, time: 1000 });
    expect(s.public.fills).toBe(1n);
  });

  it('rejects at the exact expiry boundary, accepts one tick before', async () => {
    const s = await ready(); const l = mk('edge', 100n);
    await s.registerAttestation(A, leafFor(l, BOB, E));
    await expect(s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: 1n, counterparty: BOB, expiry: E, time: Number(E) }))
      .rejects.toThrow(/expired/);
    await s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: 1n, counterparty: BOB, expiry: E, time: Number(E) - 1 });
    expect(s.public.fills).toBe(1n);
  });
});

describe('stress: state integrity under load', () => {
  it('keeps nullifiers distinct across 50 independent locks', async () => {
    const s = await ready();
    for (let i = 0; i < 50; i++) {
      const l = mk('bulk'+i, BigInt(i + 1));
      await s.registerAttestation(A, leafFor(l, BOB, E));
      await s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: 1n, counterparty: BOB, expiry: E, time: 1000 });
    }
    expect(s.public.fills).toBe(50n);
    expect(s.public.spent.size()).toBe(50n);
  }, 60000);

  it('a rejected proof leaves no trace in public state', async () => {
    const s = await ready(); const l = mk('trace', 5n);
    await s.registerAttestation(A, leafFor(l, BOB, E));
    const before = { fills: s.public.fills, spent: s.public.spent.size() };
    await expect(s.proveFundsInFlight({ secretKey: ALICE, lock: l, required: 999n, counterparty: BOB, expiry: E, time: 1000 }))
      .rejects.toThrow();
    expect(s.public.fills).toBe(before.fills);
    expect(s.public.spent.size()).toBe(before.spent);
  });
});
