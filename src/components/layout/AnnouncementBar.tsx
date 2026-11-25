import Link from "next/link";

import { StarIcon } from "@/components/ui/Icons";
import { textureStyle } from "@/components/ui/Art";
import { copy } from "@/config/copy";
import { getAnnouncements } from "@/lib/catalog";

/** Copies of the messages in each half of the loop: enough to fill the widest screens. */
const MIN_ITEMS = 12;
/** Seconds each message takes to cross its own place, so the pace is the same with two messages or ten. */
const SECONDS_PER_ITEM = 6;

/**
 * The strip above the navigation: the store's messages (see `getAnnouncements`) on gold stock, moving in
 * an endless loop. Everything about the loop is CSS; it holds still under the pointer, under keyboard
 * focus and with animations off. Nothing shows when Shopify has no message.
 */
export async function AnnouncementBar() {
  const messages = await getAnnouncements();
  if (!messages.length) return null;
  const copies = Math.max(1, Math.ceil(MIN_ITEMS / messages.length));
  const items = copies * messages.length;

  return (
    <section aria-label={copy.announcements.label} className="announcement-bar relative z-30 overflow-hidden bg-gold text-[#14110a]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply" style={textureStyle("paper")} />
      <div className="announcement-track relative flex w-max" style={{ animationDuration: `${items * SECONDS_PER_ITEM}s` }}>
        {[0, 1].map((half) => (
          <ul key={half} aria-hidden={half > 0 || undefined} className="flex flex-none">
            {Array.from({ length: copies }, (_, c) =>
              messages.map((message, i) => {
                const first = half === 0 && c === 0;
                return (
                  <li key={`${c}-${i}`} aria-hidden={first ? undefined : true} className="flex flex-none items-center">
                    <Link
                      href={message.href}
                      tabIndex={first ? undefined : -1}
                      className="flex h-(--announcement-h) items-center px-6 font-nav text-[0.75rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none sm:px-9 sm:text-[0.8125rem]"
                    >
                      {message.text}
                    </Link>
                    <StarIcon size={9} className="flex-none opacity-70" />
                  </li>
                );
              }),
            )}
          </ul>
        ))}
      </div>
    </section>
  );
}
