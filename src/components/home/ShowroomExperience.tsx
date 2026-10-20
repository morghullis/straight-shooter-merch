"use client";

import { useMotionEnabled } from "@/components/motion/motion-preference";
import { useWebGL } from "@/lib/browser";

import { ShowroomScrub } from "./ShowroomScrub";
import { ShowroomTabs } from "./ShowroomTabs";
import type { ShowroomItem } from "./showroom-types";

/**
 * Picks the showroom variant. The server render assumes a capable browser, so most visitors
 * never see a layout change; those without WebGL or with animations off get the tab version.
 */
export function ShowroomExperience({ items }: { items: ShowroomItem[] }) {
  const motionOn = useMotionEnabled();
  const webgl = useWebGL(true);

  return motionOn && webgl ? <ShowroomScrub items={items} /> : <ShowroomTabs items={items} />;
}
