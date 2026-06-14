import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";
import { categories, feeds } from "../../../data";
import { ChevronLeft } from "lucide-react";

type Props = {
  onSelectCategory?: (id: string) => void;
  onSelectFeed?: (id: string) => void;
  onClose?: () => void;
};

export function TopicsScreen({ onSelectCategory, onSelectFeed, onClose }: Props) {
  return (
    <MobileScreen topbar={<MobileTopBar title="موضوعات" subtitle="دسته‌بندی‌ها و منابع" onBack={onClose} />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-4">
        <Section title="دسته‌بندی‌ها">
          <div className="grid grid-cols-2 gap-2 px-3">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCategory?.(c.id)}
                className="tap press flex items-center justify-between p-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] text-right"
              >
                <span className={`size-8 rounded-full ${c.color}`} />
                <div className="flex-1 px-2 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate">{c.name}</div>
                  <div className="text-[11px] text-[var(--foreground-subtle)]">{c.count.toLocaleString("fa-IR")} مقاله</div>
                </div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="منابع">
          <ul className="mx-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
            {feeds.map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => onSelectFeed?.(f.id)}
                  className="w-full tap press flex items-center gap-3 px-3 py-3 text-right"
                >
                  <span className="text-lg">{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate">{f.name}</div>
                    <div className="text-[11.5px] text-[var(--foreground-subtle)]">{f.category} · {f.count.toLocaleString("fa-IR")} جدید</div>
                  </div>
                  <ChevronLeft className="size-4 text-[var(--foreground-subtle)]" />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </MobileScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="px-4 pb-2 text-[11.5px] font-semibold text-[var(--foreground-subtle)] uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}
