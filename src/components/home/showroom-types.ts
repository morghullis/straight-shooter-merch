import type { ArtKey } from "@/config/art";
import type { ModelSpec } from "@/config/models";

export interface ShowroomItem {
  handle: string;
  title: string;
  price: string;
  href: string;
  image: string;
  imageAlt: string;
  /** Short selling points, taken from the product description. */
  specs: string[];
  model: ModelSpec;
  /** Stamp or sticker stuck onto this product's stage. */
  art?: { art: ArtKey; className: string };
}
