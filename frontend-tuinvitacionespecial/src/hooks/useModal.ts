import { useState, useEffect, useCallback, useRef } from 'react';

let activeScrollLocks = 0;
let savedBodyOverflow: string | null = null;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (activeScrollLocks === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  activeScrollLocks += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined' || activeScrollLocks === 0) return;
  activeScrollLocks -= 1;
  if (activeScrollLocks === 0) {
    document.body.style.overflow = savedBodyOverflow ?? '';
    savedBodyOverflow = null;
  }
}

export interface UseModalReturn {
  isOpen: boolean;
  mounted: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  focusDialog: () => void;
  dialogRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook headless de comportamiento modal reutilizable en cualquier sección o plantilla.
 * Gestiona estado SSR-safe (`mounted`), cierre con Escape, bloqueo seguro de scroll,
 * focus trap (`Tab` / `Shift+Tab`) y restauración de foco de teclado.
 */
export function useModal(initialOpen = false): UseModalReturn {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [mounted, setMounted] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function captureActiveElement() {
    if (typeof document !== 'undefined') {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
  }

  const open = useCallback(() => {
    captureActiveElement();
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        captureActiveElement();
      }
      return !prev;
    });
  }, []);

  const focusDialog = useCallback(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }

      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (el) =>
          el.tabIndex >= 0 &&
          (el.offsetParent !== null || el === document.activeElement)
      );

      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === dialog || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    lockBodyScroll();
    window.addEventListener('keydown', handleKeyDown);

    const frameId = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();

      const prevElement = previousFocusRef.current;
      if (prevElement && prevElement.isConnected) {
        prevElement.focus();
      }
    };
  }, [isOpen, mounted]);

  return {
    isOpen,
    mounted,
    open,
    close,
    toggle,
    focusDialog,
    dialogRef,
  };
}
