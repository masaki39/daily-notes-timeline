export type TopVisibleElement = { element: HTMLElement; rect: DOMRect; scrollTop: number };

export function getTopVisibleElement(scrollerEl: HTMLElement, listEl: HTMLElement): TopVisibleElement | null {
    const scrollRect = scrollerEl.getBoundingClientRect();
    for (const child of Array.from(listEl.children)) {
        const element = child as HTMLElement;
        const rect = element.getBoundingClientRect();
        if (rect.bottom > scrollRect.top + 1) {
            return { element, rect, scrollTop: scrollRect.top };
        }
    }
    return null;
}

export function getAnchorOffset(anchor: HTMLElement | null | undefined, scrollerEl: HTMLElement | null): number | null {
    if (!anchor || !scrollerEl) {
        return null;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const scrollRect = scrollerEl.getBoundingClientRect();
    return anchorRect.top - scrollRect.top;
}

export function restoreAnchorOffset(anchor: HTMLElement | null | undefined, previousOffset: number | null, scrollerEl: HTMLElement | null) {
    if (!anchor || previousOffset === null || !scrollerEl) {
        return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    const scrollRect = scrollerEl.getBoundingClientRect();
    const currentOffset = anchorRect.top - scrollRect.top;
    const delta = currentOffset - previousOffset;
    if (delta !== 0) {
        scrollerEl.scrollTop += delta;
    }
}

export function scrollElementToOffset(targetEl: HTMLElement, scrollerEl: HTMLElement | null, offset: number) {
    if (!scrollerEl) {
        return;
    }
    const scrollerRect = scrollerEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const delta = targetRect.top - scrollerRect.top - offset;
    if (delta !== 0) {
        scrollerEl.scrollTop += delta;
    }
}

export function getListTopOffset(scrollerEl: HTMLElement | null, listEl: HTMLElement | null): number {
    if (!scrollerEl || !listEl) {
        return 0;
    }
    const listRect = listEl.getBoundingClientRect();
    const scrollerRect = scrollerEl.getBoundingClientRect();
    const rawOffset = listRect.top - scrollerRect.top;
    const paddingTop = Number.parseFloat(window.getComputedStyle(scrollerEl).paddingTop || '0') || 0;
    const offset = rawOffset - paddingTop;
    return Number.isFinite(offset) ? Math.max(0, offset) : 0;
}
