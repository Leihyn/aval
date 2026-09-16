// Aval contract simulator.
//
// Runs the compiled Compact circuits in-process against a real ledger state, with
// no proof server and no Docker. Block time is injected per call so expiry can be
// tested deterministically.
import {
  createConstructorContext,
  createCircuitContext,
  dummyContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, pureCircuits, type Ledger, type Witnesses } from '../out/contract/index.js';

export type LockRecord = {
  lockId: Uint8Array;
  amount: bigint;
  salt: Uint8Array;
};

/** Private state: the caller's secret key plus whichever lock they are proving. */
export type AvalPrivateState = {
  secretKey: Uint8Array;
  lock: LockRecord | null;
};

export const bytes32 = (seed: number | string): Uint8Array => {
  const b = new Uint8Array(32);
  const s = String(seed);
  for (let i = 0; i < s.length && i < 32; i++) b[i] = s.charCodeAt(i);
  b[31] = typeof seed === 'number' ? seed & 0xff : s.length;
  return b;
};

const witnesses: Witnesses<AvalPrivateState> = {
  local_secret_key: (ctx) => [ctx.privateState, ctx.privateState.secretKey],
  get_lock_id: (ctx) => [ctx.privateState, ctx.privateState.lock!.lockId],
  get_amount: (ctx) => [ctx.privateState, ctx.privateState.lock!.amount],
  get_salt: (ctx) => [ctx.privateState, ctx.privateState.lock!.salt],
  // The path is looked up from the PUBLIC tree but supplied PRIVATELY, which is
  // what keeps the proof unlinkable to a specific registered leaf.
  find_path: (ctx, leaf) => {
    const path = ctx.ledger.attestations.findPathForLeaf(leaf);
    if (path === undefined) throw new Error('no merkle path: leaf is not registered');
    return [ctx.privateState, path];
  },
};

export class AvalSimulator {
  readonly contract: Contract<AvalPrivateState>;
  private ctx!: CircuitContext<AvalPrivateState>;
  private readonly address = dummyContractAddress();

  private constructor(secretKey: Uint8Array) {
    this.contract = new Contract<AvalPrivateState>(witnesses);
    void secretKey;
  }

  static async create(secretKey: Uint8Array): Promise<AvalSimulator> {
    const sim = new AvalSimulator(secretKey);
    // The attestor is fixed AT DEPLOY, from the deployer's own key. There is no
    // post-deploy bootstrap to front-run.
    const init = await sim.contract.initialState(
      createConstructorContext<AvalPrivateState>({ secretKey, lock: null }, '0'.repeat(64)),
      pureCircuits.derive_id(secretKey),
    );
    sim.ctx = createCircuitContext<AvalPrivateState>(
      'init',
      sim.address,
      '0'.repeat(64),
      init.currentContractState,
      init.currentPrivateState,
    );
    return sim;
  }

  /** Public ledger view. Anything readable here is readable by the whole world. */
  get public(): Ledger {
    return ledger(this.ctx.callContext.currentQueryContext.state);
  }

  private rebuild(circuitId: string, time: number, privateState: AvalPrivateState) {
    this.ctx = createCircuitContext<AvalPrivateState>(
      circuitId,
      this.address,
      '0'.repeat(64),
      this.ctx.callContext.currentQueryContext.state,
      privateState,
      undefined,
      undefined,
      undefined,
      time,
    );
  }

  /** Swap identity/lock without losing ledger state, models a different caller. */
  private async run<T>(
    circuitId: string,
    privateState: AvalPrivateState,
    time: number,
    call: () => Promise<{ context: CircuitContext<AvalPrivateState>; result: T }>,
  ): Promise<T> {
    this.rebuild(circuitId, time, privateState);
    const out = await call();
    this.ctx = out.context;
    return out.result;
  }

  async registerAttestation(secretKey: Uint8Array, leaf: Uint8Array, time = 1_000): Promise<void> {
    await this.run('register_attestation', { secretKey, lock: null }, time, () =>
      this.contract.impureCircuits.register_attestation(this.ctx, leaf) as any,
    );
  }

  async proveFundsInFlight(args: {
    secretKey: Uint8Array;
    lock: LockRecord;
    required: bigint;
    counterparty: Uint8Array;
    expiry: bigint;
    time?: number;
  }): Promise<void> {
    const { secretKey, lock, required, counterparty, expiry } = args;
    await this.run('prove_funds_in_flight', { secretKey, lock }, args.time ?? 1_000, () =>
      this.contract.impureCircuits.prove_funds_in_flight(this.ctx, required, counterparty, expiry) as any,
    );
  }
}

/** Same hash the circuit uses, exported by the compiler, not reimplemented. */
export const leafFor = (lock: LockRecord, counterparty: Uint8Array, expiry: bigint): Uint8Array =>
  pureCircuits.leaf_hash(lock.lockId, lock.amount, counterparty, expiry, lock.salt);

export const nullifierFor = (lock: LockRecord): Uint8Array =>
  pureCircuits.nullifier_of(lock.lockId, lock.salt);
