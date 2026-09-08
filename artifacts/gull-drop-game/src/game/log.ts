export type Fault = { t: number; level: "error" | "warn"; msg: string };

const faults: Fault[] = [];
const listeners = new Set<() => void>();

export function fault(level: Fault["level"], msg: string, extra?: unknown) {
  let detail = "";
  if (extra instanceof Error) detail = extra.message;
  else if (extra !== undefined) {
    try {
      detail = typeof extra === "string" ? extra : JSON.stringify(extra);
    } catch {
      detail = String(extra);
    }
  }
  const line = detail ? `${msg} — ${detail}` : msg;
  faults.push({ t: Date.now(), level, msg: line.slice(0, 280) });
  if (faults.length > 40) faults.shift();
  if (level === "error") console.error("[Gull Drop]", line, extra ?? "");
  else console.warn("[Gull Drop]", line, extra ?? "");
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function recentFaults(): Fault[] {
  return faults.slice(-8);
}

export function onFaults(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function installFaults() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __gullFaults?: boolean };
  if (w.__gullFaults) return;
  w.__gullFaults = true;
  window.addEventListener("error", (e) => {
    fault("error", e.message || "script error", e.error);
  });
  window.addEventListener("unhandledrejection", (e) => {
    fault("error", "unhandled promise", e.reason);
  });
}
