"use client";

import { useState, useTransition } from "react";
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
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await linkOrderToBag(orderId, bagId);
            if (result.error) setError(result.error);
          })
        }
        className={cn(
          "whitespace-nowrap rounded-sm border border-gold/40 px-3 py-1.5 text-[11px] text-gold hover:bg-gold/10",
          isPending && "opacity-50"
        )}
      >
        {isPending ? "…" : `Relier ${serialNumber}`}
      </button>
      {error && <p className="mt-1 max-w-[180px] text-[11px] text-danger">{error}</p>}
    </div>
  );
}
