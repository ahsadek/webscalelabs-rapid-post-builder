import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className={"toast" + (msg ? " show" : "")} role="status" aria-live="polite">
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- clipboard ---------- */
export async function copyText(txt: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

/* ---------- prompt output block ---------- */
export function OutBlock({ text, label }: { text: string; label: string }) {
  const toast = useToast();
  return (
    <div className="out">
      <div className="bar">
        <span>{label}</span>
        <button
          className="btn"
          onClick={() => copyText(text).then(() => toast("Copied"))}
        >
          Copy prompt
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  );
}

/* ---------- small helpers ---------- */
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
