import { useCallback, useEffect, useState } from 'react';
import type { AvalSimulator } from '@contract/test/simulator';
import {
  bootstrap, prove, readLedger, runWithAmount, DEMO_LOCK, type LedgerView,
} from './lib/demo';

type Boot = 'loading' | 'ready' | 'failed';

const FIELD_LABEL: Record<keyof LedgerView, string> = {
  attestor_registered: 'attestor registered',
  attestor_id: 'attestor id',
  merkle_root: 'merkle root',
  nullifiers: 'nullifiers',
  fills: 'fills',
};

const fmt = (v: LedgerView[keyof LedgerView]) =>
  Array.isArray(v) ? (v.length ? v.join(', ') : '(none)') : String(v);

/** One label/value row. Monospace values, tabular figures, wraps on narrow screens. */
function Row({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'ledger' }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-base-800 py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-40 shrink-0 text-[11px] uppercase tracking-[0.12em] text-ink-500">{label}</span>
      <span className={`tnum break-all font-mono text-[13px] ${tone === 'ledger' ? 'text-ledger-400' : 'text-ink-100'}`}>
        {value}
      </span>
    </div>
  );
}

/** The absent fields, stated positively so the omission is visible rather than inferred. */
function NeverWritten() {
  return (
    <div className="mt-4 rounded-[--radius-control] border border-dashed border-base-700 bg-base-950/60 p-3">
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Supplied privately, never written</p>
      <ul className="mt-2 space-y-1 font-mono text-[13px] text-ink-500">
        {['amount', 'lock_id', 'salt', 'merkle path', 'prover identity'].map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span aria-hidden className="h-px w-3 bg-base-600" />
            <span className="line-through decoration-base-600">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [sim, setSim] = useState<AvalSimulator | null>(null);
  const [view, setView] = useState<LedgerView | null>(null);
  const [boot, setBoot] = useState<Boot>('loading');
  const [bootErr, setBootErr] = useState<string | null>(null);

  const [status, setStatus] = useState('Attestation registered. Awaiting proof.');
  const [ok, setOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [required, setRequired] = useState('1500000');
  const [busy, setBusy] = useState(false);

  const [cmp, setCmp] = useState<{ a: LedgerView; b: LedgerView } | null>(null);
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
    setBusy(true); setError(null);
    try {
      await prove(sim, BigInt(required || '0'));
      setStatus(`Threshold ${Number(required).toLocaleString()} cleared. Release authorized.`);
      setOk(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^.*failed assert: /, '').split('\n')[0]);
      setStatus('Proof rejected. No release.');
      setOk(false);
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
      setCmp({ a: a.ledger, b: b.ledger });
    } catch (e) {
      console.error('[aval] compare failed', e);
    }
    setCmpBusy(false);
  }, [cmpBusy]);

  const keys = (cmp ? (Object.keys(cmp.a) as (keyof LedgerView)[]) : []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-10">
      <header>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Aval</h1>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
            proof of funds in flight
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-300">
          Prove money is committed but not yet arrived, so a counterparty can act now instead of
          waiting for settlement. The amount never reaches the chain.
        </p>
      </header>

      {/* Boot status. The only surface where a WASM failure becomes visible. */}
      <div aria-live="polite" className="mt-6">
        {boot === 'loading' && (
          <p className="rounded-[--radius-control] border border-base-700 bg-base-900 px-4 py-3 text-[13px] text-ink-300">
            Instantiating the Midnight runtime (WASM)…
          </p>
        )}
        {boot === 'ready' && (
          <p className="rounded-[--radius-control] border border-signal-400/25 bg-signal-900/40 px-4 py-3 text-[13px] text-signal-400">
            Midnight runtime ready. Circuits are executing in this browser tab, against real ledger state.
          </p>
        )}
        {boot === 'failed' && (
          <div className="rounded-[--radius-control] border border-danger-400/30 bg-danger-900/40 px-4 py-3">
            <p className="text-[13px] font-medium text-danger-400">Runtime failed to start.</p>
            <pre className="mt-2 overflow-x-auto font-mono text-[12px] text-danger-400/80">{bootErr}</pre>
            <p className="mt-2 text-[12px] text-ink-300">
              The contract and its 23 tests are unaffected: run <code className="font-mono">cd contract &amp;&amp; npm test</code>.
            </p>
          </div>
        )}
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* LEFT — what the counterparty learns */}
        <article className="rounded-[--radius-card] border border-signal-400/20 bg-base-900 p-5">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-signal-400">
              What the counterparty learns
            </h2>
          </div>

          <p className={`mt-4 text-lg leading-snug ${ok === false ? 'text-danger-400' : 'text-ink-100'}`}>
            {status}
          </p>
          {error && <p className="mt-2 font-mono text-[12px] text-danger-400">{error}</p>}

          <label htmlFor="required" className="mt-6 block text-[11px] uppercase tracking-[0.12em] text-ink-500">
            Required threshold
          </label>
          <input
            id="required"
            inputMode="numeric"
            value={required}
            onChange={(e) => setRequired(e.target.value.replace(/\D/g, ''))}
            className="tnum mt-2 h-11 w-full rounded-[--radius-control] border border-base-700 bg-base-950 px-3 font-mono text-base text-ink-100 transition-colors duration-150 ease-out hover:border-base-600"
          />
          <button
            onClick={onProve}
            disabled={busy || boot !== 'ready'}
            className="mt-3 h-11 w-full rounded-[--radius-control] bg-signal-400 px-4 text-[15px] font-medium text-base-950 transition-[background-color,transform] duration-150 ease-out hover:bg-signal-400/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Proving…' : 'Prove funds in flight'}
          </button>

          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            Alice actually holds{' '}
            <span className="tnum font-mono text-ink-300">{DEMO_LOCK.amount.toLocaleString()}</span>.
            Raise the threshold above that and the proof is rejected. That rejection is the point:
            the counterparty learns whether the bar was cleared, never the figure.
          </p>
        </article>

        {/* RIGHT — what the chain learns */}
        <article className="rounded-[--radius-card] border border-ledger-400/20 bg-base-900 p-5">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ledger-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ledger-400">
              What the public chain learns
            </h2>
          </div>

          <div className="mt-3">
            {view
              ? (Object.keys(view) as (keyof LedgerView)[]).map((k) => (
                  <Row key={k} label={FIELD_LABEL[k]} value={fmt(view[k])} tone="ledger" />
                ))
              : <p className="py-6 text-[13px] text-ink-500">Reading ledger…</p>}
          </div>

          <NeverWritten />
        </article>
      </section>

      {/* INDISTINGUISHABILITY — the product argument, made runnable */}
      <section className="mt-4 rounded-[--radius-card] border border-base-700 bg-base-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
              Can an observer tell 50,000 from 5,000,000?
            </h2>
            <p className="mt-1 text-[13px] text-ink-500">
              Two fresh contracts. Same lock id, same salt, same counterparty. Amounts a hundredfold apart.
            </p>
          </div>
          <button
            onClick={onCompare}
            disabled={cmpBusy || boot !== 'ready'}
            className="h-11 shrink-0 rounded-[--radius-control] border border-base-600 bg-base-800 px-4 text-[14px] font-medium text-ink-100 transition-[background-color,transform] duration-150 ease-out hover:bg-base-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cmpBusy ? 'Running both…' : cmp ? 'Run again' : 'Run both and compare'}
          </button>
        </div>

        {cmp && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-base-700">
                  {['public ledger field', 'amount = 50,000', 'amount = 5,000,000', ''].map((h) => (
                    <th key={h} className="pb-2 pr-4 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const a = fmt(cmp.a[k]); const b = fmt(cmp.b[k]);
                  const same = a === b;
                  return (
                    <tr key={k} className="border-b border-base-800 last:border-b-0">
                      <td className="py-2 pr-4 text-[13px] text-ink-300">{FIELD_LABEL[k]}</td>
                      <td className="tnum py-2 pr-4 font-mono text-[12px] text-ink-100">{a}</td>
                      <td className="tnum py-2 pr-4 font-mono text-[12px] text-ink-100">{b}</td>
                      <td className={`py-2 font-mono text-[12px] ${same ? 'text-signal-400' : 'text-warn-400'}`}>
                        {same ? 'IDENTICAL' : 'DIFFERS'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-4 text-[13px] leading-relaxed text-ink-300">
              <span className="text-signal-400">Every readable field is identical except the merkle root.</span>{' '}
              A root is a hash: it commits to the leaf without revealing it. The nullifier is byte-identical
              across a hundredfold difference. Not an absence you have to trust, an equality you can run.
            </p>
          </div>
        )}
      </section>

      <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-500">
        <span>Apache-2.0</span>
        <span aria-hidden>·</span>
        <span>3 circuits, 23 passing tests</span>
        <span aria-hidden>·</span>
        <a className="text-ledger-400 hover:underline" href="https://github.com/Leihyn/aval">github.com/Leihyn/aval</a>
      </footer>
    </main>
  );
}
