import { TFile } from 'obsidian';
import { getAnchorOffset, restoreAnchorOffset } from './scroll-utils';

type LoaderOptions = {
    listEl: HTMLDivElement;
    noteFiles: TFile[];
    pageSize: number;
    maxRendered: number;
    startIndex: number;
    endIndex: number;
    scrollerEl: HTMLDivElement | null;
    hasFilteredContent: (file: TFile) => Promise<boolean>;
    renderNote: (file: TFile, position: 'append' | 'prepend', noteIndex: number) => Promise<void>;
    onRemove?: (element: HTMLElement) => void;
};

type LoaderResult = {
    startIndex: number;
    endIndex: number;
};

function getElementIndex(element: Element | null): number | null {
    if (!element) {
        return null;
    }
    const value = (element as HTMLElement).dataset.index;
    const parsed = value ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
}

function trimRendered(
    listEl: HTMLDivElement,
    maxRendered: number,
    direction: 'top' | 'bottom',
    scrollerEl: HTMLDivElement | null,
    startIndex: number,
    endIndex: number,
    onRemove?: (element: HTMLElement) => void
): LoaderResult {
    const currentCount = listEl.children.length;
    if (currentCount <= maxRendered) {
        return { startIndex, endIndex };
    }
    const removeCount = currentCount - maxRendered;
    if (removeCount <= 0) {
        return { startIndex, endIndex };
    }

    if (direction === 'top') {
        const anchor = listEl.children[removeCount] as HTMLElement | undefined;
        const anchorOffset = getAnchorOffset(anchor, scrollerEl);
        if (onRemove) {
            const removed = Array.from(listEl.children).slice(0, removeCount) as HTMLElement[];
            for (const element of removed) {
                onRemove(element);
            }
        }
        for (let i = 0; i < removeCount; i += 1) {
            listEl.firstElementChild?.remove();
        }
        const nextStartIndex = getElementIndex(listEl.firstElementChild) ?? startIndex;
        restoreAnchorOffset(anchor, anchorOffset, scrollerEl);
        return { startIndex: nextStartIndex, endIndex };
    }

    if (onRemove) {
        const removed = Array.from(listEl.children).slice(-removeCount) as HTMLElement[];
        for (const element of removed) {
            onRemove(element);
        }
    }
    for (let i = 0; i < removeCount; i += 1) {
        listEl.lastElementChild?.remove();
    }
    const nextEndIndex = getElementIndex(listEl.lastElementChild) ?? endIndex;
    return { startIndex, endIndex: nextEndIndex };
}

export async function loadPrevious(options: LoaderOptions): Promise<LoaderResult> {
    if (options.startIndex === 0) {
        return { startIndex: options.startIndex, endIndex: options.endIndex };
    }
    let newStart = options.startIndex;
    let renderedCount = 0;
    const targetCount = options.pageSize;
    const anchor = options.listEl.firstElementChild as HTMLElement | null;
    const anchorOffset = getAnchorOffset(anchor, options.scrollerEl);

    for (let i = options.startIndex - 1; i >= 0 && renderedCount < targetCount; i -= 1) {
        newStart = i;
        if (!await options.hasFilteredContent(options.noteFiles[i])) {
            continue;
        }
        await options.renderNote(options.noteFiles[i], 'prepend', i);
        renderedCount += 1;
    }

    const trimmed = trimRendered(
        options.listEl,
        options.maxRendered,
        'bottom',
        options.scrollerEl,
        newStart,
        options.endIndex,
        options.onRemove
    );
    restoreAnchorOffset(anchor, anchorOffset, options.scrollerEl);
    return trimmed;
}

export async function loadNext(options: LoaderOptions): Promise<LoaderResult> {
    if (options.endIndex >= options.noteFiles.length - 1) {
        return { startIndex: options.startIndex, endIndex: options.endIndex };
    }
    let newEnd = options.endIndex;
    let renderedCount = 0;
    const targetCount = options.pageSize;

    for (let i = options.endIndex + 1; i < options.noteFiles.length && renderedCount < targetCount; i += 1) {
        newEnd = i;
        if (!await options.hasFilteredContent(options.noteFiles[i])) {
            continue;
        }
        await options.renderNote(options.noteFiles[i], 'append', i);
        renderedCount += 1;
    }

    const trimmed = trimRendered(
        options.listEl,
        options.maxRendered,
        'top',
        options.scrollerEl,
        options.startIndex,
        newEnd,
        options.onRemove
    );
    return trimmed;
}
