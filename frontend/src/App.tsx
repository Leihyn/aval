import { useEffect, useState } from 'react';
import type { AvalSimulator } from '@contract/test/simulator';
import { bootstrap, prove, readLedger, DEMO_LOCK, type LedgerView } from './lib/demo';

export default function App() {
  const [sim, setSim] = useState<AvalSimulator | null>(null);
  const [view, setView] = useState<LedgerView | null>(null);
  const [status, setStatus] = useState('Attestation registered. Awaiting proof.');
  const [ok, setOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [required, setRequired] = useState('1500000');
  const [busy, setBusy] = useState(false);
  const [boot, setBoot] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [bootErr, setBootErr] = useState<string | null>(null);

  useEffect(() => {
    bootstrap()
      .then((s) => { setSim(s); setView(readLedger(s)); setBoot('ready'); })
      .catch((e) => {
        // Surface the real reason rather than hanging on a spinner. The most
        // likely failure is WASM instantiation for the Midnight runtime.
        setBoot('failed');
        setBootErr(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        console.error('[aval] bootstrap failed', e);
      });
  }, []);

  const onProve = async () => {
    if (!sim || busy) return;
    setBusy(true); setError(null);
    try {
      await prove(sim, BigInt(required || '0'));
      setStatus(`Threshold ${Number(required).toLocaleString()} cleared. Release authorized.`);
      setOk(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^.*failed assert: /, ''));
      setStatus('Proof rejected. No release.');
      setOk(false);
    }
    setView(readLedger(sim));
    setBusy(false);
  };

  return (
    <main className="min-h-screen px-4 py-10 md:px-10">
      <header className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold tracking-tight">Aval</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Prove money is committed but not yet arrived, so a counterparty can act now
          instead of waiting for settlement. The amount never reaches the chain.
        </p>
      </header>

      <div className="mx-auto mt-6 max-w-5xl">
        {boot === 'loading' && (
          <p className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-neutral-400">
            Instantiating the Midnight runtime (WASM)…
          </p>
        )}
        {boot === 'ready' && (
          <p className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
            Midnight runtime ready. Circuits are executing in this browser tab, against real ledger state.
          </p>
        )}
        {boot === 'failed' && (
          <div className="rounded-lg border border-rose-900 bg-rose-950/30 px-4 py-3">
            <p className="text-sm font-medium text-rose-300">Runtime failed to start.</p>
            <pre className="mt-2 overflow-x-auto text-xs text-rose-400">{bootErr}</pre>
            <p className="mt-2 text-xs text-neutral-400">
              The contract and its 22 tests are unaffected: run <code>cd contract &amp;&amp; npm test</code>.
            </p>
          </div>
        )}
      </div>

      <section className="mx-auto mt-6 grid max-w-5xl gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            What the counterparty learns
          </h2>
          <p className={`mt-4 text-lg leading-snug ${ok === false ? 'text-rose-300' : ''}`}>{status}</p>
          {error && <p className="mt-2 font-mono text-xs text-rose-400">{error}</p>}

          <label htmlFor="req" className="mt-6 block text-xs uppercase tracking-widest text-neutral-500">
            Required threshold
          </label>
          <input
            id="req"
            inputMode="numeric"
            value={required}
            onChange={(e) => setRequired(e.target.value.replace(/\D/g, ''))}
            className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 font-mono text-sm"
          />
          <button
            onClick={onProve}
            disabled={busy || !sim}
            className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black transition hover:bg-emerald-400 disabled:opacity-40"
          >
            {busy ? 'Proving…' : 'Prove funds in flight'}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            Alice actually holds {DEMO_LOCK.amount.toLocaleString()}. Raise the threshold
            above that and the proof is rejected. That rejection is the point: the
            counterparty learns only whether the bar was cleared, never the figure.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            What the public ledger knows
          </h2>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black p-4 text-xs leading-relaxed">
{view ? JSON.stringify(view, null, 2) : 'loading…'}
          </pre>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            No amount. No lock id. No identity. A root, a nullifier, a counter.
          </p>
        </div>
      </section>
    </main>
  );
}
