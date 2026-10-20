"use client";

import { useActionState } from "react";

import { joinCrew, type JoinState } from "@/app/fan-actions";
import { RevealText } from "@/components/motion/RevealText";
import { Art, textureStyle } from "@/components/ui/Art";
import { Button } from "@/components/ui/Button";
import { copy } from "@/config/copy";
import { SIRIUSXM_STEPHEN_A } from "@/config/fans";

const initial: JoinState = { status: "idle", message: "" };

/**
 * Season pass: a gold ticket with a torn-off "admit one fan" stub. The form posts to the
 * server action; without a webhook configured it says so instead of pretending to save.
 */
export function JoinCrew() {
  const [state, action, pending] = useActionState(joinCrew, initial);
  const done = state.status === "ok";

  return (
    <section
      aria-labelledby="crew-title"
      style={textureStyle("paper")}
      className="relative grid h-full grid-cols-[auto_1fr] overflow-hidden bg-gold text-[#14110a] shadow-[0_1.125rem_1.875rem_-0.75rem_rgba(0,0,0,0.7)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-gold/80 mix-blend-multiply" aria-hidden="true" />

      {/* Stub */}
      <div
        aria-hidden="true"
        className="relative z-[1] flex w-12 items-center justify-center border-r-2 border-dashed border-[#14110a]/50 sm:w-14"
      >
        <span className="size-6 absolute -top-3 -right-3 rounded-full bg-black" />
        <span className="size-6 absolute -right-3 -bottom-3 rounded-full bg-black" />
        <span className="font-type text-[0.75rem] tracking-[0.3em] whitespace-nowrap uppercase [writing-mode:vertical-rl] rotate-180">
          {copy.crew.admit}
        </span>
      </div>

      <div className="relative z-[1] flex flex-col p-6 sm:p-8">
        <Art
          name="stickerOfficial"
          sizes="(min-width: 1326px) 9.8vw, 130px"
          className="pointer-events-none absolute -top-3 -right-3 h-auto w-[6.5rem] -rotate-12 mix-blend-multiply opacity-90"
        />

        <p className="font-type text-[0.75rem] tracking-[0.14em] uppercase">{copy.crew.kicker}</p>
        <RevealText
          id="crew-title"
          lines={copy.crew.title}
          className="mt-3 font-display text-[clamp(2.75rem,6vw,4rem)] leading-[0.9] font-extrabold tracking-[-0.01em] uppercase"
        />
        <p className="mt-3 max-w-[40ch] text-[0.9375rem] leading-relaxed">{copy.crew.lead}</p>

        {done ? (
          <p role="status" className="mt-6 border-2 border-[#14110a] px-4 py-4 text-[0.9375rem] font-semibold">
            {state.message}
          </p>
        ) : (
          <form action={action} className="mt-6" noValidate>
            <label htmlFor="crew-email" className="font-type text-[0.75rem] tracking-[0.14em] uppercase">
              {copy.crew.emailLabel}
            </label>
            <input
              id="crew-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder={copy.crew.emailPlaceholder}
              aria-describedby="crew-msg"
              aria-invalid={state.status === "error"}
              className="mt-1 h-12 w-full border-0 border-b-[0.1875rem] border-[#14110a] bg-transparent px-0 text-[1.125rem] font-medium placeholder:text-[#14110a]/45 focus:border-b-[0.3125rem] focus:outline-none"
            />
            {/* Honeypot: real people never see or fill it. */}
            <div aria-hidden="true" className="absolute -left-[624.9375rem] h-0 w-0 overflow-hidden">
              <label>
                {copy.crew.honeypot}
                <input type="text" name="company" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <Button type="submit" variant="ink" size="lg" disabled={pending} className="mt-4 w-full sm:w-auto">
              {pending ? copy.crew.submitting : copy.crew.submit}
            </Button>
            <p
              id="crew-msg"
              role={state.status === "error" ? "alert" : "status"}
              className={`mt-3 min-h-[1.25rem] text-[0.8125rem] ${state.status === "error" ? "font-semibold text-[#8f1010]" : "text-[#14110a]/70"}`}
            >
              {state.message || copy.crew.consent}
            </p>
          </form>
        )}

        <p className="mt-auto pt-6 font-type text-[0.75rem] tracking-[0.06em] uppercase">
          {copy.crew.listen}{" "}
          <a
            href={SIRIUSXM_STEPHEN_A}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-white"
          >
            {copy.crew.listenLink}
            <span className="sr-only"> {copy.a11y.openInNewTab}</span>
          </a>
        </p>
      </div>
    </section>
  );
}
