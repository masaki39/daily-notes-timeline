import { TFile } from 'obsidian';
import { toISODateKey } from '../data';
import { ensureScrollable } from '../scroll/ensure-scrollable';
import { loadNext, loadPrevious } from '../scroll/loader';
import { getListTopOffset, scrollElementToOffset } from '../scroll/scroll-utils';
import { getTopVisibleDateKey, getTopVisibleOffset } from '../scroll/visibility';

type ScrollManagerOptions = {
    contentEl: HTMLElement;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    getNoteFiles: () => TFile[];
    getStartIndex: () => number;
    setStartIndex: (value: number) => void;
    getEndIndex: () => number;
    setEndIndex: (value: number) => void;
    getPageSize: () => number;
    getMaxRendered: () => number;
    renderNote: (file: TFile, position: 'append' | 'prepend', noteIndex: number) => Promise<void>;
    hasFilteredContent: (file: TFile) => Promise<boolean>;
    onRemoveRenderedNote: (element: HTMLElement) => void;
    resolveDateKey: (file: TFile) => string | null;
    onTopVisibleDateChange: (dateKey: string) => void;
    debugLog: (message: string, details?: Record<string, unknown>) => void;
};

export class TimelineScrollManager {
    private contentEl: HTMLElement;
    private registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    private getNoteFiles: () => TFile[];
    private getStartIndex: () => number;
    private setStartIndex: (value: number) => void;
    private getEndIndex: () => number;
    private setEndIndex: (value: number) => void;
    private getPageSize: () => number;
    private getMaxRendered: () => number;
    private renderNote: (file: TFile, position: 'append' | 'prepend', noteIndex: number) => Promise<void>;
    private hasFilteredContent: (file: TFile) => Promise<boolean>;
    private onRemoveRenderedNote: (element: HTMLElement) => void;
    private resolveDateKey: (file: TFile) => string | null;
    private onTopVisibleDateChange: (dateKey: string) => void;
    private debugLog: (message: string, details?: Record<string, unknown>) => void;
    private scrollerEl: HTMLDivElement | null = null;
    private listEl: HTMLDivElement | null = null;
    private isLoading = false;
    private topVisibleRaf: number | null = null;
    private currentTopDateKey: string | null = null;

    constructor(options: ScrollManagerOptions) {
        this.contentEl = options.contentEl;
        this.registerDomEvent = options.registerDomEvent;
        this.getNoteFiles = options.getNoteFiles;
        this.getStartIndex = options.getStartIndex;
        this.setStartIndex = options.setStartIndex;
        this.getEndIndex = options.getEndIndex;
        this.setEndIndex = options.setEndIndex;
        this.getPageSize = options.getPageSize;
        this.getMaxRendered = options.getMaxRendered;
        this.renderNote = options.renderNote;
        this.hasFilteredContent = options.hasFilteredContent;
        this.onRemoveRenderedNote = options.onRemoveRenderedNote;
        this.resolveDateKey = options.resolveDateKey;
        this.onTopVisibleDateChange = options.onTopVisibleDateChange;
        this.debugLog = options.debugLog;
    }

    buildScroller() {
        this.scrollerEl = this.contentEl.createDiv('daily-notes-timeline-scroll');
        this.listEl = this.scrollerEl.createDiv('daily-notes-timeline-list');
        this.registerDomEvent(this.scrollerEl, 'scroll', () => this.onScroll());
    }

    getScrollerEl(): HTMLDivElement | null {
        return this.scrollerEl;
    }

    getListEl(): HTMLDivElement | null {
        return this.listEl;
    }

    getTopVisibleDateKey(): string | null {
        return getTopVisibleDateKey(this.scrollerEl, this.listEl);
    }

    getTopVisibleOffset(): number | null {
        return getTopVisibleOffset(this.scrollerEl, this.listEl);
    }

    getListTopOffset(): number {
        return getListTopOffset(this.scrollerEl, this.listEl);
    }

    async ensureScrollable(): Promise<void> {
        if (!this.scrollerEl || this.isLoading || this.getNoteFiles().length === 0) {
            return;
        }
        await ensureScrollable({
            scrollerEl: this.scrollerEl,
            getStartIndex: () => this.getStartIndex(),
            getEndIndex: () => this.getEndIndex(),
            getNoteFilesLength: () => this.getNoteFiles().length,
            loadNext: () => this.loadNext(),
            loadPrevious: () => this.loadPrevious(),
            scheduleTopVisibleUpdate: () => this.scheduleTopVisibleUpdate()
        });
    }

    scrollToTargetIndex(targetIndex: number, offset: number) {
        const noteFiles = this.getNoteFiles();
        const targetKey = this.resolveDateKey(noteFiles[targetIndex]);
        this.debugLog('scrollToTargetIndex', { targetIndex, targetKey, offset });
        if (targetKey) {
            this.scrollToDateKey(targetKey, offset);
            this.scheduleScrollCorrection(targetKey, offset);
        } else {
            this.scrollToIndex(targetIndex);
        }
    }

    scheduleTopVisibleUpdate() {
        if (this.topVisibleRaf !== null) {
            return;
        }
        this.topVisibleRaf = window.requestAnimationFrame(() => {
            this.topVisibleRaf = null;
            this.updateTopVisibleDate();
        });
    }

    private async onScroll(): Promise<void> {
        if (!this.scrollerEl || this.isLoading || this.getNoteFiles().length === 0) {
            return;
        }
        const threshold = 200;
        const { scrollTop, scrollHeight, clientHeight } = this.scrollerEl;
        const remaining = scrollHeight - (scrollTop + clientHeight);

        if (scrollTop < threshold) {
            await this.loadPrevious();
        }
        if (remaining < threshold) {
            await this.loadNext();
        }
        this.scheduleTopVisibleUpdate();
    }

    private async loadPrevious(): Promise<void> {
        if (!this.listEl || this.getStartIndex() === 0 || this.isLoading) {
            return;
        }
        this.isLoading = true;
        const noteFiles = this.getNoteFiles();
        const { startIndex, endIndex } = await loadPrevious({
            listEl: this.listEl,
            noteFiles,
            pageSize: this.getPageSize(),
            maxRendered: this.getMaxRendered(),
            startIndex: this.getStartIndex(),
            endIndex: this.getEndIndex(),
            scrollerEl: this.scrollerEl,
            hasFilteredContent: (file) => this.hasFilteredContent(file),
            renderNote: (file, position, noteIndex) => this.renderNote(file, position, noteIndex),
            onRemove: (element) => this.onRemoveRenderedNote(element)
        });
        this.setStartIndex(startIndex);
        this.setEndIndex(endIndex);
        this.isLoading = false;
    }

    private async loadNext(): Promise<void> {
        if (!this.listEl || this.getEndIndex() >= this.getNoteFiles().length - 1 || this.isLoading) {
            return;
        }
        this.isLoading = true;
        const noteFiles = this.getNoteFiles();
        const { startIndex, endIndex } = await loadNext({
            listEl: this.listEl,
            noteFiles,
            pageSize: this.getPageSize(),
            maxRendered: this.getMaxRendered(),
            startIndex: this.getStartIndex(),
            endIndex: this.getEndIndex(),
            scrollerEl: this.scrollerEl,
            hasFilteredContent: (file) => this.hasFilteredContent(file),
            renderNote: (file, position, noteIndex) => this.renderNote(file, position, noteIndex),
            onRemove: (element) => this.onRemoveRenderedNote(element)
        });
        this.setStartIndex(startIndex);
        this.setEndIndex(endIndex);
        this.isLoading = false;
    }

    private updateTopVisibleDate() {
        let topDateKey = this.getTopVisibleDateKey();
        if (!topDateKey) {
            topDateKey = toISODateKey(new Date());
        }

        if (topDateKey === this.currentTopDateKey) {
            return;
        }
        this.currentTopDateKey = topDateKey;
        this.onTopVisibleDateChange(topDateKey);
    }

    private scrollToIndex(targetIndex: number) {
        if (!this.scrollerEl || !this.listEl) {
            return;
        }
        const selector = `[data-index="${targetIndex}"]`;
        const targetEl = this.listEl.querySelector(selector) as HTMLElement | null
            ?? (this.listEl.children[targetIndex - this.getStartIndex()] as HTMLElement | undefined);
        if (!targetEl) {
            return;
        }
        this.debugLog('scrollToIndex', { targetIndex, startIndex: this.getStartIndex() });
        requestAnimationFrame(() => {
            if (!this.scrollerEl) {
                return;
            }
            const offset = this.getListTopOffset();
            scrollElementToOffset(targetEl, this.scrollerEl, offset);
            this.scheduleTopVisibleUpdate();
        });
    }

    private scrollToDateKey(dateKey: string, offset: number) {
        if (!this.scrollerEl || !this.listEl) {
            return;
        }
        const targetEl = this.listEl.querySelector(`[data-date="${dateKey}"]`) as HTMLElement | null;
        if (!targetEl) {
            return;
        }
        this.debugLog('scrollToDateKey', { dateKey, offset });
        requestAnimationFrame(() => {
            scrollElementToOffset(targetEl, this.scrollerEl, offset);
            this.scheduleTopVisibleUpdate();
        });
    }

    private scheduleScrollCorrection(dateKey: string, offset: number) {
        window.requestAnimationFrame(() => {
            this.scrollToDateKey(dateKey, offset);
            window.setTimeout(() => {
                this.scrollToDateKey(dateKey, offset);
            }, 80);
        });
    }
}
