import { useEffect, useState } from "react";
import { Copy, Check, X, Info } from "lucide-react";
import { ABOUT_MARKDOWN } from "@/lib/about-content";

export function AboutButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-amber hover:text-amber"
      >
        <Info className="size-3" />
        About
      </button>
      {open && <AboutDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(ABOUT_MARKDOWN);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = ABOUT_MARKDOWN;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-background/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block size-1.5 rounded-full bg-amber" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber">
              About Terminal One
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-amber hover:text-amber"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-7 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:border-amber hover:text-amber"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-foreground/90">
{ABOUT_MARKDOWN}
          </pre>
        </div>
        <div className="border-t border-border bg-background/60 px-5 py-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Developed &amp; designed by <span className="text-amber">Aaron Fernandes</span>
        </div>
      </div>
    </div>
  );
}
