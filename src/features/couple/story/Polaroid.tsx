/* A digital keepsake, not a social-media post: warm paper, a slight tilt, a handwritten-feel caption. */
export function Polaroid({ src, alt = "", caption, sub, tilt = -1.5, className = "" }: { src?: string | null; alt?: string; caption: string; sub?: string; tilt?: number; className?: string }) {
  return (
    <figure
      className={`relative mx-auto w-full max-w-[19rem] rounded-[10px] bg-[#fffaf3] p-3 pb-5 text-[#3a2440] shadow-[0_18px_40px_-16px_rgb(20_8_40/0.55),0_2px_6px_rgb(20_8_40/0.12)] transition duration-500 hover:rotate-0 ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="aspect-square w-full overflow-hidden rounded-[4px] bg-[#efe3ea]">
        {src ? <img src={src} alt={alt} loading="lazy" className="size-full object-cover" /> : <div className="size-full animate-pulse" />}
      </div>
      <figcaption className="pt-3 px-1 text-center">
        <span className="block font-display italic text-xl leading-tight">{caption}</span>
        {sub && <span className="block text-xs tracking-wide text-[#8a6d92] mt-1">{sub}</span>}
      </figcaption>
    </figure>
  );
}
