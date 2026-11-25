import type { ArtKey } from "@/config/art";
import type { ModelSpec } from "@/config/models";

export interface ShowroomItem {
  handle: string;
  title: string;
  /** Formatted price ("$35.00"), plus the amount and currency for the price wheels. */
  price: string;
  priceAmount: number;
  currencyCode: string;
  /** On sale: the usual price, formatted, and the label ("10% off"). */
  was?: string;
  sale?: string;
  sticker?: { src: string; percent: number };
  href: string;
  image: string;
  imageAlt: string;
  model: ModelSpec;
  /** Stamp or sticker stuck onto this product's stage. */
  art?: { art: ArtKey; className: string };
}
