import { cn } from "@/lib/utils";

type Tone = "neutral" | "gold" | "green" | "red" | "blue";

const toneClasses: Record<Tone, string> = {
  neutral: "border-line text-paper/70",
  gold: "border-gold text-gold",
  green: "border-emerald-800 text-emerald-400",
  red: "border-red-900 text-red-400",
  blue: "border-sky-900 text-sky-400",
};

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider",
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}
