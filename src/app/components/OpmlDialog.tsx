import { useRef, useState } from "react";
import { X, Upload, Download, Loader2 } from "lucide-react";
import { api } from "../api";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

type Props = { open: boolean; onClose: () => void; onDone: () => void };

export function OpmlDialog({ open, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleImport = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const xml = await file.text();
      const res = await api.importOpml(xml);
      setResult(`${res.added} خوراک جدید اضافه شد (مجموع: ${res.total})`);
      onDone();
    } catch (e) {
      setResult("خطا در واردسازی: " + e);
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a2e7e82a/opml`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const xml = await res.text();
      const blob = new Blob([xml], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.opml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setResult("خطا در خروجی: " + e);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3>واردسازی / خروجی OPML</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            واردسازی فایل OPML
          </button>
          <input ref={fileRef} type="file" accept=".opml,.xml,text/xml" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />

          <button onClick={handleExport} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg">
            <Download className="w-4 h-4" />
            دانلود خروجی OPML
          </button>

          {result && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">{result}</div>
          )}
          <div className="text-xs text-slate-500">
            OPML استاندارد باز برای مهاجرت میان RSS readerهاست.
          </div>
        </div>
      </div>
    </div>
  );
}
