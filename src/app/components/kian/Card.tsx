import type { HTMLAttributes, ReactNode } from "react";

type Tone = "neutral" | "elevated" | "subtle" | "outlined" | "glass";

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: Tone;
  padded?: boolean;
  interactive?: boolean;
  children?: ReactNode;
};

const TONE: Record<Tone, string> = {
  neutral:
    "bg-[var(--card)] border border-[var(--border)]",
  elevated:
    "bg-[var(--card-elevated)] border border-[var(--border)] shadow-[var(--shadow-md)]",
  subtle:
    "bg-[var(--background-subtle)] border border-[var(--border-subtle)]",
  outlined:
    "bg-transparent border border-[var(--border-strong)]",
  glass:
    "glass border border-[var(--border-subtle)] shadow-[var(--shadow-sm)]",
};

export function Card({ tone = "neutral", padded, interactive, className = "", children, ...rest }: Props) {
  return (
    <div className={[
      "rounded-[var(--radius-lg)]",
      TONE[tone],
      padded ? "p-4" : "",
      interactive ? "transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-quart)] " +
                    "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-lg)] cursor-pointer" : "",
      className,
    ].join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-4 pt-4 pb-2 ${className}`} {...rest}>{children}</div>;
}
export function CardBody({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-4 py-3 ${className}`} {...rest}>{children}</div>;
}
export function CardFooter({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-4 pt-2 pb-4 border-t border-[var(--border-subtle)] ${className}`} {...rest}>{children}</div>;
}
