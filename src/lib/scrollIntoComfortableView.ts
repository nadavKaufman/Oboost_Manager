interface ComfortableScrollOptions {
  /** Extra breathing room below the sticky top bar, in px. */
  topPadding?: number;
  /** Extra breathing room above the fixed mobile carousel (if present), in px. */
  bottomPadding?: number;
  /** 'auto' (default): center `el` within the safe band between the topbar
   *  and the carousel when it's short enough to fit, otherwise top-align.
   *  'top': always top-align, regardless of whether `el` would fit — used
   *  when opening a section, where landing right at a comfortably-cleared
   *  top edge is the goal, not a centered resting position. */
  align?: 'auto' | 'top';
}

// window.scrollBy/scrollTo silently clamp at the document's actual max
// scroll position — on a short page, a computed target beyond that is
// simply unreachable, no matter how the distance is computed. This grows
// the page's scrollable height by exactly the missing amount (nothing, if
// there's already enough room) with a temporary spacer, appended right
// before the scroll and removed again as soon as it settles — so it never
// lingers as visible empty space below the content afterward, unlike a
// permanent CSS margin sized for a worst case that's rarely actually
// needed (which is what used to reserve this room, and was itself the bug:
// a full extra viewport of blank space stayed below the Add Machine/
// Employee form for as long as it was open).
function ensureScrollRoom(targetScrollY: number) {
  const maxScrollY = document.documentElement.scrollHeight - window.innerHeight;
  if (targetScrollY <= maxScrollY) return;

  const spacer = document.createElement('div');
  spacer.style.height = `${Math.ceil(targetScrollY - maxScrollY)}px`;
  spacer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(spacer);

  const cleanup = () => {
    spacer.remove();
    window.removeEventListener('scrollend', cleanup);
  };
  // 'scrollend' fires once the smooth scroll actually settles — the
  // accurate signal to remove the spacer. Safari doesn't support it yet,
  // so a fallback timeout (comfortably longer than any smooth-scroll
  // duration here) guarantees cleanup regardless.
  window.addEventListener('scrollend', cleanup, { once: true });
  setTimeout(cleanup, 700);
}

// Mobile pages (Machines/Employees) have two pieces of fixed chrome that a
// plain Element.scrollIntoView() knows nothing about: the sticky .topbar at
// the top, and the fixed .mobile-carousel bar at the bottom. This measures
// both live (rather than duplicating their heights as constants, which
// could silently drift from the real CSS — .mobile-carousel isn't even
// rendered outside the mobile breakpoint, so it naturally measures 0
// wherever it's absent) and scrolls to keep `el` clear of both — centered
// in the safe band between them when it's short enough to fit and
// align !== 'top' (e.g. the collapsed Add Machine/Employee button after
// cancelling), otherwise top-aligned with headroom (e.g. the freshly
// opened form, which is usually taller than the available space).
export function scrollIntoComfortableView(el: HTMLElement, options: ComfortableScrollOptions = {}) {
  const topbarH = document.querySelector('.topbar')?.getBoundingClientRect().height ?? 0;
  const carouselH = document.querySelector('.mobile-carousel')?.getBoundingClientRect().height ?? 0;
  const availableTop = topbarH + (options.topPadding ?? 20);
  const availableBottom = window.innerHeight - carouselH - (options.bottomPadding ?? 20);
  const availableHeight = availableBottom - availableTop;

  const rect = el.getBoundingClientRect();
  const shouldCenter = options.align !== 'top' && rect.height <= availableHeight;
  const targetTop = shouldCenter
    ? availableTop + (availableHeight - rect.height) / 2
    : availableTop;

  const delta = rect.top - targetTop;
  ensureScrollRoom(window.scrollY + delta);
  window.scrollBy({ top: delta, behavior: 'smooth' });
}
