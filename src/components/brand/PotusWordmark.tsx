import { StarIcon } from "@/components/ui/Icons";

/** "P★O★T★U★S" lock-up with the "Politics of the United States" tagline. */
export function PotusWordmark({ className = "" }: { className?: string }) {
  const letters = ["P", "O", "T", "U", "S"];

  return (
    <div className={`inline-block w-[7.0625rem] ${className}`}>
      <h3
        aria-label="POTUS"
        className="flex items-center justify-between font-serif text-[1.53125rem] leading-[1] font-black text-white"
      >
        {letters.map((l, i) => (
          <span key={l + i} className="flex items-center" aria-hidden="true">
            {l}
            {i < letters.length - 1 && <StarIcon size={6.5} className="mx-[1px]" />}
          </span>
        ))}
      </h3>
      <p className="mt-[0.1875rem] font-sans text-[0.5125rem] leading-[1.1] font-medium text-white [text-align-last:justify]">
        Politics of the United States
      </p>
    </div>
  );
}
