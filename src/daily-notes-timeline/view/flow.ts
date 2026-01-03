import { TFile } from 'obsidian';
import { toISODateKey } from '../data';

export type TimelineFlowContext = {
    getListEl: () => HTMLDivElement | null;
    getScrollerEl: () => HTMLDivElement | null;
    getNoteFiles: () => TFile[];
    setNoteFiles: (files: TFile[]) => void;
    getStartIndex: () => number;
    setStartIndex: (value: number) => void;
    getEndIndex: () => number;
    setEndIndex: (value: number) => void;
    getPageSize: () => number;
    clearFilteredContentCache: () => void;
    collectDailyNoteFiles: () => TFile[];
    getInitialTargetIndex: () => Promise<number>;
    getTopVisibleDateKey: () => string | null;
    getTopVisibleOffset: () => number | null;
    clearRenderedNotes: () => void;
    findIndexByDateKey: (dateKey: string) => number;
    hasFilteredContent: (file: TFile) => Promise<boolean>;
    findNearestIndexWithContent: (dateKey: string) => Promise<number>;
    renderRange: (start: number, end: number) => Promise<void>;
    getListTopOffset: () => number;
    scrollToTargetIndex: (targetIndex: number, offset: number) => void;
    ensureScrollable: () => Promise<void>;
    scheduleTopVisibleUpdate: () => void;
    debugLog: (message: string, details?: Record<string, unknown>) => void;
};

export async function refreshTimeline(
    ctx: TimelineFlowContext,
    options: { preserveScroll?: boolean; alignTop?: boolean; clearFilteredCache?: boolean } = {}
): Promise<void> {
    const listEl = ctx.getListEl();
    if (!listEl) {
        return;
    }
    const preserveScroll = options.preserveScroll ?? false;
    const alignTop = options.alignTop ?? false;
    const clearFilteredCache = options.clearFilteredCache ?? true;
    const anchorKey = preserveScroll ? ctx.getTopVisibleDateKey() : null;
    const anchorOffset = preserveScroll && !alignTop ? ctx.getTopVisibleOffset() : null;
    ctx.debugLog('refresh:start', { preserveScroll, alignTop, anchorKey, anchorOffset, clearFilteredCache });
    if (clearFilteredCache) {
        ctx.clearFilteredContentCache();
    }
    ctx.setNoteFiles(ctx.collectDailyNoteFiles());
    ctx.clearRenderedNotes();
    listEl.empty();
    ctx.setStartIndex(0);
    ctx.setEndIndex(-1);

    const noteFiles = ctx.getNoteFiles();
    if (noteFiles.length === 0) {
        listEl.createDiv({ text: 'No daily notes found.', cls: 'daily-notes-timeline-empty' });
        return;
    }

    if (preserveScroll && anchorKey) {
        const anchorIndex = ctx.findIndexByDateKey(anchorKey);
        let targetIndex = -1;
        if (anchorIndex !== -1 && await ctx.hasFilteredContent(noteFiles[anchorIndex])) {
            targetIndex = anchorIndex;
        } else {
            targetIndex = await ctx.findNearestIndexWithContent(anchorKey);
        }
        if (targetIndex !== -1) {
            const start = Math.max(0, targetIndex - ctx.getPageSize());
            const end = Math.min(noteFiles.length - 1, targetIndex + ctx.getPageSize());
            await ctx.renderRange(start, end);
            if (listEl.children.length === 0) {
                listEl.createDiv({ text: 'No results.', cls: 'daily-notes-timeline-empty' });
                return;
            }
            const offset = alignTop ? ctx.getListTopOffset() : (anchorOffset ?? 0);
            ctx.debugLog('refresh:scroll-preserve', { targetIndex, start, end, offset });
            ctx.scrollToTargetIndex(targetIndex, offset);
            await ctx.ensureScrollable();
            return;
        }
    }

    const targetIndex = await ctx.getInitialTargetIndex();
    ctx.debugLog('refresh:initial-target', { targetIndex, noteCount: noteFiles.length });
    if (targetIndex === -1) {
        listEl.createDiv({ text: 'No results.', cls: 'daily-notes-timeline-empty' });
        ctx.scheduleTopVisibleUpdate();
        return;
    }
    const start = Math.max(0, targetIndex - ctx.getPageSize());
    const end = Math.min(noteFiles.length - 1, targetIndex + ctx.getPageSize());
    await ctx.renderRange(start, end);
    if (listEl.children.length === 0) {
        listEl.createDiv({ text: 'No results.', cls: 'daily-notes-timeline-empty' });
        return;
    }
    if (targetIndex !== -1) {
        const offset = ctx.getListTopOffset();
        ctx.debugLog('refresh:scroll-initial', { targetIndex, start, end, offset });
        ctx.scrollToTargetIndex(targetIndex, offset);
    } else {
        ctx.scheduleTopVisibleUpdate();
    }
    await ctx.ensureScrollable();
}

export async function scrollToToday(ctx: TimelineFlowContext): Promise<void> {
    const listEl = ctx.getListEl();
    if (!listEl) {
        return;
    }
    ctx.debugLog('scrollToToday:start');
    ctx.setNoteFiles(ctx.collectDailyNoteFiles());
    ctx.clearRenderedNotes();
    listEl.empty();
    ctx.setStartIndex(0);
    ctx.setEndIndex(-1);

    const noteFiles = ctx.getNoteFiles();
    if (noteFiles.length === 0) {
        listEl.createDiv({ text: 'No daily notes found.', cls: 'daily-notes-timeline-empty' });
        return;
    }

    const targetIndex = await ctx.getInitialTargetIndex();
    if (targetIndex === -1) {
        listEl.createDiv({ text: 'No results.', cls: 'daily-notes-timeline-empty' });
        return;
    }

    const start = Math.max(0, targetIndex - ctx.getPageSize());
    const end = Math.min(noteFiles.length - 1, targetIndex + ctx.getPageSize());
    await ctx.renderRange(start, end);
    if (listEl.children.length === 0) {
        listEl.createDiv({ text: 'No results.', cls: 'daily-notes-timeline-empty' });
        return;
    }
    const offset = ctx.getListTopOffset();
    ctx.debugLog('scrollToToday:scroll', { targetIndex, start, end, offset });
    ctx.scrollToTargetIndex(targetIndex, offset);
}

export async function jumpToDateKey(ctx: TimelineFlowContext, dateKey: string): Promise<void> {
    const listEl = ctx.getListEl();
    if (!listEl) {
        return;
    }
    const noteFiles = ctx.getNoteFiles().length > 0 ? ctx.getNoteFiles() : ctx.collectDailyNoteFiles();
    if (noteFiles.length === 0) {
        return;
    }
    ctx.setNoteFiles(noteFiles);
    ctx.clearRenderedNotes();
    const targetIndex = await ctx.findNearestIndexWithContent(dateKey);
    if (targetIndex === -1) {
        listEl.empty();
        listEl.createDiv({ text: 'No results.', cls: 'daily-notes-timeline-empty' });
        return;
    }
    const start = Math.max(0, targetIndex - ctx.getPageSize());
    const end = Math.min(noteFiles.length - 1, targetIndex + ctx.getPageSize());
    await ctx.renderRange(start, end);
    if (listEl.children.length === 0) {
        listEl.createDiv({ text: 'No results.', cls: 'daily-notes-timeline-empty' });
        return;
    }
    const offset = ctx.getListTopOffset();
    ctx.scrollToTargetIndex(targetIndex, offset);
}
