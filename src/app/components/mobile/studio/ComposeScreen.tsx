import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Wand2, Check, FileText } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import { api } from "../../../api";
import type { Article } from "../../../data";
import type { BrandProfile, ContentTemplate, StudioPlatform, Draft } from "../../../api";
import { studioUserId, INPUT_CLS, PLATFORM_META, ALL_PLATFORMS, DEFAULT_BRAND } from "./studio";
import { toFa } from "../utils/fa";

type Props = {
  articles: Article[];
  onClose: () => void;
  onCreated: (draft: Draft) => void;
};

export function ComposeScreen({ articles, onClose, onCreated }: Props) {
  const haptic = useHaptics();
  const toast = useToast();
  const uid = studioUserId();

  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [tplId, setTplId] = useState<string>("");
  const [platforms, setPlatforms] = useState<StudioPlatform[]>(["telegram"]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, t] = await Promise.all([api.studioGetBrand(uid), api.studioGetTemplates(uid)]);
        if (cancelled) return;
        if (b) setBrand({ ...DEFAULT_BRAND, ...b });
        setTemplates(t);
      } catch (e) {
        console.log("compose load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const template = useMemo(() => templates.find((t) => t.id === tplId) || null, [templates, tplId]);

  // When a template is chosen, default platforms to its targets.
  useEffect(() => {
    if (template && template.platforms.length) setPlatforms(template.platforms);
  }, [tplId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = articles.slice(0, 200);
    if (!q) return pool.slice(0, 40);
    return pool.filter((a) => `${a.title} ${a.source}`.toLowerCase().includes(q)).slice(0, 40);
  }, [articles, query]);

  const selected = useMemo(() => articles.filter((a) => selectedIds.includes(a.id)), [articles, selectedIds]);
  const isDigest = selected.length >= 2;

  const toggleSource = (id: string) => {
    haptic("tap");
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const togglePlatform = (p: StudioPlatform) => {
    haptic("tap");
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  const generate = async () => {
    if (selected.length === 0 || platforms.length === 0) return;
    haptic("select");
    setGenerating(true);
    try {
      let outputs;
      let draftPayload;
      if (isDigest) {
        outputs = await api.studioComposeDigest({
          brand,
          template: template || {},
          sources: selected.map((s) => ({ title: s.title, content: s.content || s.preview || "", source: s.source, link: s.link })),
          platforms,
        });
        draftPayload = {
          title: `خلاصهٔ ${toFa(selected.length)} خبر`,
          sourceTitle: `خلاصهٔ ${toFa(selected.length)} خبر`,
          sourceLink: "",
          image: selected.find((s) => s.image)?.image || "",
          cardTheme: template?.cardTheme,
          cardRatio: template?.cardRatio,
          outputs,
          status: "draft" as const,
        };
      } else {
        const source = selected[0];
        outputs = await api.studioCompose({
          brand,
          template: template || {},
          source: { title: source.title, content: source.content || source.preview || "", source: source.source, link: source.link },
          platforms,
        });
        draftPayload = {
          title: source.title.slice(0, 80),
          sourceTitle: source.title,
          sourceLink: source.link || "",
          image: source.image || "",
          cardTheme: template?.cardTheme,
          cardRatio: template?.cardRatio,
          outputs,
          status: "draft" as const,
        };
      }
      const draft = await api.studioSaveDraft(uid, draftPayload);
      toast({ kind: "success", message: isDigest ? "خلاصهٔ خبری ساخته شد" : "پیش‌نویس ساخته شد" });
      onCreated(draft);
    } catch (e: any) {
      console.log("compose generate failed:", e);
      toast({ kind: "error", message: String(e?.message || e).slice(0, 120) });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <MobileScreen topbar={<MobileTopBar title="ساخت پیش‌نویس" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-28 md:pb-6 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] md:gap-6 md:items-start md:content-start md:max-w-[1120px] md:w-full md:mx-auto md:px-4">
        {/* Left column: source picker (Step 1) */}
        <div className="md:col-start-1 md:row-start-1 min-w-0">
          {/* Step 1: source(s) */}
          <SectionTitle n={1} title={selected.length >= 2 ? `انتخاب خبرها (${toFa(selected.length)} — حالت خلاصه)` : "انتخاب خبر منبع (می‌توانی چند تا انتخاب کنی)"} />
          <div className="px-4 md:px-0">
            <div className={`flex items-center gap-1.5 ${INPUT_CLS}`}>
              <Search className="size-4 text-[var(--foreground-subtle)] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو در اخبار…"
                className="flex-1 bg-transparent outline-none text-[14px]"
              />
            </div>
          </div>
          <div className="mt-2 px-3 md:px-0 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="px-2 py-6 text-center text-[12.5px] text-[var(--foreground-subtle)]">خبری یافت نشد.</div>
            ) : filtered.map((a) => {
              const on = selectedIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggleSource(a.id)}
                  className={`w-full text-right rounded-[var(--radius-md)] border px-3 py-2.5 tap press flex items-center gap-2 ${
                    on ? "border-[var(--brand-500)] bg-[var(--brand-500)]/8" : "border-[var(--border-subtle)] bg-[var(--surface)]"
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium leading-snug line-clamp-2">{a.title}</span>
                    <span className="block text-[11px] text-[var(--foreground-subtle)] mt-0.5">{a.source}</span>
                  </span>
                  {on && <Check className="size-4 text-[var(--brand-500)] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: config (Steps 2 & 3) + desktop generate */}
        <div className="md:col-start-2 md:row-start-1 min-w-0 md:sticky md:top-2 md:rounded-[var(--radius-lg)] md:border md:border-[var(--border-subtle)] md:bg-[var(--surface)] md:py-3">
          {/* Step 2: template */}
          <SectionTitle n={2} title="قالب (اختیاری)" />
          <div className="px-3 flex flex-wrap gap-2">
            <Chip label="بدون قالب" icon={<Sparkles className="size-3.5" />} on={tplId === ""} onClick={() => { haptic("tap"); setTplId(""); }} />
            {templates.map((t) => (
              <Chip key={t.id} label={t.name} icon={<FileText className="size-3.5" />} on={tplId === t.id} onClick={() => { haptic("tap"); setTplId(t.id); }} />
            ))}
          </div>

          {/* Step 3: platforms */}
          <SectionTitle n={3} title="پلتفرم‌های خروجی" />
          <div className="px-3 flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-[12.5px] border tap press flex items-center gap-1 ${
                    on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"
                  }`}
                >
                  <span>{PLATFORM_META[p].emoji}</span>
                  {PLATFORM_META[p].label}
                </button>
              );
            })}
          </div>

          {!brand.name && (
            <div className="mx-4 md:mx-3 mt-5 rounded-[var(--radius-md)] border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-[var(--foreground-muted)]">
              هنوز پروفایل برند را کامل نکرده‌ای؛ محتوا با لحن پیش‌فرض ساخته می‌شود. برای نتیجهٔ بهتر، ابتدا برند را تنظیم کن.
            </div>
          )}

          {/* Desktop-only inline generate button (mobile uses the fixed bottom bar). */}
          <div className="hidden md:block px-3 mt-5">
            <button
              onClick={generate}
              disabled={selected.length === 0 || platforms.length === 0 || generating}
              className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Wand2 className={`size-5 ${generating ? "animate-pulse" : ""}`} />
              {generating ? "در حال تولید با هوش مصنوعی…" : isDigest ? `تولید خلاصه از ${toFa(selected.length)} خبر` : "تولید محتوا"}
            </button>
          </div>
        </div>
      </div>

      <div className="md:hidden absolute inset-x-0 bottom-0 p-4 pb-[calc(16px+var(--safe-bottom))] bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
        <button
          onClick={generate}
          disabled={selected.length === 0 || platforms.length === 0 || generating}
          className="w-full h-12 rounded-[var(--radius-lg)] bg-[var(--brand-500)] text-white text-[15px] font-semibold tap press flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Wand2 className={`size-5 ${generating ? "animate-pulse" : ""}`} />
          {generating ? "در حال تولید با هوش مصنوعی…" : isDigest ? `تولید خلاصه از ${toFa(selected.length)} خبر` : "تولید محتوا"}
        </button>
      </div>
    </MobileScreen>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="px-4 mt-5 mb-2 flex items-center gap-2">
      <span className="size-5 rounded-full bg-[var(--brand-500)] text-white text-[11px] grid place-items-center font-bold">{toFa(n)}</span>
      <span className="text-[13px] font-semibold">{title}</span>
    </div>
  );
}

function Chip({ label, icon, on, onClick }: { label: string; icon: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12.5px] border tap press flex items-center gap-1 ${
        on ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)]" : "border-[var(--border-subtle)] text-[var(--foreground-muted)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
