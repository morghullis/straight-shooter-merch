import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { copy } from "@/config/copy";
import { site } from "@/config/site";

import { HeaderActions } from "./HeaderActions";
import { HeaderShell } from "./HeaderShell";
import { NavLinks } from "./NavLinks";

/**
 * 83px black bar on desktop (the logo hangs below it into the hero, as in the design),
 * a compact 64px sticky bar on phones.
 */
export function Header() {
  return (
    <HeaderShell>
      <div className="relative mx-auto h-(--header-h) max-w-(--container)">
        <Link
          href="/"
          aria-label={copy.header.home(site.name)}
          className="absolute top-(--logo-top) left-(--gutter) z-[70] block xl:left-1"
        >
          <Logo priority />
        </Link>

        <NavLinks />
        <HeaderActions />
      </div>
    </HeaderShell>
  );
}
