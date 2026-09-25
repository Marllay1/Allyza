"use client";

// http(s):// or www. links; trailing punctuation belongs to the sentence, not to the link.
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']*[^\s<>"'.,;:!?)\]}])/gi;

/** Message text with links made tappable. Only http(s) links are ever created. */
export function Linkified({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const shown = m[0];
    out.push(
      <a key={at} href={/^www\./i.test(shown) ? `https://${shown}` : shown} target="_blank" rel="noopener noreferrer"
        className="underline underline-offset-2 decoration-current/50 break-all" onClick={(e) => e.stopPropagation()}>{shown}</a>,
    );
    last = at + shown.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
