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

  useEffect(() => {
    bootstrap()
      .then((s) => { setSim(s); setView(readLedger(s)); })
      .catch((e) => setError(String(e)));
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

      <section className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-2">
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
