import { useEffect } from 'react';

let activeLocks = 0;
let originalOverflow = '';
let originalPosition = '';
let originalWidth = '';
let originalTop = '';
let scrollY = 0;

/**
 * Robust scroll lock that prevents background scrolling on iOS Safari, Android, and Desktop
 * when any modal, popup, or bottom-sheet is open.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    if (activeLocks === 0) {
      scrollY = window.scrollY;
      originalOverflow = document.body.style.overflow;
      originalPosition = document.body.style.position;
      originalWidth = document.body.style.width;
      originalTop = document.body.style.top;

      // Lock scroll while preserving current viewport position
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';
    }
    activeLocks++;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = originalWidth;
        document.body.style.top = originalTop;
        document.documentElement.style.overflow = '';
        window.scrollTo(0, scrollY);
      }
    };
  }, [isLocked]);
}
