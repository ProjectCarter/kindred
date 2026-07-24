import Image from "next/image";

type PhoneMockupProps = {
  /** Path to the screenshot inside /public. Swap this for a real app screenshot later. */
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

/**
 * A premium phone frame that wraps a replaceable screenshot.
 * To use a real screenshot, drop a 390×844 (or similar 9:19.5) image in
 * /public/screenshots and pass its path as `src`.
 */
export default function PhoneMockup({
  src,
  alt,
  className = "",
  priority = false,
}: PhoneMockupProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="relative mx-auto aspect-[9/19] w-[248px] rounded-[2.6rem] border border-ink/10 bg-[#0E0F14] p-2.5 shadow-lift dark:border-white/10 sm:w-[268px]">
        {/* Notch */}
        <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#0E0F14]" />
        <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-cream">
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes="268px"
            unoptimized
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}
