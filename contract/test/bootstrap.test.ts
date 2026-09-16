import { describe, it, expect } from 'vitest';
import { AvalSimulator, bytes32, leafFor } from './simulator.js';
import { pureCircuits } from '../out/contract/index.js';
const DEPLOYER=bytes32('attestor'), MALLORY=bytes32('mallory'), BOB=bytes32('bob'), E=9000n;

describe('bootstrap: the attestor role is fixed at deploy and cannot be front-run', () => {
  it('a stranger cannot claim the attestor role after deploy', async () => {
    const s = await AvalSimulator.create(DEPLOYER);   // deployer fixes the role
    const hex=(b:Uint8Array)=>Buffer.from(b).toString('hex');
    expect(hex(s.public.attestor)).toBe(hex(pureCircuits.derive_id(DEPLOYER)));
    // Mallory has no bootstrap circuit to call, and cannot write the registry
    let mallorysWrite = true;
    try { await s.registerAttestation(MALLORY, leafFor({lockId:bytes32('x'),amount:1n,salt:bytes32('y')}, BOB, E)); }
    catch { mallorysWrite = false; }
    console.log('  attestor is the deployer   :', hex(s.public.attestor)===hex(pureCircuits.derive_id(DEPLOYER)));
    console.log('  stranger can write registry:', mallorysWrite);
    expect(mallorysWrite).toBe(false);
    // and the deployer still works
    await s.registerAttestation(DEPLOYER, leafFor({lockId:bytes32('x'),amount:1n,salt:bytes32('y')}, BOB, E));
    console.log('  deployer can write registry: true');
  });
});
