import type { ArtKey } from "@/config/art";
import type { ModelSpec } from "@/config/models";

export interface ShowroomItem {
  handle: string;
  title: string;
  /** Formatted price ("$35.00"), plus the amount and currency for the price wheels. */
  price: string;
  priceAmount: number;
  currencyCode: string;
  href: string;
  image: string;
  imageAlt: string;
  model: ModelSpec;
  /** Stamp or sticker stuck onto this product's stage. */
  art?: { art: ArtKey; className: string };
}
