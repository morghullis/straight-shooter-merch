import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

import { art } from "@/config/art";
import { cn } from "@/lib/cn";

import { ArrowRightIcon } from "./Icons";

export type ButtonVariant = "gold" | "outline" | "ink" | "ghost";
export type ButtonSize = "none" | "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold tracking-[0.06em] whitespace-nowrap uppercase cursor-pointer transition-[filter,background-color,border-color,color,transform,rotate,translate,scale] duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white select-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Gold and ink buttons are strips of gaffer tape, like the showroom title (see `.tape-surface`), and
 * behave like real buttons: they lift and straighten under the pointer, press down when clicked and
 * show a focus ring for the keyboard.
 */
const pressable = "hover:-translate-y-0.5 hover:rotate-0 active:translate-y-0 active:scale-[0.97] active:rotate-0";
const variants: Record<ButtonVariant, string> = {
  gold: `tape-surface -rotate-[0.7deg] text-[#14110a] ${pressable}`,
  outline: "border border-white/30 text-white hover:border-gold hover:text-gold",
  ink: `tape-surface tape-ink rotate-[0.6deg] text-white ${pressable}`,
  ghost: "px-0 normal-case tracking-normal underline underline-offset-4 hover:text-gold",
};

const taped: ButtonVariant[] = ["gold", "ink"];

const sizes: Record<ButtonSize, string> = {
  none: "",
  sm: "h-10 px-6 text-[0.75rem] [--tape-end:0.6rem]",
  md: "h-11 px-7 text-[0.8125rem] [--tape-end:0.7rem]",
  lg: "h-12 px-8 text-[0.875rem] [--tape-end:0.8rem]",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows the right arrow after the label. */
  arrow?: boolean;
  className?: string;
  children: ReactNode;
}

type AsLink = CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;
type AsButton = CommonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/**
 * The one button of the storefront. Pass `href` for a link (internal links use
 * next/link, absolute URLs open in a new tab), otherwise it is a real <button>.
 */
export function Button(props: AsLink | AsButton) {
  const { variant = "gold", size = "md", arrow = false, className, children, style, ...rest } = props;
  const classes = cn(base, variants[variant], sizes[size], className);
  const tapeStyle = taped.includes(variant) ? ({ "--tape": `url(${art.tape.src})`, ...style } as CSSProperties) : style;
  const content = (
    <>
      {children}
      {arrow && <ArrowRightIcon size={18} strokeWidth={1.5} className="-mr-0.5 flex-none" />}
    </>
  );

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...anchor } = rest as AsLink;
    const external = /^https?:\/\//.test(href);
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} style={tapeStyle} {...anchor}>
        {content}
      </a>
    ) : (
      <Link href={href} className={classes} style={tapeStyle} {...anchor}>
        {content}
      </Link>
    );
  }

  const { type = "button", ...button } = rest as AsButton;
  return (
    <button type={type} className={classes} style={tapeStyle} {...button}>
      {content}
    </button>
  );
}
