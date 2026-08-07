"use client";

import { useTransition } from "react";
import { linkOrderToBag } from "@/app/(app)/orders/actions";
import { cn } from "@/lib/utils";

export function DashboardRelierButton({
  orderId,
  bagId,
  serialNumber,
}: {
  orderId: string;
  bagId: string;
  serialNumber: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          linkOrderToBag(orderId, bagId);
        })
      }
      className={cn(
        "shrink-0 whitespace-nowrap rounded-sm border border-gold/40 px-3 py-1.5 text-[11px] text-gold hover:bg-gold/10",
        isPending && "opacity-50"
      )}
    >
      {isPending ? "…" : `Relier ${serialNumber}`}
    </button>
  );
}
