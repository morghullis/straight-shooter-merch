"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/* ---- WebGL ---- */

let webglCache: boolean | null = null;

/** True when the browser can create a WebGL context. Cached after the first probe. */
export function supportsWebGL(): boolean {
  if (webglCache === null) {
    try {
      const canvas = document.createElement("canvas");
      webglCache = Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}

const subscribeNever = () => () => {};

/** `assumeOnServer` is what the server render and the hydration pass see. */
export function useWebGL(assumeOnServer = false): boolean {
  return useSyncExternalStore(subscribeNever, supportsWebGL, () => assumeOnServer);
}

/* ---- Media queries ---- */

/** Live `window.matchMedia`. The server render and hydration use `assumeOnServer`. */
export function useMediaQuery(query: string, assumeOnServer = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => assumeOnServer,
  );
}

/* ---- Idle ---- */

/**
 * Flips to true once the page has finished loading and the browser is idle, so heavy lazy work
 * (the 3D chunk and models) never competes with the first paint, even when its section is
 * already near the top of the page.
 */
export function useAfterLoad(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let idle: number | undefined;
    let timer: number | undefined;
    const arm = () => {
      // Safari has no requestIdleCallback.
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => setReady(true), { timeout: 2500 });
      else timer = window.setTimeout(() => setReady(true), 300);
    };
    if (document.readyState === "complete") arm();
    else window.addEventListener("load", arm, { once: true });

    return () => {
      window.removeEventListener("load", arm);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return ready;
}
