import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary: "bg-gold text-ink hover:bg-goldBright border border-gold",
  secondary: "bg-transparent text-paper border border-line hover:border-gold hover:text-gold",
  ghost: "bg-transparent text-paper/70 hover:text-paper border border-transparent",
  danger: "bg-transparent text-danger border border-danger/50 hover:bg-danger/10",
};

const base =
  "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn(base, variantClasses[variant], className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variantClasses[variant], className)}>
      {children}
    </Link>
  );
}
