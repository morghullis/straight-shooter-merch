"use client";

import { useEffect } from "react";

import { trackInteraction } from "@/lib/track";

/** Counts a view of the product page (once per session) for the showroom's ranking. */
export function TrackProductView({ handle }: { handle: string }) {
  useEffect(() => trackInteraction(handle, "view"), [handle]);
  return null;
}
