import { IconBase, type IconProps } from "./Icons";

/**
 * The header's icons: thin and quiet, with the brand in the details. Search is a scope with a gold
 * dead-centre (the Straight Shooter crosshair, as on the tee), the menu ends in the short gold bar of
 * the hero. They take the text colour; the gold parts stay gold.
 */

const gold = "var(--color-gold)";

export const ScopeIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="M10.5 3.5v2.6M10.5 14.9v2.6M3.5 10.5h2.6M14.9 10.5h2.6" />
    <path d="m15.75 15.75 4.75 4.75" strokeWidth={2} />
    <circle cx="10.5" cy="10.5" r="1.15" fill={gold} stroke="none" />
  </IconBase>
);

export const BagCartIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M2.75 4h2.4l2.05 10.05a1.6 1.6 0 0 0 1.57 1.28h8.36a1.6 1.6 0 0 0 1.56-1.24L20.25 8H6.1" />
    <circle cx="9.6" cy="19.4" r="1.35" />
    <circle cx="17" cy="19.4" r="1.35" />
  </IconBase>
);

export const AccountIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.75 20.25c.85-3.7 3.7-5.75 7.25-5.75s6.4 2.05 7.25 5.75" />
  </IconBase>
);

export const MenuBarsIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3.75 7h16.5M3.75 12h16.5" />
    <path d="M3.75 17h8.5" stroke={gold} strokeWidth={2.4} />
  </IconBase>
);
