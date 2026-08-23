import { useCallback, useLayoutEffect, useState } from "react";

const EMPTY_SIZE = { width: 0, height: 0 };

/**
 * Measures a DOM element and re-measures on resize.
 *
 * Uses a callback ref rather than useRef: ChartPanel returns early for
 * unconfigured slots, so the measured node is not attached on the first
 * render. A useRef + mount-only effect would never see the node arrive and
 * would silently stay on the fallback size forever.
 *
 * Deliberately does NOT gate rendering: consumers fall back to a nominal size
 * when the measurement is 0, so a missing or late ResizeObserver degrades to a
 * scaled chart rather than a blank panel. The previous implementation gated on
 * requestAnimationFrame, which left a correct-looking title above an empty box
 * in any context where rAF does not fire.
 */
export default function useElementSize() {
  const [node, setNode] = useState(null);
  const [size, setSize] = useState(EMPTY_SIZE);

  const ref = useCallback((element) => {
    setNode(element ?? null);
  }, []);

  useLayoutEffect(() => {
    if (!node) {
      return undefined;
    }

    const measure = () => {
      const width = Math.round(node.clientWidth);
      const height = Math.round(node.clientHeight);

      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, size];
}
