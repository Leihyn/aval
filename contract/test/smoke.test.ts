import { describe, it, expect } from 'vitest';
import { AvalSimulator, bytes32, leafFor } from './simulator.js';

describe('smoke', () => {
  it('registers an attestor and an attestation, then proves', async () => {
    const attestorKey = bytes32('attestor-key');
    const sim = await AvalSimulator.create(attestorKey);
    await sim.registerAttestor(attestorKey);
    expect(sim.public.attestor_registered).toBe(true);

    const lock = { lockId: bytes32('lock-1'), amount: 50_000n, salt: bytes32('salt-1') };
    const counterparty = bytes32('bob');
    const expiry = 9_000n;
    await sim.registerAttestation(attestorKey, leafFor(lock, counterparty, expiry));

    await sim.proveFundsInFlight({
      secretKey: bytes32('alice-key'), lock, required: 40_000n, counterparty, expiry, time: 1_000,
    });
    expect(sim.public.fills).toBe(1n);
  });
});
