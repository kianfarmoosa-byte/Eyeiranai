import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  iconLeading?: ReactNode;
  iconTrailing?: ReactNode;
  size?: "sm" | "md" | "lg";
  invalid?: boolean;
};

const SIZE = {
  sm: "h-8 text-xs",
  md: "h-9 text-sm",
  lg: "h-11 text-base",
} as const;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { iconLeading, iconTrailing, size = "md", invalid, className = "", ...rest }, ref,
) {
  return (
    <div className={[
      "group relative flex items-center w-full",
      "rounded-[var(--radius-md)] border",
      invalid ? "border-[var(--danger-500)]" : "border-[var(--input-border)]",
      "bg-[var(--input-background)]",
      "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]",
      "focus-within:border-[var(--brand-500)] focus-within:shadow-[var(--shadow-focus)]",
      SIZE[size],
      className,
    ].join(" ")}>
      {iconLeading && (
        <span className="ps-3 text-[var(--foreground-subtle)] flex-shrink-0">{iconLeading}</span>
      )}
      <input ref={ref}
        className={[
          "flex-1 min-w-0 bg-transparent outline-none px-3 h-full",
          "placeholder:text-[var(--foreground-subtle)]",
          iconLeading ? "ps-2" : "",
          iconTrailing ? "pe-2" : "",
        ].join(" ")}
        {...rest} />
      {iconTrailing && (
        <span className="pe-3 text-[var(--foreground-subtle)] flex-shrink-0">{iconTrailing}</span>
      )}
    </div>
  );
});
