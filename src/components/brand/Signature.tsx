/**
 * Gold handwritten signature in the hero, with the crossbar flourish running off to
 * the right. It is "written on" with a left-to-right wipe (see .anim-sig).
 */
export function Signature({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none relative select-none ${className}`}>
      <div className="anim-sig relative" style={{ "--d": 1050 } as React.CSSProperties}>
        <span className="block font-script text-[4.8125rem] leading-none whitespace-nowrap text-[#e8a92e]">
          {text}
        </span>
        {/* long crossbar through the "A." */}
        <span className="absolute top-[2.6875rem] left-[10.0625rem] h-px w-[4.8125rem] bg-[#e8a92e]" />
      </div>
    </div>
  );
}
