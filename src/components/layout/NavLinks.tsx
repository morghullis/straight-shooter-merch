"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { copy } from "@/config/copy";
import type { NavLink } from "@/lib/navigation";

function NavList({ links, activeHref }: { links: NavLink[]; activeHref?: string }) {
  return (
    <ul className="flex items-center">
      {links.map((item, i) => {
        const active = activeHref === item.href;
        return (
          <li key={item.href} className="flex items-center">
            {i > 0 && <span aria-hidden="true" className="h-[0.9375rem] w-px bg-white" />}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`px-[1.09375rem] font-nav text-[1.10625rem] leading-none font-semibold whitespace-nowrap uppercase transition-colors hover:text-gold ${
                active ? "text-gold" : "text-white"
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return <NavList links={links} activeHref={pathname} />;
}

/** Desktop primary navigation: white caps separated by thin vertical rules. */
export function NavLinks({ links }: { links: NavLink[] }) {
  return (
    // Centered by a 1fr | auto | 1fr grid (no transform, so the 1px separators land on whole
    // pixels); the side columns never get narrower than the logo and the icons, so on narrow
    // screens the links move aside instead of running into them.
    <nav
      aria-label={copy.a11y.primaryNav}
      className="absolute inset-x-0 top-(--nav-top) hidden grid-cols-[minmax(calc(var(--gutter)+var(--logo-w)+0.5rem),1fr)_auto_minmax(9.25rem,1fr)] pr-[0.375rem] lg:grid [&>ul]:col-start-2"
    >
      <Suspense fallback={<NavList links={links} />}>
        <ActiveNav links={links} />
      </Suspense>
    </nav>
  );
}
