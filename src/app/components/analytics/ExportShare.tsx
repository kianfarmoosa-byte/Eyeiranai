import { useState } from "react";
import { Download, Printer, Link2, Check, FileSpreadsheet, FileText } from "lucide-react";
import type { Article } from "../../data";
import {
  coverageSeries, sourceBreakdown, topContent, computeKpis, type Period,
} from "../../mediaAnalytics";
import { scoreArticle, sentimentLabelFa } from "../../sentiment";
import { jalaali, toFa } from "../mobile/utils/fa";

// ── Section ۳.۱۲ — خروجی و اشتراک‌گذاری (Export & Share) ──
// خروجی اکسل (CSV با تاریخ شمسی)، چاپ/PDF مرورگر، و پیوند فقط‌خواندنی (کدگذاری
// دوره در URL). تولید PNG هر نمودار از طریق چاپ صفحه در دسترس است.

function downloadFile(name: string, content: string, mime: string) {
  // BOM so Excel opens UTF-8 (Persian) correctly.
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: (string | number)[][]): string {
  return rows.map(r => r.map(csvCell).join(",")).join("\n");
}

export function ExportShare({ articles, period, view }: { articles: Article[]; period: Period; view: string }) {
  const [copied, setCopied] = useState(false);

  const exportCsv = () => {
    const kpis = computeKpis(articles, period);
    const cov = coverageSeries(articles, period);
    const sources = sourceBreakdown(articles, period, Date.now(), 100);
    const top = topContent(articles, period, Date.now(), 50);

    const sections: (string | number)[][] = [];
    sections.push(["گزارش آنالیتیک رسانه‌ای"]);
    sections.push(["تاریخ تولید", jalaali(new Date(), { dateStyle: "full" })]);
    sections.push(["بازهٔ زمانی", `${toFa(period)} روز اخیر`]);
    sections.push([]);
    sections.push(["شاخص‌های کلیدی"]);
    sections.push(["حجم پوشش", kpis.volume.value]);
    sections.push(["منابع فعال", kpis.sources.value]);
    sections.push(["احساسات خالص (٪)", kpis.netSentiment.value]);
    sections.push(["میانگین روزانه", kpis.dailyAvg.value]);
    sections.push([]);
    sections.push(["روند پوشش روزانه"]);
    sections.push(["تاریخ", "تعداد مطلب"]);
    for (const d of cov) sections.push([jalaali(d.date, { dateStyle: "medium" }), d.count]);
    sections.push([]);
    sections.push(["تفکیک منابع"]);
    sections.push(["منبع", "کل", "مثبت", "منفی", "خنثی", "احساسات خالص (٪)"]);
    for (const s of sources) sections.push([s.name, s.total, s.pos, s.neg, s.neu, s.net]);
    sections.push([]);
    sections.push(["مطالب برتر"]);
    sections.push(["رتبه", "عنوان", "منبع", "تاریخ", "لحن", "امتیاز نفوذ"]);
    top.forEach((t, i) => {
      const s = scoreArticle(t.article);
      sections.push([i + 1, t.article.title, t.article.source, jalaali(t.article.dateMs || Date.now(), { dateStyle: "short" }), sentimentLabelFa(s.label), t.score]);
    });

    downloadFile(`media-analytics-${period}d.csv`, toCsv(sections), "text/csv;charset=utf-8");
  };

  const shareLink = async () => {
    const url = new URL(window.location.href);
    url.hash = `analytics=${view}:${period}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 print:hidden">
      <div className="flex items-center gap-2 mb-3">
        <Download className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm">خروجی و اشتراک‌گذاری</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
          <FileSpreadsheet className="w-4 h-4" /> دانلود اکسل (CSV)
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700">
          <Printer className="w-4 h-4" /> خروجی PDF / چاپ
        </button>
        <button onClick={shareLink} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700">
          {copied ? <><Check className="w-4 h-4 text-emerald-600" /> کپی شد</> : <><Link2 className="w-4 h-4" /> پیوند فقط‌خواندنی</>}
        </button>
      </div>
      <div className="flex items-start gap-1.5 text-[10px] text-slate-400 mt-3">
        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>فایل اکسل با تاریخ شمسی و کدگذاری UTF-8 تولید می‌شود. برای PNG هر نمودار، از «چاپ» و ذخیره به‌صورت PDF/تصویر استفاده کنید.</span>
      </div>
    </div>
  );
}
