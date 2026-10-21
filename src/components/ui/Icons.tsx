import type { CSSProperties, SVGProps } from "react";

import { cn } from "@/lib/cn";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * `size` is the design size in px. It is applied in rem (through --icon) so icons grow with the
 * rest of the page on big screens; the width/height attributes are only a fallback.
 */
export function IconBase({ size = 20, strokeWidth = 1.5, children, className, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={cn("h-(--icon) w-(--icon)", className)}
      style={{ "--icon": `${size / 16}rem`, ...style } as CSSProperties}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </IconBase>
);

export const UserIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="12" cy="7.2" r="4" />
    <path d="M4 21v-1.5a5.5 5.5 0 0 1 5.5-5.5h5a5.5 5.5 0 0 1 5.5 5.5V21z" />
  </IconBase>
);

export const CartIcon = (p: IconProps) => (
  <IconBase {...p}>
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </IconBase>
);

export const ArrowRightIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </IconBase>
);

export const MenuIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
  </IconBase>
);

export const CloseIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </IconBase>
);

export const PlusIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </IconBase>
);

export const MinusIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M5 12h14" />
  </IconBase>
);

export const StarIcon = ({ size = 10, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 10 10"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <path d="M5 0l1.18 3.4H10L6.9 5.6l1.2 3.7L5 7.1 1.9 9.3l1.2-3.7L0 3.4h3.82z" />
  </svg>
);
