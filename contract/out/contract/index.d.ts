import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_lock_id(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_amount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  get_salt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  find_path(context: __compactRuntime.WitnessContext<Ledger, PS>,
            leaf_0: Uint8Array): [PS, { leaf: Uint8Array,
                                        path: { sibling: { field: bigint },
                                                goes_left: boolean
                                              }[]
                                      }];
}

export type ImpureCircuits<PS> = {
  register_attestor(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  register_attestation(context: __compactRuntime.CircuitContext<PS>,
                       leaf_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  prove_funds_in_flight(context: __compactRuntime.CircuitContext<PS>,
                        required_0: bigint,
                        counterparty_0: Uint8Array,
                        expiry_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type ProvableCircuits<PS> = {
  register_attestor(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  register_attestation(context: __compactRuntime.CircuitContext<PS>,
                       leaf_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  prove_funds_in_flight(context: __compactRuntime.CircuitContext<PS>,
                        required_0: bigint,
                        counterparty_0: Uint8Array,
                        expiry_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type PureCircuits = {
  derive_id(sk_0: Uint8Array): Uint8Array;
  leaf_hash(lock_id_0: Uint8Array,
            amount_0: bigint,
            counterparty_0: Uint8Array,
            expiry_0: bigint,
            salt_0: Uint8Array): Uint8Array;
  nullifier_of(lock_id_0: Uint8Array, salt_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  derive_id(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  leaf_hash(context: __compactRuntime.CircuitContext<PS>,
            lock_id_0: Uint8Array,
            amount_0: bigint,
            counterparty_0: Uint8Array,
            expiry_0: bigint,
            salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  nullifier_of(context: __compactRuntime.CircuitContext<PS>,
               lock_id_0: Uint8Array,
               salt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  register_attestor(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  register_attestation(context: __compactRuntime.CircuitContext<PS>,
                       leaf_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
  prove_funds_in_flight(context: __compactRuntime.CircuitContext<PS>,
                        required_0: bigint,
                        counterparty_0: Uint8Array,
                        expiry_0: bigint): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type Ledger = {
  attestations: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  spent: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly attestor: Uint8Array;
  readonly attestor_registered: boolean;
  readonly fills: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
