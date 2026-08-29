import { useRef, useEffect, useCallback, type ReactNode } from 'react';

export interface CarouselItem {
  id: string;
  label: string;
  imageUrl?: string | null;
  fallback: ReactNode;
}

interface Props {
  items: CarouselItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
}

// Mobile-only horizontal picker used by Machines/Employees to switch which
// single item is shown as the "main" card above it. Direction-agnostic
// (uses getBoundingClientRect, not scrollLeft) so it behaves correctly
// under the app's RTL layout in every browser.
export default function MobileItemCarousel({ items, selectedId, onSelect, ariaLabel }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rafRef = useRef<number | null>(null);
  // True while a click-triggered smooth scroll is animating. While true,
  // handleScroll ignores the native scroll events the animation itself
  // fires, so onSelect isn't re-called for every intermediate item the
  // animation passes through on its way to the tapped one (that repeated
  // onSelect was rapidly swapping the whole main card's content, which is
  // what looked like a visual jump/bug). Manual swipe never sets this, so
  // it's unaffected.
  const suppressScrollSelectRef = useRef(false);
  const scrollEndFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSelectionFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;

    let closestId: string | null = null;
    let closestDistance = Infinity;
    for (const item of items) {
      const el = itemRefs.current[item.id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const itemCenter = rect.left + rect.width / 2;
      const distance = Math.abs(itemCenter - trackCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = item.id;
      }
    }

    if (closestId && closestId !== selectedId) {
      onSelect(closestId);
    }
  }, [items, selectedId, onSelect]);

  function handleScroll() {
    if (suppressScrollSelectRef.current) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateSelectionFromScroll);
  }

  function clearSuppression() {
    suppressScrollSelectRef.current = false;
    if (scrollEndFallbackRef.current !== null) {
      clearTimeout(scrollEndFallbackRef.current);
      scrollEndFallbackRef.current = null;
    }
  }

  // 'scrollend' fires once a smooth scroll animation actually settles; it's
  // the accurate signal to lift the suppression. Safari doesn't support it
  // yet, so handleItemClick also arms a fallback timeout below.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scrollend', clearSuppression);
    return () => track.removeEventListener('scrollend', clearSuppression);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (scrollEndFallbackRef.current !== null) clearTimeout(scrollEndFallbackRef.current);
    };
  }, []);

  // Horizontal-only centering, scoped strictly to the track's own
  // overflow-x — deliberately NOT Element.scrollIntoView(). scrollIntoView's
  // `block` (vertical) option walks up the ancestor chain looking for a
  // scrollable container to satisfy vertical visibility; since this track
  // lives inside a `position: fixed` bar, that walk can end up adjusting
  // the page's own vertical scroll instead of stopping at the track. That
  // was invisible while swiping (native touch-scroll never calls
  // scrollIntoView) but fired on every tap — exactly the "swipe is smooth,
  // tap jumps" split. Computing the delta from getBoundingClientRect and
  // applying it via scrollBy never touches any axis but this track's own.
  function centerItem(id: string, behavior: ScrollBehavior) {
    const track = trackRef.current;
    const el = itemRefs.current[id];
    if (!track || !el) return;
    const trackRect = track.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();
    const delta = (itemRect.left + itemRect.width / 2) - (trackRect.left + trackRect.width / 2);
    track.scrollBy({ left: delta, behavior });
  }

  // Center the initially-selected item on mount (instant, no animation).
  useEffect(() => {
    if (selectedId) centerItem(selectedId, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleItemClick(id: string) {
    onSelect(id);
    suppressScrollSelectRef.current = true;
    if (scrollEndFallbackRef.current !== null) clearTimeout(scrollEndFallbackRef.current);
    scrollEndFallbackRef.current = setTimeout(clearSuppression, 600);
    centerItem(id, 'smooth');
  }

  return (
    <div className="mobile-carousel" role="group" aria-label={ariaLabel}>
      <div className="mobile-carousel__track" ref={trackRef} onScroll={handleScroll}>
        {items.map(item => {
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              ref={el => { itemRefs.current[item.id] = el; }}
              className={`mobile-carousel__item${isSelected ? ' mobile-carousel__item--active' : ''}`}
              onClick={() => handleItemClick(item.id)}
              aria-pressed={isSelected}
            >
              <span className="mobile-carousel__avatar">
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.fallback}
              </span>
              <span className="mobile-carousel__label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
