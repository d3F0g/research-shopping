import type { Page } from "@playwright/test";

export async function stableComposerGeometry(page: Page, timeoutMs = 2000) {
  const viewport = page.viewportSize()!;
  return page.evaluate(async ({ viewport, timeoutMs }) => {
    const started = performance.now();
    let last = "";
    let stableSince = started;
    let samples = 0;
    while (true) {
      await new Promise<void>((resolve) => {
        const frame = requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
        const timer = setTimeout(() => { cancelAnimationFrame(frame); resolve(); }, 50);
      });
      const element = document.querySelector('[aria-label="Message"]');
      const rect = element?.getBoundingClientRect();
      const box = rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
      const documentWidth = document.documentElement.scrollWidth;
      const layoutViewport = { width: window.innerWidth, height: window.innerHeight };
      const fits = Boolean(box && box.width > 0 && box.height > 0 && box.x >= 0 && box.y >= 0 && box.y + box.height <= viewport.height && box.x + box.width <= viewport.width && documentWidth <= viewport.width && layoutViewport.width === viewport.width && layoutViewport.height === viewport.height);
      const signature = JSON.stringify({ box, documentWidth, layoutViewport });
      if (signature !== last) { last = signature; stableSince = performance.now(); samples = 0; }
      samples++;
      const stable = fits && samples >= 3 && performance.now() - stableSince >= 100;
      if (stable || performance.now() - started >= timeoutMs) return { stable, fits, samples, elapsedMs: Math.round(performance.now() - started), box, viewport, documentWidth, layoutViewport };
    }
  }, { viewport, timeoutMs });
}
