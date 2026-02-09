import { useEffect, useLayoutEffect, useRef, useState } from "react";

type AvatarOption = { src: string; alt: string };

type Props = {
  avatarSrc: string;
  setAvatarSrc: (src: string) => void;
  options: AvatarOption[];
};

export default function AvatarPicker({ avatarSrc, setAvatarSrc, options }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;

    const position = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setPos({
        top: window.scrollY + rect.bottom + 8,
        left: window.scrollX + rect.left - 8,
      });
    };

    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      const panel = panelRef.current;
      const btn = btnRef.current;
      const target = e.target as Node;

      if (!panel || !btn) return;
      if (panel.contains(target) || btn.contains(target)) return;

      setOpen(false);
      btn.focus();
    };

    const getFocusable = () => {
      const panel = panelRef.current;
      if (!panel) return [] as HTMLElement[];
      return Array.from(
        panel.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])')
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusable();
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("click", onDocClick, { capture: true });
    document.addEventListener("keydown", onKeyDown);

    // focus first option
    const focusables = getFocusable();
    focusables[0]?.focus();

    return () => {
      document.removeEventListener("click", onDocClick, { capture: true } as any);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (src: string) => {
    setAvatarSrc(src);
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="cluster" style={{ alignItems: "center" }}>
      <button
        ref={btnRef}
        id="avatarBtn"
        className="avatar-btn"
        aria-haspopup="true"
        aria-expanded={open ? "true" : "false"}
        aria-controls="avatarPicker"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <img id="avatarImg" src={avatarSrc} alt="Your avatar" />
      </button>

      <div
        ref={panelRef}
        id="avatarPicker"
        className={`avatar-picker${open ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatarPickerTitle"
        hidden={!open}
        style={{ top: pos.top, left: pos.left }}
      >
        <h3 id="avatarPickerTitle">Choose your avatar</h3>

        <div className="avatar-grid">
          {options.map((opt) => (
            <button
              key={opt.src}
              type="button"
              className="avatar-option"
              data-src={opt.src}
              onClick={(e) => {
                e.preventDefault();
                pick(opt.src);
              }}
            >
              <img src={opt.src} alt={opt.alt} />
            </button>
          ))}
        </div>

        <div className="avatar-actions">
          <button
            id="avatarCancel"
            className="btn btn-ghost"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              btnRef.current?.focus();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
