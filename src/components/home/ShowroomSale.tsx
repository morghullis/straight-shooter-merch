"use client";

import { useState } from "react";

import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";

/** The usual price, struck through, and the sale label beside a Showroom price. Fades in and out as the pieces change. */
export function ShowroomSale({ was, sale, row = false }: { was?: string; sale?: string; row?: boolean }) {
  // The last sale stays drawn while it fades out.
  const [shown, setShown] = useState({ was, sale });
  if (was && (was !== shown.was || sale !== shown.sale)) setShown({ was, sale });

  return (
    <span
      aria-hidden={was ? undefined : true}
      className={cn("flex transition-opacity duration-300", row ? "items-center gap-3" : "flex-col items-start gap-2", was ? "opacity-100" : "opacity-0")}
    >
      {shown.was && (
        <>
          <s className={cn("leading-none text-white/60", row ? "text-[0.9375rem]" : "text-[1.125rem] lg:text-[1.375rem]")}>
            <span className="sr-only">{copy.product.regularPrice} </span>
            {shown.was}
          </s>
          <span className="bg-black px-2 py-1 font-nav text-[0.75rem] leading-none font-semibold tracking-[0.1em] text-gold uppercase ring-1 ring-gold/40">{shown.sale}</span>
        </>
      )}
    </span>
  );
}
