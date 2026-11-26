"use client";

import { useActionState, useRef, useState } from "react";

import { sendContact, type ContactState } from "@/app/contact-actions";
import { Button } from "@/components/ui/Button";
import { copy } from "@/config/copy";
import { cn } from "@/lib/cn";
import { MESSAGE_MAX, TOPICS } from "@/lib/contact/message";

const initial: ContactState = { status: "idle" };
const t = copy.contact;

const label = "font-type text-[0.6875rem] tracking-[0.14em] uppercase";
const line =
  "mt-1 w-full rounded-none border-0 border-b-[0.1875rem] border-[#14110a] bg-transparent px-0 text-[1.0625rem] font-medium placeholder:text-[#14110a]/40 focus:border-b-[0.3125rem] focus:outline-none aria-[invalid=true]:border-[#8f1010]";

/** The contact form, on the gold ticket of the popup and the season pass. */
export function ContactForm() {
  const [state, action, pending] = useActionState(sendContact, initial);
  const [count, setCount] = useState(0);
  const [round, setRound] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const wrong = state.status === "error" ? state.field : undefined;

  if (state.status === "sent" && round === 0) {
    return (
      <div role="status" className="flex flex-col py-6">
        <h2 className="font-display text-[clamp(2.75rem,8vw,3.75rem)] leading-[0.88] font-extrabold tracking-[-0.01em] uppercase">
          {t.sentTitle}
        </h2>
        <p className="mt-3 max-w-[44ch] text-[0.9375rem] leading-relaxed">
          {t.sentText(state.email)}
        </p>
        <Button
          variant="ink"
          size="lg"
          onClick={() => setRound(1)}
          className="mt-6 self-start"
        >
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={form}
      key={round}
      action={(data) => {
        setRound(0);
        action(data);
      }}
      noValidate
      className="grid gap-5 sm:grid-cols-2"
    >
      <div>
        <label htmlFor="contact-name" className={label}>
          {t.name}
        </label>
        <input
          id="contact-name"
          name="name"
          autoComplete="name"
          required
          maxLength={50}
          placeholder={t.namePlaceholder}
          aria-invalid={wrong === "name"}
          aria-describedby="contact-msg"
          className={cn(line, "h-12")}
        />
      </div>
      <div>
        <label htmlFor="contact-email" className={label}>
          {t.email}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder={t.emailPlaceholder}
          aria-invalid={wrong === "email"}
          aria-describedby="contact-msg"
          className={cn(line, "h-12")}
        />
      </div>
      <div>
        <label htmlFor="contact-topic" className={label}>
          {t.topic}
        </label>
        <select
          id="contact-topic"
          name="topic"
          required
          defaultValue="order"
          aria-invalid={wrong === "topic"}
          aria-describedby="contact-msg"
          className={cn(
            line,
            "h-12 cursor-pointer appearance-none bg-[length:0.75rem] bg-[right_0.25rem_center] bg-no-repeat pr-6",
          )}
          style={{
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, #14110a 50%), linear-gradient(-45deg, transparent 50%, #14110a 50%)",
            backgroundSize: "0.4rem 0.4rem, 0.4rem 0.4rem",
            backgroundPosition:
              "calc(100% - 0.65rem) 55%, calc(100% - 0.25rem) 55%",
          }}
        >
          {Object.entries(TOPICS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="contact-order" className={label}>
          {t.order}
        </label>
        <input
          id="contact-order"
          name="order"
          autoComplete="off"
          maxLength={21}
          placeholder={t.orderPlaceholder}
          aria-invalid={wrong === "order"}
          aria-describedby="contact-msg"
          className={cn(line, "h-12")}
        />
      </div>
      <div className="sm:col-span-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="contact-message" className={label}>
            {t.message}
          </label>
          <span
            aria-hidden="true"
            className="font-type text-[0.6875rem] text-[#14110a]/60"
          >
            {count}/{MESSAGE_MAX}
          </span>
        </div>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={MESSAGE_MAX}
          placeholder={t.messagePlaceholder}
          onChange={(e) => setCount(e.target.value.length)}
          aria-invalid={wrong === "message"}
          aria-describedby="contact-msg"
          className={cn(line, "min-h-[9rem] resize-y py-2 leading-relaxed")}
        />
      </div>

      {/* Honeypot, a box nobody sees (browsers fill text fields in by themselves). */}
      <div
        aria-hidden="true"
        className="absolute -left-[625rem] size-0 overflow-hidden"
      >
        <label>
          {t.trap}
          <input
            type="checkbox"
            name="extra"
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="sm:col-span-2">
        <p
          id="contact-msg"
          role={state.status === "error" ? "alert" : undefined}
          className={cn(
            "text-[0.8125rem] font-semibold text-[#8f1010]",
            state.status === "error" && "mb-3",
          )}
        >
          {state.status === "error" ? state.message : null}
        </p>
        <Button
          type="submit"
          variant="ink"
          size="lg"
          aria-disabled={pending}
          className={cn("w-full sm:w-auto", pending && "opacity-60")}
        >
          {pending ? t.sending : t.send}
        </Button>
      </div>
    </form>
  );
}
