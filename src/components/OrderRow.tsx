"use client";

import { useTransition } from "react";
import { updateOrder, deleteOrder, linkOrderToBag } from "@/app/(app)/orders/actions";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { Order, OrderStatus, PaymentStatus } from "@/types/database";

export function OrderRow({
  order,
  bagLabel,
  desiredModelLabel,
  matchingBags,
  customerName,
}: {
  order: Order;
  bagLabel: string | null;
  desiredModelLabel: string | null;
  matchingBags: { id: string; serial_number: string; model_label: string }[];
  customerName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function patch(field: "status" | "payment_status", value: string) {
    const fd = new FormData();
    fd.set("status", field === "status" ? value : order.status);
    fd.set("payment_status", field === "payment_status" ? value : order.payment_status);
    fd.set("invoice_number", order.invoice_number ?? "");
    fd.set("shipping_carrier", order.shipping_carrier ?? "");
    fd.set("tracking_number", order.tracking_number ?? "");
    fd.set("shipped_at", order.shipped_at ?? "");
    fd.set("sale_price", order.sale_price?.toString() ?? "");
    fd.set("notes", order.notes ?? "");
    startTransition(() => {
      updateOrder(order.id, fd);
    });
  }

  function link(bagId: string) {
    startTransition(() => {
      linkOrderToBag(order.id, bagId);
    });
  }

  return (
    <tr className="border-b border-line/60 last:border-0">
      <td className="px-4 py-3 text-paper/80">{order.order_name}</td>
      <td className="px-4 py-3 text-paper/60">
        {bagLabel ?? (
          <span>
            <span className="text-paper/40">Souhaite : </span>
            {desiredModelLabel ?? "-"}
            {matchingBags.length > 0 && (
              <span className="ml-2 space-x-1">
                {matchingBags.map((b) => (
                  <button
                    key={b.id}
                    disabled={isPending}
                    onClick={() => link(b.id)}
                    className="rounded-sm border border-gold/40 px-2 py-0.5 text-xs text-gold hover:bg-gold/10"
                  >
                    Relier {b.serial_number}
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-paper/60">{customerName}</td>
      <td className="px-4 py-3">
        <select
          disabled={isPending}
          defaultValue={order.status}
          onChange={(e) => patch("status", e.target.value)}
          className="input-base px-2 py-1 text-xs"
        >
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          disabled={isPending}
          defaultValue={order.payment_status}
          onChange={(e) => patch("payment_status", e.target.value)}
          className="input-base px-2 py-1 text-xs"
        >
          {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-paper/60">{formatDate(order.order_date)}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => {
            if (window.confirm(`Supprimer la commande "${order.order_name}" ? Cette action est definitive.`)) {
              startTransition(() => deleteOrder(order.id));
            }
          }}
          className="text-xs text-danger hover:underline"
        >
          Supprimer
        </button>
      </td>
    </tr>
  );
}
