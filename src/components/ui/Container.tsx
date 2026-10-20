import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Content column: 1152px max, with the same side gutters across the whole site. */
export function Container({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag className={cn("mx-auto w-full max-w-(--container) px-(--gutter) xl:px-1", className)} {...rest}>
      {children}
    </Tag>
  );
}
