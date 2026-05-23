import { useEffect, useRef, useState } from "react";
import { Copy, Download, Share2, Check, Link2, MessageCircle, Send } from "lucide-react";
import { BottomSheet } from "../primitives/BottomSheet";
import { useHaptics } from "../hooks";
import { useToast } from "../primitives/Toast";
import type { Article } from "../../../data";

type Props = {
  open: boolean;
  onClose: () => void;
  article: Article | null;
};

/**
 * Native-feel share sheet. Renders a beautiful Persian quote card on a
 * <canvas>, lets the user copy/download/native-share, plus quick deep-links
 * to popular Persian-speaking platforms.
 */
export function ShareSheet({ open, onClose, article }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const haptic = useHaptics();
  const toast = useToast();
  // toast(t) takes { kind, message }
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !article || !canvasRef.current) return;
    drawCard(canvasRef.current, article).then(setDataUrl).catch(() => {});
  }, [open, article?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!article) return null;
  const shareUrl = article.link ?? location.href;
  const shareText = `${article.title} — از کیان`;

  const copyLink = async () => {
    haptic("tap");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ kind: "success", message: "لینک کپی شد" });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ kind: "error", message: "کپی نشد" });
    }
  };

  const download = async () => {
    haptic("select");
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `kian-${article.id}.png`;
    a.click();
    toast({ kind: "success", message: "تصویر دانلود شد" });
  };

  const nativeShare = async () => {
    haptic("select");
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, text: shareText, url: shareUrl });
      } catch {}
    } else {
      copyLink();
    }
  };

  const openExternal = (url: string) => {
    haptic("tap");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const enc = encodeURIComponent;

  return (
    <BottomSheet open={open} onClose={onClose} title="اشتراک‌گذاری" snap="full">
      <div className="px-4 pb-6 space-y-4">
        {/* Preview */}
        <div className="rounded-[var(--radius-xl)] overflow-hidden bg-[var(--background-muted)] border border-[var(--border-subtle)]">
          <canvas
            ref={canvasRef}
            width={1080}
            height={1350}
            className="w-full h-auto block"
            style={{ aspectRatio: "1080 / 1350" }}
          />
        </div>

        {/* Primary actions */}
        <div className="grid grid-cols-3 gap-2">
          <ActionBtn icon={<Share2 className="size-5" />} label="اشتراک" onClick={nativeShare} primary />
          <ActionBtn icon={copied ? <Check className="size-5" /> : <Copy className="size-5" />} label={copied ? "کپی شد" : "کپی لینک"} onClick={copyLink} />
          <ActionBtn icon={<Download className="size-5" />} label="دانلود تصویر" onClick={download} />
        </div>

        {/* Quick share to apps */}
        <div>
          <div className="text-[11.5px] font-bold text-[var(--foreground-muted)] mb-2 px-1">اشتراک سریع</div>
          <div className="grid grid-cols-4 gap-2">
            <AppBtn
              label="تلگرام"
              tone="#0088CC"
              icon={<Send className="size-5 -rotate-45" />}
              onClick={() => openExternal(`https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`)}
            />
            <AppBtn
              label="واتساپ"
              tone="#25D366"
              icon={<MessageCircle className="size-5" />}
              onClick={() => openExternal(`https://wa.me/?text=${enc(`${shareText}\n${shareUrl}`)}`)}
            />
            <AppBtn
              label="توییتر"
              tone="#000000"
              icon={<span className="text-[15px] font-black">𝕏</span>}
              onClick={() => openExternal(`https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`)}
            />
            <AppBtn
              label="ایمیل"
              tone="#6B7280"
              icon={<Link2 className="size-5" />}
              onClick={() => openExternal(`mailto:?subject=${enc(article.title)}&body=${enc(`${shareText}\n${shareUrl}`)}`)}
            />
          </div>
        </div>

        {/* Link readout */}
        <div className="rounded-[var(--radius-md)] bg-[var(--background-muted)] border border-[var(--border-subtle)] px-3 py-2.5 flex items-center gap-2">
          <Link2 className="size-3.5 text-[var(--foreground-subtle)] shrink-0" />
          <span className="flex-1 text-[11.5px] text-[var(--foreground-muted)] truncate" dir="ltr">{shareUrl}</span>
          <button onClick={copyLink} className="text-[11.5px] font-semibold text-[var(--brand-500)] tap">
            کپی
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function ActionBtn({ icon, label, onClick, primary }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-20 rounded-[var(--radius-lg)] flex flex-col items-center justify-center gap-1.5 tap press transition-colors ${
        primary
          ? "bg-[var(--brand-500)] text-white"
          : "bg-[var(--background-muted)] text-[var(--foreground)] border border-[var(--border-subtle)]"
      }`}
    >
      {icon}
      <span className="text-[11.5px] font-semibold">{label}</span>
    </button>
  );
}

function AppBtn({ label, icon, tone, onClick }: { label: string; icon: React.ReactNode; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 tap press">
      <span
        className="size-12 rounded-full grid place-items-center text-white shadow-sm"
        style={{ backgroundColor: tone }}
      >
        {icon}
      </span>
      <span className="text-[11px] text-[var(--foreground-muted)]">{label}</span>
    </button>
  );
}

/** Renders a portrait Persian quote card to the given canvas; returns a dataURL. */
async function drawCard(canvas: HTMLCanvasElement, a: Article): Promise<string> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const W = canvas.width;
  const H = canvas.height;

  // Background — blue gradient (matches mobile theme)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1E40AF");
  bg.addColorStop(0.55, "#2563EB");
  bg.addColorStop(1, "#0EA5E9");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft top vignette
  const v = ctx.createRadialGradient(W * 0.2, H * 0.1, 50, W * 0.2, H * 0.1, W);
  v.addColorStop(0, "rgba(255,255,255,0.18)");
  v.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  // Brand badge top-right (RTL)
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  roundRect(ctx, W - 280, 70, 200, 70, 35);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 38px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✦  کیان", W - 180, 105);

  // Optional image strip (top-left, RTL means content origin on right)
  if (a.image) {
    try {
      const img = await loadImage(a.image);
      const ih = 420;
      ctx.save();
      roundRect(ctx, 80, 180, W - 160, ih, 32);
      ctx.clip();
      // cover
      const ratio = Math.max((W - 160) / img.width, ih / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, 80 + ((W - 160) - dw) / 2, 180 + (ih - dh) / 2, dw, dh);
      // overlay
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(80, 180, W - 160, ih);
      ctx.restore();
    } catch {}
  }

  // Title (RTL)
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.direction = "rtl";
  ctx.font = "900 56px system-ui, -apple-system, 'Vazirmatn', sans-serif";
  const titleY = a.image ? 720 : 320;
  wrapText(ctx, a.title, W - 80, titleY, W - 160, 76, 6);

  // Preview (TLDR)
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.font = "400 34px system-ui, -apple-system, 'Vazirmatn', sans-serif";
  const previewY = a.image ? 990 : 620;
  wrapText(ctx, a.preview ?? "", W - 80, previewY, W - 160, 50, 4);

  // Footer divider
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, H - 180);
  ctx.lineTo(W - 80, H - 180);
  ctx.stroke();

  // Source + author (RTL)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px system-ui, -apple-system, 'Vazirmatn', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`${a.sourceIcon ?? ""}  ${a.source}`, W - 80, H - 110);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "400 26px system-ui, -apple-system, 'Vazirmatn', sans-serif";
  if (a.author) ctx.fillText(a.author, W - 80, H - 65);

  // CTA (left)
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 26px system-ui, -apple-system, 'Vazirmatn', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("اپ کیان • RSS هوشمند", 80, H - 80);

  return canvas.toDataURL("image/png");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines === maxLines - 1) {
        ctx.fillText(line + "…", x, y + lines * lineHeight);
        return;
      }
      ctx.fillText(line, x, y + lines * lineHeight);
      line = words[i];
      lines++;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineHeight);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
