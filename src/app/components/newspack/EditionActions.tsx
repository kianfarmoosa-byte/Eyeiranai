import { useEffect, useState } from "react";
import { Copy, FileText, Printer, Send, Check, Loader2, Link2 } from "lucide-react";
import { api, type NewsEdition, type ConnectionStatus, type PublishPlatform } from "../../api";
import { editionToPlainText, editionToMarkdown, editionToPublishText, printEdition } from "./editionFormat";

const PLATFORM_META: Record<string, { label: string; icon: string }> = {
  telegram: { label: "تلگرام", icon: "✈️" },
  bale: { label: "بله", icon: "🅱️" },
  rubika: { label: "روبیکا", icon: "🟣" },
  website: { label: "وب‌سایت", icon: "🌐" },
  twitter: { label: "توییتر/ایکس", icon: "🐦" },
  instagram: { label: "اینستاگرام", icon: "📸" },
};

// Small transient-feedback button.
function ActionBtn({ icon, label, onClick, tone = "default" }: { icon: React.ReactNode; label: string; onClick: () => void | Promise<void>; tone?: "default" | "primary" }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await onClick(); setDone(true); setTimeout(() => setDone(false), 1500); }
    finally { setBusy(false); }
  };
  const base = tone === "primary"
    ? "bg-emerald-600 text-white hover:bg-emerald-700"
    : "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800";
  return (
    <button onClick={run} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${base}`}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Check className="w-3.5 h-3.5" /> : icon}
      {label}
    </button>
  );
}

export function EditionActions({ edition, userId = "app" }: { edition: NewsEdition; userId?: string }) {
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [result, setResult] = useState<{ platform: string; ok: boolean; msg?: string } | null>(null);

  useEffect(() => { (async () => {
    try { setConnections(await api.studioGetConnections(userId)); }
    catch (e) { console.error("newspack: load connections failed:", e); }
  })(); }, [userId]);

  const connected = (Object.entries(connections) as [string, ConnectionStatus][])
    .filter(([, s]) => s?.connected)
    .map(([p]) => p as PublishPlatform);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch (e) { console.error("newspack: clipboard failed:", e); }
  };

  const publish = async (platform: PublishPlatform) => {
    setPublishing(platform);
    setResult(null);
    try {
      const text = editionToPublishText(edition);
      const res = await api.studioPublish(userId, { platform, text, title: edition.packTitle });
      setResult({ platform, ok: !!res.ok });
    } catch (e) {
      console.error("newspack: publish failed:", e);
      setResult({ platform, ok: false, msg: String(e) });
    } finally {
      setPublishing(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <ActionBtn icon={<Copy className="w-3.5 h-3.5" />} label="کپی متن" onClick={() => copy(editionToPlainText(edition))} />
        <ActionBtn icon={<FileText className="w-3.5 h-3.5" />} label="کپی Markdown" onClick={() => copy(editionToMarkdown(edition))} />
        <ActionBtn icon={<Printer className="w-3.5 h-3.5" />} label="چاپ / PDF" onClick={() => printEdition(edition)} />
        <ActionBtn icon={<Send className="w-3.5 h-3.5" />} label="انتشار" tone="primary" onClick={() => setShowPublish((v) => !v)} />
      </div>

      {showPublish && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2">
          {connected.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              هنوز هیچ پلتفرمی متصل نیست. از «استودیوی محتوا» یک کانال تلگرام/بله/روبیکا را متصل کنید.
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-500 dark:text-slate-400">انتشار این نسخه در:</div>
              <div className="flex flex-wrap gap-2">
                {connected.map((p) => (
                  <button
                    key={p}
                    onClick={() => publish(p)}
                    disabled={publishing !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs hover:border-emerald-400 disabled:opacity-60"
                  >
                    {publishing === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>{PLATFORM_META[p]?.icon || "📤"}</span>}
                    {PLATFORM_META[p]?.label || p}
                  </button>
                ))}
              </div>
            </>
          )}
          {result && (
            <div className={`text-xs ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {result.ok
                ? `✓ در ${PLATFORM_META[result.platform]?.label || result.platform} منتشر شد.`
                : `✗ انتشار در ${PLATFORM_META[result.platform]?.label || result.platform} ناموفق بود.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
