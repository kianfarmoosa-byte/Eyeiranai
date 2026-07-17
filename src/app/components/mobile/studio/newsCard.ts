// Renders a branded news card to a PNG data URL using the HTML canvas.
// Builds a clean brand-styled card from the title + brand identity, with
// selectable theme, aspect ratio, and an optional brand logo.

export type CardTheme = "dark" | "light" | "editorial";
export type CardRatio = "square" | "story" | "wide";

export type CardOptions = {
  title: string;
  brandName?: string;
  tagline?: string;
  source?: string;
  accent?: string;       // hex accent color
  theme?: CardTheme;
  ratio?: CardRatio;
  logoUrl?: string;      // optional brand logo (drawn top-right)
};

const RATIOS: Record<CardRatio, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  wide: { w: 1200, h: 675 },
};

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((x) => x + x).join("") : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    // Safety timeout
    setTimeout(() => resolve(img.complete && img.naturalWidth ? img : null), 8000);
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 1) last = last.slice(0, -1);
    lines[maxLines - 1] = last + "…";
  }
  return lines;
}

export async function renderNewsCard(opts: CardOptions): Promise<string> {
  const accent = opts.accent || "#F5BF0F";
  const theme = opts.theme || "dark";
  const ratio = opts.ratio || "square";
  const { w: W, h: H } = RATIOS[ratio];

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const [ar, ag, ab] = hexToRgb(accent);

  const palettes = {
    dark: { bg: "#171717", fg: "#FFFFFF", sub: "rgba(255,255,255,0.6)", outline: "rgba(255,255,255,0.10)", serif: false },
    light: { bg: "#FAFAFA", fg: "#171717", sub: "rgba(0,0,0,0.55)", outline: "rgba(0,0,0,0.08)", serif: false },
    editorial: { bg: "#F4F1EA", fg: "#1A1A1A", sub: "rgba(0,0,0,0.55)", outline: "rgba(0,0,0,0.10)", serif: true },
  } as const;
  const pal = palettes[theme];
  const sans = "'Vazirmatn', Tahoma, sans-serif";
  const serif = "'Georgia', 'Times New Roman', serif";
  const titleFont = pal.serif ? serif : sans;

  // Background
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  // Accent glow blob (bottom-left)
  const grad = ctx.createRadialGradient(W * 0.16, H - 160, 60, W * 0.16, H - 160, Math.max(W, H) * 0.7);
  grad.addColorStop(0, `rgba(${ar},${ag},${ab},0.26)`);
  grad.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Outline geometry (top-right) — subtle for editorial
  if (theme !== "editorial") {
    ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.5)`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W - 140, 170, 110, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pal.outline;
    ctx.strokeRect(W - 250, 80, 180, 180);
  }

  const PAD = Math.round(W * 0.083);
  ctx.textAlign = "right";
  ctx.direction = "rtl";

  // Brand name (top)
  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.round(W * 0.037)}px ${sans}`;
  ctx.fillText(opts.brandName || "flow", W - PAD, PAD + 24);
  if (opts.tagline) {
    ctx.fillStyle = pal.sub;
    ctx.font = `500 ${Math.round(W * 0.024)}px ${sans}`;
    ctx.fillText(opts.tagline, W - PAD, PAD + 66);
  }

  // Logo (top-left)
  if (opts.logoUrl) {
    const logo = await loadImage(opts.logoUrl);
    if (logo && logo.naturalWidth) {
      const box = Math.round(W * 0.12);
      const ratioImg = logo.naturalWidth / logo.naturalHeight;
      const lw = ratioImg >= 1 ? box : box * ratioImg;
      const lh = ratioImg >= 1 ? box / ratioImg : box;
      try { ctx.drawImage(logo, PAD, PAD - 6, lw, lh); } catch { /* tainted — skip */ }
    }
  }

  // Title (wrapped, vertically centered-ish)
  ctx.fillStyle = pal.fg;
  const titlePx = ratio === "story" ? Math.round(W * 0.072) : Math.round(W * 0.067);
  ctx.font = `800 ${titlePx}px ${titleFont}`;
  const maxLines = ratio === "story" ? 7 : ratio === "wide" ? 4 : 6;
  const lines = wrapLines(ctx, opts.title || "", W - PAD * 2, maxLines);
  const lineH = Math.round(titlePx * 1.25);
  const blockH = lines.length * lineH;
  let y = Math.max(PAD + 180, (H - blockH) / 2);
  for (const ln of lines) {
    ctx.fillText(ln, W - PAD, y);
    y += lineH;
  }

  // Accent bar + footer source
  ctx.fillStyle = accent;
  ctx.fillRect(W - PAD - 120, H - PAD - 56, 120, 8);
  ctx.fillStyle = pal.sub;
  ctx.font = `500 ${Math.round(W * 0.028)}px ${sans}`;
  ctx.fillText(opts.source ? `منبع: ${opts.source}` : (opts.brandName || ""), W - PAD, H - PAD);

  return canvas.toDataURL("image/png");
}

type CarouselOptions = {
  title: string;
  slides: string[];
  brandName?: string;
  tagline?: string;
  accent?: string;
  theme?: CardTheme;
  logoUrl?: string;
};

/** Render a square carousel: a cover slide + one slide per text chunk. */
export async function renderCarousel(opts: CarouselOptions): Promise<string[]> {
  const accent = opts.accent || "#F5BF0F";
  const theme = opts.theme || "dark";
  const W = 1080, H = 1080;
  const palettes = {
    dark: { bg: "#171717", fg: "#FFFFFF", sub: "rgba(255,255,255,0.6)" },
    light: { bg: "#FAFAFA", fg: "#171717", sub: "rgba(0,0,0,0.55)" },
    editorial: { bg: "#F4F1EA", fg: "#1A1A1A", sub: "rgba(0,0,0,0.55)" },
  } as const;
  const pal = palettes[theme];
  const [ar, ag, ab] = hexToRgb(accent);
  const sans = "'Vazirmatn', Tahoma, sans-serif";
  const logo = opts.logoUrl ? await loadImage(opts.logoUrl) : null;
  const total = opts.slides.length + 1;
  const PAD = 90;

  function frame(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W * 0.16, H - 160, 60, W * 0.16, H - 160, 760);
    grad.addColorStop(0, `rgba(${ar},${ag},${ab},0.22)`);
    grad.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "right"; ctx.direction = "rtl";
    // brand
    ctx.fillStyle = accent; ctx.font = `700 38px ${sans}`;
    ctx.fillText(opts.brandName || "flow", W - PAD, 120);
    if (logo?.naturalWidth) {
      const box = 120; const r = logo.naturalWidth / logo.naturalHeight;
      try { ctx.drawImage(logo, PAD, 70, r >= 1 ? box : box * r, r >= 1 ? box / r : box); } catch { /* skip */ }
    }
    return { canvas, ctx };
  }

  function pageDots(ctx: CanvasRenderingContext2D, idx: number) {
    const n = total; const dot = 14, gap = 14;
    const totalW = n * dot + (n - 1) * gap;
    let x = (W - totalW) / 2;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(x + dot / 2, H - 70, dot / 2, 0, Math.PI * 2);
      ctx.fillStyle = i === idx ? accent : pal.sub; ctx.fill();
      x += dot + gap;
    }
  }

  const out: string[] = [];

  // Cover
  {
    const { canvas, ctx } = frame();
    if (opts.tagline) { ctx.fillStyle = pal.sub; ctx.font = `500 26px ${sans}`; ctx.fillText(opts.tagline, W - PAD, 162); }
    ctx.fillStyle = pal.fg; ctx.font = `800 78px ${sans}`;
    const lines = wrapLines(ctx, opts.title || "", W - PAD * 2, 6);
    let y = Math.max(360, (H - lines.length * 96) / 2);
    for (const ln of lines) { ctx.fillText(ln, W - PAD, y); y += 96; }
    ctx.fillStyle = accent; ctx.fillRect(W - PAD - 120, H - 150, 120, 8);
    ctx.fillStyle = pal.sub; ctx.font = `500 26px ${sans}`; ctx.fillText("برای دیدن ادامه بکشید ←", W - PAD, H - 110);
    pageDots(ctx, 0);
    out.push(canvas.toDataURL("image/png"));
  }

  // Item slides
  opts.slides.forEach((slide, i) => {
    const { canvas, ctx } = frame();
    // index badge
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(W - PAD - 28, 240, 40, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = theme === "light" ? "#171717" : "#171717";
    ctx.textAlign = "center"; ctx.font = `800 40px ${sans}`;
    ctx.fillText(String(i + 1), W - PAD - 28, 255);
    ctx.textAlign = "right";
    // body
    ctx.fillStyle = pal.fg; ctx.font = `600 52px ${sans}`;
    const lines = wrapLines(ctx, slide, W - PAD * 2, 9);
    let y = 380;
    for (const ln of lines) { ctx.fillText(ln, W - PAD, y); y += 70; }
    ctx.fillStyle = pal.sub; ctx.font = `500 24px ${sans}`;
    ctx.fillText(opts.brandName || "flow", W - PAD, H - 110);
    pageDots(ctx, i + 1);
    out.push(canvas.toDataURL("image/png"));
  });

  return out;
}

export const CARD_THEMES: { id: CardTheme; label: string }[] = [
  { id: "dark", label: "تیره" },
  { id: "light", label: "روشن" },
  { id: "editorial", label: "مجله‌ای" },
];

export const CARD_RATIOS: { id: CardRatio; label: string }[] = [
  { id: "square", label: "مربع ۱:۱" },
  { id: "story", label: "استوری ۹:۱۶" },
  { id: "wide", label: "عریض ۱۶:۹" },
];
