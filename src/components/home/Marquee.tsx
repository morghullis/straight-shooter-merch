import { catchphrases } from "@/config/fans";
import { copy } from "@/config/copy";

import { MarqueeBands } from "./MarqueeBands";

/** Two crossing bands of catchphrases. The copy is documented once for screen readers. */
export function Marquee() {
  return <MarqueeBands phrases={[...catchphrases]} label={copy.marquee.label} />;
}
