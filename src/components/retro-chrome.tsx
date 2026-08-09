"use client";

import { useEffect, useState } from "react";

/** Client-only chrome for the retro skin: the live system clock and scroll-to-top button. */
export function RetroChrome() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const timeStr =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0") +
        ":" +
        now.getSeconds().toString().padStart(2, "0");
      const statusElement = document.querySelector(".system-status");
      if (statusElement) {
        statusElement.textContent = `SYS_UP: ${timeStr} | CPU: ${Math.floor(Math.random() * 20) + 5}%`;
      }
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      clearInterval(interval);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  if (!showScrollTop) return null;

  return (
    <button onClick={scrollToTop} className="scroll-to-top" aria-label="Scroll to top">
      <span className="scroll-arrow">↑</span>
    </button>
  );
}
