"use client";

import { useEffect, useState } from "react";

interface Finding {
  severity: "critical" | "warn";
  title: string;
  detail: string;
}

interface MonitorRun {
  id: string;
  ran_at: string;
  findings_count: number;
  critical_count: number;
  findings: Finding[];
  duration_ms: number | null;
  error: string | null;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MonitorPage() {
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/monitor-runs")
      .then((r) => r.json())
      .then((d) => setRuns(d.runs || []))
      .finally(() => setLoading(false));
  }, []);

  const lastRun = runs[0];
  const stale =
    lastRun && Date.now() - new Date(lastRun.ran_at).getTime() > 36 * 60 * 60 * 1000;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Health Monitor</h1>
        <p className="text-sm text-zinc-400">
          Daily automated health checks. Runs at 8am Central.
        </p>
      </div>

      {/* Status banner */}
      {!loading && (
        <div
          className={`rounded-xl border p-5 mb-6 ${
            !lastRun
              ? "border-zinc-800 bg-zinc-900/50"
              : stale
              ? "border-yellow-700 bg-yellow-950/30"
              : lastRun.critical_count > 0
              ? "border-red-700 bg-red-950/30"
              : lastRun.findings_count > 0
              ? "border-yellow-700 bg-yellow-950/30"
              : "border-green-700 bg-green-950/30"
          }`}
        >
          {!lastRun ? (
            <p className="text-zinc-400">
              No runs yet. The monitor will run daily once deployed.
            </p>
          ) : stale ? (
            <>
              <p className="font-semibold text-yellow-300">
                ⚠️ Monitor may not be running
              </p>
              <p className="text-sm text-zinc-300 mt-1">
                Last run was {formatWhen(lastRun.ran_at)} — over 36 hours ago.
              </p>
            </>
          ) : lastRun.critical_count > 0 ? (
            <>
              <p className="font-semibold text-red-300">
                🚨 {lastRun.critical_count} critical finding(s) on last run
              </p>
              <p className="text-sm text-zinc-300 mt-1">
                {formatWhen(lastRun.ran_at)}
              </p>
            </>
          ) : lastRun.findings_count > 0 ? (
            <>
              <p className="font-semibold text-yellow-300">
                ⚠️ {lastRun.findings_count} finding(s) on last run
              </p>
              <p className="text-sm text-zinc-300 mt-1">
                {formatWhen(lastRun.ran_at)} — no critical issues
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-green-300">
                ✓ All clear
              </p>
              <p className="text-sm text-zinc-300 mt-1">
                Last run {formatWhen(lastRun.ran_at)} — no issues detected.
              </p>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 text-center py-12">Loading...</p>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-500">
          No monitor runs recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const expanded = expandedId === run.id;
            const ok = run.findings_count === 0 && !run.error;
            return (
              <div
                key={run.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : run.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/50 transition"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      run.error
                        ? "bg-zinc-500"
                        : run.critical_count > 0
                        ? "bg-red-500"
                        : run.findings_count > 0
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                  />
                  <span className="text-sm flex-1">{formatWhen(run.ran_at)}</span>
                  <span className="text-xs text-zinc-500">
                    {run.duration_ms ? `${run.duration_ms}ms` : ""}
                  </span>
                  <span className="text-sm font-medium">
                    {run.error
                      ? "Error"
                      : ok
                      ? "OK"
                      : `${run.findings_count} finding${run.findings_count === 1 ? "" : "s"}`}
                  </span>
                  {(run.findings_count > 0 || run.error) && (
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  )}
                </button>

                {expanded && (run.findings_count > 0 || run.error) && (
                  <div className="border-t border-zinc-800 px-4 py-3 space-y-3">
                    {run.error && (
                      <div className="rounded-lg border-l-4 border-zinc-500 bg-zinc-800/50 px-3 py-2">
                        <p className="text-xs font-semibold uppercase text-zinc-400">
                          Error
                        </p>
                        <pre className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap">
                          {run.error}
                        </pre>
                      </div>
                    )}
                    {run.findings.map((f, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border-l-4 px-3 py-2 ${
                          f.severity === "critical"
                            ? "border-red-500 bg-red-950/30"
                            : "border-yellow-500 bg-yellow-950/30"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase ${
                            f.severity === "critical"
                              ? "text-red-400"
                              : "text-yellow-400"
                          }`}
                        >
                          {f.severity}
                        </p>
                        <p className="text-sm font-medium text-white mt-0.5">
                          {f.title}
                        </p>
                        <pre className="text-xs text-zinc-400 mt-2 whitespace-pre-wrap">
                          {f.detail}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
