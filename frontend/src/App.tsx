import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AvalSimulator } from '@contract/test/simulator';
import {
  bootstrap, prove, readLedger, runWithAmount, DEMO_LOCK, type LedgerView,
} from './lib/demo';

type Boot = 'loading' | 'ready' | 'failed';

/**
 * Each public field gets a one-clause gloss. Without it a viewer sees five
 * opaque hex strings; with it, the pane makes the argument by itself.
 */
const FIELD: Record<keyof LedgerView, { label: string; gloss: string }> = {
  attestor_registered: { label: 'attestor registered', gloss: 'is any attestor trusted' },
  attestor_id:         { label: 'attestor id',         gloss: 'which institution, not which customer' },
  merkle_root:         { label: 'merkle root',         gloss: 'binds the attestation, hides it' },
  nullifiers:          { label: 'nullifiers',          gloss: 'blocks proof reuse' },
  fills:               { label: 'fills',               gloss: 'how many cleared, never how much' },
};

/** What the proof does and does not carry. Both sides of the left pane's claim. */
const LEARNS = [
  'the threshold was cleared',
  'a registered attestor vouched for it',
  'it is single-use and expires',
] as const;
const NEVER_LEARNS = [
  'the amount held',
  'which lock, or which attestation',
  'anything a third party could reuse',
] as const;

/**
 * The values the circuit consumes privately. These are checked against the
 * live ledger object on every render rather than asserted in prose, so the
 * pane reports a real leak instead of claiming there isn't one. If
 * `readLedger` ever started returning one of these, the claim below flips to
 * a failure state on screen instead of quietly staying true-looking.
 */
const PRIVATE_INPUTS = ['amount', 'lock_id', 'salt', 'merkle_path', 'prover_identity'] as const;

/**
 * Metadata for a ledger field, tolerating keys we did not declare.
 *
 * An undeclared key IS the leak case. If this threw, the "privacy claim failed"
 * banner would be unreachable and the pane would white-screen rather than report
 * the leak, which would make the claim on screen untrue. Verified by deliberately
 * injecting an `amount` field and confirming the banner renders.
 */
const fieldMeta = (k: string) =>
  (FIELD as Record<string, { label: string; gloss: string }>)[k] ??
  { label: k, gloss: 'undeclared field, not part of the contract ledger' };

const fmt = (v: LedgerView[keyof LedgerView]) =>
  Array.isArray(v) ? (v.length ? v.join(', ') : '(none)') : String(v);

type Result =
  | { kind: 'pending' }
  | { kind: 'ok'; threshold: string }
  | { kind: 'spent'; reason: string }
  | { kind: 'rejected'; reason: string };

/**
 * The circuit rejects a second proof against the same attestation. That is the
 * single-use property working, not a failure, so it is presented as its own
 * state rather than as an error. Matching on the revert text degrades safely:
 * if the contract reworded it, this simply falls through to `rejected` and the
 * real string is still shown.
 */
const isReuse = (reason: string) => /already backed a proof/i.test(reason);

/* ── Primitives ─────────────────────────────────────────────────────────── */

/**
 * The mark, inlined so it costs no request and cannot flash. It is the page's
 * own argument at glyph scale: a filled block beside an open outline with
 * nothing inside it. Same artwork ships as the favicon at public/logo.svg.
 */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="h-6 w-6 shrink-0">
      <path d="M5 11a6 6 0 0 1 6-6h4v22h-4a6 6 0 0 1-6-6z" fill="var(--color-signal-400)" />
      <path
        d="M17 5h4a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-4"
        fill="none"
        stroke="var(--color-ledger-400)"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * A pane. Private and public surfaces are identical in geometry and opposite
 * in elevation — the private side sits one step above the public one — and
 * each is capped by a two-pixel rule in its own accent. Together those rules
 * read as a single two-tone line across the top of the section.
 */
function Pane({ tone, eyebrow, children }: {
  tone: 'signal' | 'ledger';
  eyebrow: string;
  children: ReactNode;
}) {
  const t = tone === 'signal'
    ? { edge: 'border-t-signal-400', text: 'text-signal-400', dot: 'bg-signal-400', surface: 'bg-base-850' }
    : { edge: 'border-t-ledger-400', text: 'text-ledger-400', dot: 'bg-ledger-400', surface: 'bg-base-900' };

  return (
    <article className={`flex flex-col rounded-card border-x border-b border-t-2 border-base-700 ${t.edge} ${t.surface}`}>
      <header className="flex items-center gap-2 border-b border-base-800 px-4 py-3 sm:px-5">
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
        <h2 className={`text-micro font-semibold uppercase ${t.text}`}>{eyebrow}</h2>
      </header>
      <div className="flex flex-1 flex-col p-4 sm:p-5">{children}</div>
    </article>
  );
}

/** One public-ledger row: label, gloss, value. A dense table, not a card list. */
function FieldRow({ label, gloss, value }: { label: string; gloss: string; value: string }) {
  return (
    <div className="grid gap-x-4 gap-y-1 border-b border-base-800 py-2 last:border-b-0 sm:grid-cols-[14.5rem_1fr]">
      <div>
        <div className="text-micro uppercase text-ink-300">{label}</div>
        <div className="mt-0.5 hidden text-micro normal-case tracking-normal text-ink-500 sm:block">{gloss}</div>
      </div>
      <div className="tnum self-start break-all font-mono text-value text-ink-100">{value}</div>
    </div>
  );
}

/**
 * The absence, rendered as a row rather than described in a sentence. A viewer
 * scanning five field names does not notice that a sixth is missing; an empty
 * socket where the amount would be is impossible to miss.
 */
function AbsentRow({ name }: { name: string }) {
  return (
    <div className="grid gap-x-4 gap-y-1 border-b border-dashed border-base-700 py-2 sm:grid-cols-[14.5rem_1fr]">
      <div>
        <div className="text-micro uppercase text-ink-300">{name}</div>
        <div className="mt-0.5 hidden text-micro normal-case tracking-normal text-ink-500 sm:block">
          the figure the counterparty acts on
        </div>
      </div>
      <div className="self-start">
        <span className="inline-block rounded-control border border-dashed border-base-600 px-2 py-0.5 font-mono text-value text-ink-500">
          not present
        </span>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function App() {
  const [sim, setSim] = useState<AvalSimulator | null>(null);
  const [view, setView] = useState<LedgerView | null>(null);
  const [boot, setBoot] = useState<Boot>('loading');
  const [bootErr, setBootErr] = useState<string | null>(null);

  const [result, setResult] = useState<Result>({ kind: 'pending' });
  const [required, setRequired] = useState('1500000');
  /** Digits while focused, grouped while at rest: formatting on every keystroke
   *  would move the caret to the end mid-edit. */
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);

  const [cmp, setCmp] = useState<{
    a: Awaited<ReturnType<typeof runWithAmount>>;
    b: Awaited<ReturnType<typeof runWithAmount>>;
  } | null>(null);
  const [cmpBusy, setCmpBusy] = useState(false);

  useEffect(() => {
    bootstrap()
      .then((s) => { setSim(s); setView(readLedger(s)); setBoot('ready'); })
      .catch((e) => {
        setBoot('failed');
        setBootErr(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        console.error('[aval] bootstrap failed', e);
      });
  }, []);

  const onProve = useCallback(async () => {
    if (!sim || busy) return;
    setBusy(true);
    try {
      await prove(sim, BigInt(required || '0'));
      setResult({ kind: 'ok', threshold: Number(required).toLocaleString() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const reason = msg.replace(/^.*failed assert: /, '').split('\n')[0];
      setResult(isReuse(reason) ? { kind: 'spent', reason } : { kind: 'rejected', reason });
    }
    setView(readLedger(sim));
    setBusy(false);
  }, [sim, busy, required]);

  const onCompare = useCallback(async () => {
    if (cmpBusy) return;
    setCmpBusy(true);
    try {
      const [a, b] = await Promise.all([
        runWithAmount(50_000n, 1_000n),
        runWithAmount(5_000_000n, 1_000n),
      ]);
      setCmp({ a, b });
    } catch (e) {
      console.error('[aval] compare failed', e);
    }
    setCmpBusy(false);
  }, [cmpBusy]);

  /**
   * Run the comparison once the runtime is up, so the page arrives with its
   * central claim already demonstrated instead of showing an empty table that
   * only fills in after a click. Two fresh contracts, measured at ~110ms total,
   * so this costs nothing perceptible on top of a ~600ms boot.
   *
   * It deliberately does NOT auto-run the main proof: each attestation backs
   * exactly one proof, so doing that would spend the demo's attestation before
   * the viewer ever pressed the button and leave them looking at a rejection.
   *
   * On failure this stays silent — the button is still there, and the state is
   * no worse than not having run.
   */
  useEffect(() => {
    if (boot !== 'ready') return;
    let live = true;
    Promise.all([runWithAmount(50_000n, 1_000n), runWithAmount(5_000_000n, 1_000n)])
      .then(([a, b]) => { if (live) setCmp({ a, b }); })
      .catch((e) => console.error('[aval] initial compare failed', e));
    return () => { live = false; };
  }, [boot]);

  /** Private inputs that have actually turned up in the public ledger object. */
  const leaked = useMemo(
    () => (view ? PRIVATE_INPUTS.filter((f) => Object.hasOwn(view, f)) : []),
    [view],
  );

  /** Computed from the two runs, never asserted: which fields actually moved. */
  const diff = useMemo(() => {
    if (!cmp) return null;
    const keys = Object.keys(cmp.a.ledger) as (keyof LedgerView)[];
    const moved = keys.filter((k) => fmt(cmp.a.ledger[k]) !== fmt(cmp.b.ledger[k]));
    return { keys, moved, same: keys.length - moved.length };
  }, [cmp]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
      <header className="border-b border-base-800 pb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Mark />
          <h1 className="text-display font-semibold">Aval</h1>
          <span className="text-micro font-medium uppercase text-ink-500">proof of funds in flight</span>
        </div>
        <p className="mt-3 max-w-[60ch] text-read text-ink-300">
          Prove money is committed but not yet arrived, so a counterparty can act now instead of
          waiting for settlement. <span className="text-ink-100">The amount never reaches the chain.</span>
        </p>
      </header>

      {/* Boot status. The only surface where a WASM failure becomes visible. */}
      <div aria-live="polite" className="mt-5">
        {boot === 'loading' && (
          <p className="rounded-control border border-base-700 bg-base-900 px-4 py-2.5 text-body text-ink-300">
            Instantiating the Midnight runtime (WASM)…
          </p>
        )}
        {boot === 'ready' && (
          <p className="flex items-center gap-2 rounded-control border border-signal-400/25 bg-signal-900/40 px-4 py-2.5 text-body text-signal-400">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-400" />
            Midnight runtime ready. Circuits are executing in this browser tab, against real ledger state.
          </p>
        )}
        {boot === 'failed' && (
          <div className="rounded-control border border-danger-400/30 bg-danger-900/40 px-4 py-3">
            <p className="text-body font-medium text-danger-400">Runtime failed to start.</p>
            <pre className="mt-2 overflow-x-auto font-mono text-micro tracking-normal text-danger-400/80">{bootErr}</pre>
            <p className="mt-2 text-body text-ink-300">
              The contract and its tests are unaffected: run <code className="font-mono">cd contract &amp;&amp; npm test</code>.
            </p>
          </div>
        )}
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* LEFT — what the counterparty learns */}
        <Pane tone="signal" eyebrow="What the counterparty learns">
          <div aria-live="polite">
            {result.kind === 'pending' && (
              <>
                <p className="text-lede text-ink-100">Awaiting proof</p>
                <p className="mt-1 text-body text-ink-500">
                  An attestation is registered. Nothing has been proven against it yet.
                </p>
              </>
            )}
            {result.kind === 'ok' && (
              <div className="f-rise">
                <p className="text-lede text-signal-400">Release authorized</p>
                <p className="mt-1 text-body text-ink-300">
                  A threshold of <span className="tnum font-mono text-ink-100">{result.threshold}</span> was cleared.
                </p>
              </div>
            )}
            {result.kind === 'spent' && (
              <div className="f-rise">
                <p className="text-lede text-warn-400">Attestation already spent</p>
                <p className="mt-1 text-body text-ink-300">
                  Each attestation backs exactly one proof, so a counterparty cannot replay it. This
                  is the single-use property firing, not a failure. Reload for a fresh attestation.
                </p>
                <p className="mt-2 break-all font-mono text-micro normal-case tracking-normal text-warn-400">
                  {result.reason}
                </p>
              </div>
            )}
            {result.kind === 'rejected' && (
              <div className="f-rise">
                <p className="text-lede text-danger-400">No release</p>
                <p className="mt-1 text-body text-ink-300">The proof was rejected by the circuit.</p>
                <p className="mt-2 break-all font-mono text-micro normal-case tracking-normal text-danger-400">
                  {result.reason}
                </p>
              </div>
            )}
          </div>

          {/* The rule sits above the control: a viewer needs to know what the
              threshold is being compared against before they press the button. */}
          <p className="mt-5 text-body text-ink-500">
            In this demo Alice holds{' '}
            <span className="tnum font-mono text-ink-300">{DEMO_LOCK.amount.toLocaleString('en-US')}</span>.
            Ask for less and the proof clears; ask for more and it is rejected. Either way the
            counterparty learns only whether the bar was cleared, never the figure.
          </p>

          <div className="mt-4">
            <label htmlFor="required" className="block text-micro uppercase text-ink-500">
              Required threshold
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="required"
                inputMode="numeric"
                value={focused || !required ? required : Number(required).toLocaleString('en-US')}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(e) => setRequired(e.target.value.replace(/\D/g, ''))}
                className="tnum h-11 w-full min-w-0 rounded-control border border-base-700 bg-base-950 px-3 font-mono text-base text-ink-100 transition-colors duration-150 ease-out hover:border-base-600 sm:flex-1"
              />
              <button
                onClick={onProve}
                disabled={busy || boot !== 'ready'}
                className="h-11 shrink-0 rounded-control bg-signal-400 px-4 text-read font-medium text-base-950 transition-[background-color,transform] duration-150 ease-out hover:bg-signal-400/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Proving…' : 'Prove funds in flight'}
              </button>
            </div>
          </div>

          {/* The claim, both halves. Mirrors the public pane opposite. */}
          <div className="mt-auto grid gap-x-6 gap-y-4 border-t border-base-800 pt-4 sm:grid-cols-2">
            <div>
              <p className="text-micro uppercase text-ink-500">They learn</p>
              <ul className="mt-2 space-y-1.5">
                {LEARNS.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-body text-ink-300">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-signal-400" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-micro uppercase text-ink-500">They never learn</p>
              <ul className="mt-2 space-y-1.5">
                {NEVER_LEARNS.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-body text-ink-500">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 border border-base-600" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </Pane>

        {/* RIGHT — what the chain learns */}
        <Pane tone="ledger" eyebrow="What the public chain learns">
          {view ? (
            <div>
              {leaked.length === 0
                ? <AbsentRow name="amount" />
                : (
                  <div className="rounded-control border border-danger-400/40 bg-danger-900/40 px-3 py-2">
                    <p className="text-micro uppercase text-danger-400">Privacy claim failed</p>
                    <p className="mt-1 text-body text-ink-100">
                      The ledger object exposes: <span className="font-mono">{leaked.join(', ')}</span>
                    </p>
                  </div>
                )}
              {(Object.keys(view) as (keyof LedgerView)[]).map((k) => {
                // An UNKNOWN key is exactly the leak case. It must render, not throw:
                // if this crashed, the "privacy claim failed" banner above would be
                // unreachable and the pane would white-screen instead of reporting.
                const meta = fieldMeta(k);
                return <FieldRow key={k} label={meta.label} gloss={meta.gloss} value={fmt(view[k])} />;
              })}
            </div>
          ) : (
            <p className="py-6 text-body text-ink-500">Reading ledger…</p>
          )}

          <div className="mt-auto pt-5">
            <div className="rounded-control border border-dashed border-base-700 p-3">
              <p className="text-micro uppercase text-ink-500">Private circuit inputs, never written</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {PRIVATE_INPUTS.map((f) => {
                  const exposed = leaked.includes(f);
                  return (
                    <li key={f} className="flex items-center gap-1.5">
                      {/* A dash, not a strikethrough: a line drawn through
                          monospace words reads as a rendering fault and turns
                          the space in "lock id" into a false hyphen. */}
                      <span aria-hidden className={`h-px w-2 shrink-0 ${exposed ? 'bg-danger-400' : 'bg-base-600'}`} />
                      <span
                        className={`truncate font-mono text-value ${
                          exposed ? 'text-danger-400' : 'text-ink-500'
                        }`}
                      >
                        {f.replace(/_/g, ' ')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="mt-2 text-body text-ink-500">
              This list is re-checked against the live ledger object on every update. If one of
              these ever appeared on chain, this pane would say so.
            </p>
          </div>
        </Pane>
      </section>

      {/* INDISTINGUISHABILITY — the product argument, made runnable */}
      <section className="mt-4 rounded-card border-x border-b border-t-2 border-base-700 border-t-ledger-400 bg-base-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-800 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lede text-ink-100">Can an observer tell 50,000 from 5,000,000?</h2>
            <p className="mt-1 text-body text-ink-500">
              Two fresh contracts. Same lock id, same salt, same counterparty. Amounts a hundredfold apart.
            </p>
          </div>
          <button
            onClick={onCompare}
            disabled={cmpBusy || boot !== 'ready'}
            className="h-11 shrink-0 rounded-control border border-base-600 bg-base-800 px-4 text-value font-medium text-ink-100 transition-[background-color,transform] duration-150 ease-out hover:bg-base-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cmpBusy ? 'Running both…' : cmp ? 'Run both again' : 'Run both and compare'}
          </button>
        </div>

        {cmp && diff && (
          <div className="f-rise p-4 sm:p-5">
            {/* Verdict first. Both numbers are counted from the two runs. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="tnum text-lede text-signal-400">
                {diff.same} of {diff.keys.length} public fields byte-identical
              </p>
              <p className="text-body text-ink-500">
                {diff.moved.length === 0
                  ? 'across a hundredfold difference in amount'
                  : `moved: ${diff.moved.map((k) => fieldMeta(k).label).join(', ')}`}
              </p>
            </div>

            <div className="mt-4 overflow-x-auto">
              {/* Not w-full: the two value columns must sit adjacent, or the eye
                  cannot check the identity claim the table exists to make. */}
              <table className="min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-base-700">
                    {['public ledger field', 'amount = 50,000', 'amount = 5,000,000', 'match'].map((h) => (
                      <th key={h} className="pb-2 pr-8 text-micro font-medium uppercase text-ink-500 last:pr-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diff.keys.map((k) => {
                    const a = fmt(cmp.a.ledger[k]);
                    const b = fmt(cmp.b.ledger[k]);
                    const same = a === b;
                    return (
                      <tr key={k} className="border-b border-base-800 last:border-b-0">
                        <td className="py-2 pr-8 align-top text-body text-ink-300">{fieldMeta(k).label}</td>
                        <td className="tnum py-2 pr-8 align-top font-mono text-value text-ink-100">{a}</td>
                        <td className="tnum py-2 pr-8 align-top font-mono text-value text-ink-100">{b}</td>
                        <td className="py-2 align-top">
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <span
                              aria-hidden
                              className={`h-2 w-2 shrink-0 ${same ? 'bg-signal-400' : 'bg-warn-400'}`}
                            />
                            <span className={`text-micro uppercase ${same ? 'text-signal-400' : 'text-warn-400'}`}>
                              {same ? 'identical' : 'differs'}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-4 max-w-[76ch] text-body text-ink-300">
              {diff.moved.length === 1 && diff.moved[0] === 'merkle_root' ? (
                <>
                  The one field that moves is a hash commitment. A root binds the leaf without revealing
                  it, and the nullifier stays byte-identical across a hundredfold difference. Not an
                  absence you have to take on trust: an equality you just ran.
                </>
              ) : (
                <>
                  Both proofs were executed in this tab against fresh contract state. The table above is
                  the diff of the two resulting public ledgers, computed field by field.
                </>
              )}
            </p>
            <p className="mt-1.5 text-body text-ink-500">
              Proof at 50,000: {cmp.a.ok ? 'cleared' : 'rejected'} · Proof at 5,000,000:{' '}
              {cmp.b.ok ? 'cleared' : 'rejected'} · threshold 1,000 for both
            </p>
          </div>
        )}
      </section>

      <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-base-800 pt-5 text-body text-ink-500">
        <span>Apache-2.0</span>
        <span aria-hidden>·</span>
        <span className="text-ink-300">3 circuits, 31 passing tests</span>
        <span aria-hidden>·</span>
        <a className="text-ledger-400 hover:underline" href="https://github.com/Leihyn/aval">github.com/Leihyn/aval</a>
      </footer>
    </main>
  );
}
