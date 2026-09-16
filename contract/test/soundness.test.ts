import { describe, it, expect } from 'vitest';
import {
  createConstructorContext, createCircuitContext, dummyContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, pureCircuits, type Ledger, type Witnesses } from '../out/contract/index.js';

const b32 = (s: string) => { const b=new Uint8Array(32); for(let i=0;i<s.length&&i<32;i++) b[i]=s.charCodeAt(i); b[31]=s.length; return b; };

const ATTESTOR=b32('attestor'), ALICE=b32('alice'), BOB=b32('bob'), CAROL=b32('carol');
const EXPIRY=9_000n;

/** The HONEST lock the attestor actually registered: worth 1 unit, for BOB. */
const REAL = { lockId: b32('real-lock'), amount: 1n, salt: b32('real-salt') };

/** What the attacker WANTS to claim: astronomically more, to CAROL, far past expiry. */
const FORGED = { lockId: b32('forged'), amount: 18_446_744_073_709_551_615n, salt: b32('forged-salt') };

type PS = { secretKey: Uint8Array; lock: typeof REAL; evil: boolean };

const witnesses: Witnesses<PS> = {
  local_secret_key: (c) => [c.privateState, c.privateState.secretKey],
  get_lock_id: (c) => [c.privateState, c.privateState.lock.lockId],
  get_amount: (c) => [c.privateState, c.privateState.lock.amount],
  get_salt: (c) => [c.privateState, c.privateState.lock.salt],
  find_path: (c, requestedLeaf) => {
    // A witness runs on the PROVER'S machine. Nothing forces it to honour the
    // requested leaf. A malicious prover returns the path for a leaf that IS
    // registered, while the circuit believes it proved the forged one.
    const leafToUse = c.privateState.evil
      ? pureCircuits.leaf_hash(REAL.lockId, REAL.amount, BOB, EXPIRY, REAL.salt)
      : requestedLeaf;
    const p = c.ledger.attestations.findPathForLeaf(leafToUse);
    if (!p) throw new Error('no merkle path: leaf is not registered');
    return [c.privateState, p];
  },
};

class Sim {
  contract = new Contract<PS>(witnesses);
  ctx!: CircuitContext<PS>;
  addr = dummyContractAddress();
  static async make() {
    const s = new Sim();
    const init = await s.contract.initialState(createConstructorContext<PS>({ secretKey: ATTESTOR, lock: REAL, evil: false }, '0'.repeat(64)));
    s.ctx = createCircuitContext<PS>('i', s.addr, '0'.repeat(64), init.currentContractState, init.currentPrivateState);
    return s;
  }
  get pub(): Ledger { return ledger(this.ctx.callContext.currentQueryContext.state); }
  private re(id: string, ps: PS, t: number) {
    this.ctx = createCircuitContext<PS>(id, this.addr, '0'.repeat(64), this.ctx.callContext.currentQueryContext.state, ps, undefined, undefined, undefined, t);
  }
  async regAttestor() { this.re('register_attestor',{secretKey:ATTESTOR,lock:REAL,evil:false},1000); const r:any = await this.contract.impureCircuits.register_attestor(this.ctx); this.ctx=r.context; }
  async regAttestation(leaf: Uint8Array) { this.re('register_attestation',{secretKey:ATTESTOR,lock:REAL,evil:false},1000); const r:any = await this.contract.impureCircuits.register_attestation(this.ctx, leaf); this.ctx=r.context; }
  async prove(ps: PS, required: bigint, cp: Uint8Array, exp: bigint, t=1000) {
    this.re('prove_funds_in_flight', ps, t);
    const r:any = await this.contract.impureCircuits.prove_funds_in_flight(this.ctx, required, cp, exp);
    this.ctx = r.context;
  }
}

/**
 * Soundness regression test.
 *
 * `find_path` is a WITNESS: it runs on the prover's machine and is not verified.
 * An earlier version of the contract passed the recomputed leaf into it as a hint
 * and then never constrained the returned path against that leaf. Because
 * merkleTreePathRoot hashes `path.leaf`, a malicious prover could return the path
 * of some OTHER genuinely-registered leaf while the amount, counterparty and
 * expiry assertions ran against values the attestor never authorised.
 *
 * This test IS that attack. It must stay red against an unbound contract and
 * green against a bound one. Do not weaken it.
 */
describe('soundness: the merkle path must open the leaf the circuit recomputed', () => {
  it('rejects a forged proof that reuses a real attestation path for different terms', async () => {
    const s = await Sim.make();
    await s.regAttestor();
    // attestor registers ONLY the honest 1-unit lock, payable to BOB, expiring at 9000
    await s.regAttestation(pureCircuits.leaf_hash(REAL.lockId, REAL.amount, BOB, EXPIRY, REAL.salt));

    let accepted = false;
    try {
      await s.prove(
        { secretKey: ALICE, lock: FORGED, evil: true },
        10_000_000_000n,   // demand vastly more than the 1 unit actually locked
        CAROL,             // pay a counterparty the attestor never authorised
        50_000n,           // an expiry the attestor never authorised
        1000,
      );
      accepted = true;
    } catch { accepted = false; }

    const realNullifier = pureCircuits.nullifier_of(REAL.lockId, REAL.salt);
    // eslint-disable-next-line no-console
    console.log('  forged proof accepted        :', accepted);
    console.log('  fills after forgery          :', s.pub.fills.toString());
    console.log('  real lock nullifier spent?   :', s.pub.spent.member(realNullifier));

    expect(accepted, 'a forged proof MUST be rejected').toBe(false);
    expect(s.pub.fills, 'no fill may be recorded for a forged proof').toBe(0n);
    expect(s.pub.spent.member(realNullifier), 'the honest lock must remain unspent').toBe(false);
  });
});
