import { Settings, Moon, Bell, Download, Info, ChevronLeft, Type, Globe, NotebookPen, History, LogIn, LogOut, Headphones, BarChart3, Globe2 } from "lucide-react";
import { MobileScreen } from "../shell/MobileScreen";
import { MobileTopBar } from "../shell/MobileTopBar";

type Props = {
  name?: string;
  email?: string;
  onOpenSettings?: () => void;
  onToggleTheme?: () => void;
  onOpenNotes?: () => void;
  onOpenHistory?: () => void;
  onOpenNotifications?: () => void;
  unreadNotifs?: number;
  isAuthed?: boolean;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
  onOpenProfile?: () => void;
  onOpenBriefing?: () => void;
  onOpenStats?: () => void;
  onOpenInternational?: () => void;
};

export function MeScreen({ name = "کاربر کیان", email, onOpenSettings, onToggleTheme, onOpenNotes, onOpenHistory, onOpenNotifications, unreadNotifs = 0, isAuthed = false, onOpenAuth, onSignOut, onOpenProfile, onOpenBriefing, onOpenStats, onOpenInternational }: Props) {
  return (
    <MobileScreen topbar={<MobileTopBar title="من" />}>
      <div className="h-full overflow-y-auto scrollbar-none pb-4">
        <button
          onClick={isAuthed ? onOpenProfile : onOpenAuth}
          className="w-full px-4 pt-4 flex items-center gap-3 text-right tap press"
        >
          <div className="size-14 rounded-full bg-gradient-to-tr from-[var(--brand-500)] to-[var(--brand-300)] grid place-items-center text-white text-lg font-semibold">
            {name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold truncate">{name}</div>
            {email && <div className="text-[12px] text-[var(--foreground-subtle)] truncate">{email}</div>}
            {!isAuthed && <div className="text-[11.5px] text-[var(--brand-500)] mt-0.5">برای ویرایش وارد شو</div>}
          </div>
          <span onClick={(e) => { e.stopPropagation(); onOpenSettings?.(); }} aria-label="تنظیمات" className="size-10 grid place-items-center rounded-full tap press active:bg-[var(--accent)]">
            <Settings className="size-5" />
          </span>
        </button>

        <Group>
          <Row icon={<Moon className="size-4" />} label="حالت تیره" onClick={onToggleTheme} />
          <Row icon={<Type className="size-4" />} label="اندازه متن" />
          <Row icon={<Globe className="size-4" />} label="زبان" value="فارسی" />
        </Group>

        <Group>
          <Row icon={<Globe2 className="size-4" />} label="اخبار بین‌المللی" onClick={onOpenInternational} value="جدید" />
          <Row icon={<BarChart3 className="size-4" />} label="آمار مطالعه" onClick={onOpenStats} />
          <Row icon={<Headphones className="size-4" />} label="خلاصهٔ صوتی روز" onClick={onOpenBriefing} />
          <Row icon={<NotebookPen className="size-4" />} label="یادداشت‌ها" onClick={onOpenNotes} />
          <Row icon={<History className="size-4" />} label="تاریخچهٔ مطالعه" onClick={onOpenHistory} />
          <Row icon={<Bell className="size-4" />} label="اعلان‌ها" onClick={onOpenNotifications} value={unreadNotifs > 0 ? `${unreadNotifs} نخوانده` : undefined} />
          <Row icon={<Download className="size-4" />} label="حافظه آفلاین" />
        </Group>

        <Group>
          <Row icon={<Info className="size-4" />} label="درباره کیان" value="نسخه ۱.۰" />
          {isAuthed ? (
            <Row icon={<LogOut className="size-4" />} label="خروج از حساب" onClick={onSignOut} />
          ) : (
            <Row icon={<LogIn className="size-4" />} label="ورود / ثبت‌نام" onClick={onOpenAuth} />
          )}
        </Group>
      </div>
    </MobileScreen>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 mx-3 rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
      {children}
    </ul>
  );
}

function Row({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value?: string; onClick?: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="w-full tap press flex items-center gap-3 px-3.5 py-3 text-right">
        <span className="size-8 grid place-items-center rounded-full bg-[var(--accent)] text-[var(--foreground-muted)]">{icon}</span>
        <span className="flex-1 text-[14px]">{label}</span>
        {value && <span className="text-[12.5px] text-[var(--foreground-subtle)]">{value}</span>}
        <ChevronLeft className="size-4 text-[var(--foreground-subtle)]" />
      </button>
    </li>
  );
}
