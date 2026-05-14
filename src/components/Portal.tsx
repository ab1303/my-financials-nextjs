'use client';

/**
 * Portal — renders children into a DOM node that lives outside the React
 * component tree (appended to <body>), using ReactDOM.createPortal.
 *
 * Benefits
 * --------
 * • Escapes ancestor overflow:hidden / clip-path / transform stacking contexts
 *   that would otherwise clip or re-layer fixed/absolute-positioned overlays.
 * • Eliminates z-index wars caused by nested stacking contexts in the page tree.
 * • SSR-safe: returns null on the server and during the first render pass; the
 *   portal container is created lazily inside useEffect (browser-only).
 *
 * Props
 * -----
 * children     — Content to portal into the container.
 * containerId  — id of the target <div> appended to <body>.
 *                Defaults to "portal-root". Multiple <Portal> instances sharing
 *                the same id reuse the same container element.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface PortalProps {
  /** React subtree to render inside the portal container. */
  children: ReactNode;
  /**
   * HTML id for the container <div> that is appended to document.body.
   * Defaults to `"portal-root"`. Instances with the same id share one container.
   */
  containerId?: string;
}

export default function Portal({ children, containerId = 'portal-root' }: PortalProps) {
  // `mounted` gates the portal so it only renders in the browser.
  // During SSR and the initial hydration pass this component returns null,
  // which is safe because createPortal is browser-only.
  const [mounted, setMounted] = useState(false);

  // Keep a stable ref to the container element so we don't re-query the DOM
  // on every render after the initial mount.
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Find an existing container or create a new one.
    let container = document.getElementById(containerId);

    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    }

    containerRef.current = container;
    setMounted(true);

    return () => {
      // Only remove the container from the DOM when it has no remaining
      // children (i.e. this was the last Portal using this containerId).
      if (containerRef.current && containerRef.current.childNodes.length === 0) {
        containerRef.current.remove();
      }
    };
  }, [containerId]);

  // Not yet mounted (SSR / first pass) — render nothing.
  if (!mounted || !containerRef.current) return null;

  return createPortal(children, containerRef.current);
}
