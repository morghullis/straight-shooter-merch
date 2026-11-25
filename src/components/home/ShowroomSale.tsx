"use client";

import { useState } from "react";

import { SaleSticker } from "@/components/product/SaleSticker";
import { SaleTag } from "@/components/product/SaleTag";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

import type { ShowroomItem } from "./showroom-types";

type Sale = Pick<ShowroomItem, "was" | "sale" | "sticker">;

/** The usual price, struck through, and what is off, beside a Showroom price. Fades in and out as the pieces change. */
export function ShowroomSale({ was, sale, sticker, row = false }: Sale & { row?: boolean }) {
  // The last sale stays drawn while it fades out.
  const [shown, setShown] = useState<Sale>({ was, sale, sticker });
  if (was && (was !== shown.was || sale !== shown.sale || sticker?.src !== shown.sticker?.src)) setShown({ was, sale, sticker });

  return (
    <span
      aria-hidden={was ? undefined : true}
      className={cn("flex items-center gap-3 transition-opacity duration-300", !row && !shown.sticker && "flex-col !items-start gap-2", was ? "opacity-100" : "opacity-0")}
    >
      {shown.was && (
        <>
          {shown.sticker && !row && <SaleSticker src={shown.sticker.src} percent={shown.sticker.percent} className="-rotate-[7deg] text-[0.9375rem] lg:text-[1.25rem]" />}
          <s className={cn("leading-none text-white/60", row ? "text-[0.9375rem]" : "text-[1.125rem] lg:text-[1.375rem]")}>
            <span className="sr-only">{copy.product.regularPrice} </span>
            {shown.was}
          </s>
          {(row || !shown.sticker) && shown.sale && <SaleTag className={cn("-rotate-2", row ? "text-[1.0625rem]" : "text-[1.375rem]")}>{shown.sale}</SaleTag>}
        </>
      )}
    </span>
  );
}
