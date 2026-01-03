import { getTopVisibleElement } from './scroll-utils';

export function getTopVisibleDateKey(scrollerEl: HTMLDivElement | null, listEl: HTMLDivElement | null): string | null {
    if (!scrollerEl || !listEl) {
        return null;
    }
    const top = getTopVisibleElement(scrollerEl, listEl);
    if (!top) {
        return null;
    }
    return top.element.dataset.date ?? null;
}

export function getTopVisibleOffset(scrollerEl: HTMLDivElement | null, listEl: HTMLDivElement | null): number | null {
    if (!scrollerEl || !listEl) {
        return null;
    }
    const top = getTopVisibleElement(scrollerEl, listEl);
    if (!top) {
        return null;
    }
    return top.rect.top - top.scrollTop;
}
