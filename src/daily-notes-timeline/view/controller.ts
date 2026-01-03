import { App, TFile } from 'obsidian';
import { DailyNotesTimelineSettings } from '../../settings';
import { DailyNotesConfig, getDateKeyFromFile, toISODateKey } from '../data';
import { TimelineFilterMode } from '../filters';
import { TimelineFlowContext, jumpToDateKey, refreshTimeline, scrollToToday } from './flow';
import { TimelineControllerUi } from './controller-ui';
import { TimelineNoteFilesCache } from './note-files-cache';
import { TimelineRenderManager } from './render-manager';
import { TimelineScrollManager } from './scroll-manager';
import { buildDateIndex, findNearestIndexWithContent, TimelineDateIndex } from './timeline-index';
import { appHasDailyNotesPluginLoaded, DEFAULT_DAILY_NOTE_FORMAT, getDailyNoteSettings } from 'obsidian-daily-notes-interface';

type ControllerOptions = {
    app: App;
    contentEl: HTMLElement;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    onSettingsChange?: () => Promise<void>;
    settings: DailyNotesTimelineSettings;
    debugLog: (message: string, details?: Record<string, unknown>) => void;
    markdownComponent: any;
    isLeafDeferred?: () => boolean;
};

export class DailyNotesTimelineController {
    private app: App;
    private contentEl: HTMLElement;
    private registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    private settings: DailyNotesTimelineSettings;
    private onSettingsChange: (() => Promise<void>) | null = null;
    private markdownComponent: any;
    private isLeafDeferred: (() => boolean) | null = null;
    private ui: TimelineControllerUi;
    private noteFiles: TFile[] = [];
    private noteFileIndex: TimelineDateIndex = { dateKeys: [], dateNumbers: [], indexByDateKey: new Map() };
    private startIndex = 0;
    private endIndex = -1;
    private refreshTimer: number | null = null;
    private readonly pageSize = 5;
    private readonly maxRendered = 20;
    private activeFilter: TimelineFilterMode = 'all';
    private headingFilterText = '';
    private searchQuery = '';
    private settingsSaveTimer: number | null = null;
    private debugLog: (message: string, details?: Record<string, unknown>) => void;
    private pendingRefresh = false;
    private pendingRefreshOptions: { preserveScroll?: boolean; alignTop?: boolean; clearFilteredCache?: boolean } | null = null;
    private dailyNotesConfig: DailyNotesConfig | null = null;
    private noteFilesCache: TimelineNoteFilesCache;
    private dateKeyCache = new Map<string, string | null>();
    private dateKeyCacheKey: string | null = null;
    private nearestIndexCache = new Map<string, number>();
    private noteFilesVersion = 0;
    private renderManager: TimelineRenderManager;
    private scrollManager: TimelineScrollManager;
    private refreshPromise: Promise<void> | null = null;
    private refreshQueue: { preserveScroll?: boolean; alignTop?: boolean; clearFilteredCache?: boolean } | null = null;

    constructor(options: ControllerOptions) {
        this.app = options.app;
        this.contentEl = options.contentEl;
        this.registerDomEvent = options.registerDomEvent;
        this.settings = options.settings;
        this.onSettingsChange = options.onSettingsChange ?? null;
        this.markdownComponent = options.markdownComponent;
        this.isLeafDeferred = options.isLeafDeferred ?? null;
        this.debugLog = options.debugLog;
        this.noteFilesCache = new TimelineNoteFilesCache({
            app: options.app,
            getConfig: () => this.getDailyNotesConfig(),
            isInDailyNotesFolder: (path, folder) => this.isInDailyNotesFolder(path, folder),
            getDateKeyFromFile: (file) => this.getDateKeyFromFile(file)
        });
        this.renderManager = new TimelineRenderManager({
            app: options.app,
            markdownComponent: options.markdownComponent,
            registerDomEvent: options.registerDomEvent,
            onOpenFile: (file, openInNewLeaf) => {
                void this.app.workspace.getLeaf(openInNewLeaf).openFile(file);
            },
            onOpenLink: (href, source, openInNewLeaf, isExternal) => {
                if (isExternal) {
                    const opened = window.open(href, '_blank', 'noopener');
                    if (opened) {
                        opened.opener = null;
                    }
                    return;
                }
                this.app.workspace.openLinkText(href, source, openInNewLeaf);
            },
            onToggleTask: async (targetFile, lineIndex, checked) => {
                await this.updateTaskLine(targetFile, lineIndex, checked);
            },
            resolveLinkSourcePath: (targetFile) => targetFile.path,
            resolveDateKey: (targetFile) => this.getDateKeyFromFile(targetFile),
            getActiveFilter: () => this.activeFilter,
            getHeadingFilterText: () => this.headingFilterText,
            getSearchQuery: () => this.searchQuery
        });
        this.ui = new TimelineControllerUi({
            contentEl: this.contentEl,
            settings: this.settings,
            registerDomEvent: this.registerDomEvent,
            onFilterChange: (mode) => {
                this.activeFilter = mode;
                this.settings.dailyNoteTimelineDefaultFilter = this.activeFilter;
                this.queueSettingsSave();
                this.ui.updateFilterUi(this.activeFilter);
                this.renderManager.clearFilteredContentCache();
                this.nearestIndexCache.clear();
                void this.refresh({ preserveScroll: true, alignTop: true, clearFilteredCache: true });
            },
            onHeadingInput: (value) => {
                this.headingFilterText = value;
                this.settings.dailyNoteTimelineFilterHeadingDefault = this.headingFilterText;
                this.queueSettingsSave();
                this.renderManager.clearFilteredContentCache();
                this.nearestIndexCache.clear();
                if (this.activeFilter === 'heading') {
                    this.scheduleRefresh({ preserveScroll: true, alignTop: true, clearFilteredCache: true });
                }
            },
            onSearchInput: (value) => {
                this.searchQuery = value.trim();
                this.nearestIndexCache.clear();
                this.scheduleRefresh({ preserveScroll: true, alignTop: true, clearFilteredCache: false });
            },
            onToday: () => {
                void this.scrollToToday();
            },
            onScrollToToday: () => {
                void this.scrollToToday();
            },
            onJumpToDateKey: (dateKey) => {
                void this.jumpToDateKey(dateKey);
            },
            onQueueSettingsSave: () => this.queueSettingsSave()
        });
        this.scrollManager = new TimelineScrollManager({
            contentEl: options.contentEl,
            registerDomEvent: options.registerDomEvent,
            getNoteFiles: () => this.noteFiles,
            getStartIndex: () => this.startIndex,
            setStartIndex: (value) => {
                this.startIndex = value;
            },
            getEndIndex: () => this.endIndex,
            setEndIndex: (value) => {
                this.endIndex = value;
            },
            getPageSize: () => this.pageSize,
            getMaxRendered: () => this.maxRendered,
            renderNote: (file, position, noteIndex) => this.renderNote(file, position, noteIndex),
            hasFilteredContent: (file) => this.hasFilteredContent(file),
            onRemoveRenderedNote: (element) => this.renderManager.cleanupRenderedNote(element),
            resolveDateKey: (file) => this.getDateKeyFromFile(file),
            onTopVisibleDateChange: (dateKey) => {
                this.ui.updateCalendarForDate(dateKey);
            },
            debugLog: (message, details) => this.debugLog(message, details)
        });
    }

    async onOpen(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass('daily-notes-timeline-root');
        this.activeFilter = this.settings.dailyNoteTimelineDefaultFilter ?? 'all';
        if (this.headingFilterText.trim().length === 0) {
            this.headingFilterText = this.settings.dailyNoteTimelineFilterHeadingDefault?.trim() ?? '';
        }
        this.ui.buildHeader(this.activeFilter, this.headingFilterText, this.searchQuery);
        this.buildScroller();
        this.buildCalendar();
        await this.refreshInternal({ preserveScroll: false });
    }

    async onClose(): Promise<void> {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.settingsSaveTimer !== null) {
            window.clearTimeout(this.settingsSaveTimer);
            this.settingsSaveTimer = null;
        }
        this.pendingRefresh = false;
        this.refreshQueue = null;
        this.renderManager.clearRenderedNotes();
        this.contentEl.empty();
    }

    setSettings(settings: DailyNotesTimelineSettings) {
        this.settings = settings;
        if (this.headingFilterText.trim().length === 0) {
            this.headingFilterText = this.settings.dailyNoteTimelineFilterHeadingDefault?.trim() ?? '';
            this.ui.setHeadingFilterText(this.headingFilterText);
        }
        this.scheduleRefresh({ preserveScroll: true, clearFilteredCache: true });
    }

    handleViewActivated(): Promise<void> {
        if (this.pendingRefresh) {
            this.pendingRefresh = false;
            const options = this.pendingRefreshOptions ?? { preserveScroll: true, clearFilteredCache: false };
            this.pendingRefreshOptions = null;
            return this.queueRefresh(options);
        }
        return this.queueRefresh({ preserveScroll: false, clearFilteredCache: false });
    }

    onActiveLeafChange(leaf: any, isCurrentLeaf: boolean) {
        if (isCurrentLeaf && this.pendingRefresh) {
            void this.handleViewActivated();
        }
    }

    private buildScroller() {
        this.scrollManager.buildScroller();
    }

    private buildCalendar() {
        this.ui.buildCalendar();
        this.ui.setCalendarVisible(this.settings.dailyNoteTimelineCalendarDefaultOpen ?? false);
    }

    private scheduleRefresh(options: { preserveScroll: boolean; alignTop?: boolean; clearFilteredCache?: boolean }) {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            if (!this.isViewActive()) {
                this.pendingRefresh = true;
                this.pendingRefreshOptions = {
                    preserveScroll: options.preserveScroll,
                    alignTop: options.alignTop,
                    clearFilteredCache: options.clearFilteredCache
                };
                return;
            }
            void this.refresh({
                preserveScroll: options.preserveScroll,
                alignTop: options.alignTop,
                clearFilteredCache: options.clearFilteredCache
            });
        }, 200);
    }

    private isViewActive(): boolean {
        if (this.isLeafDeferred?.()) {
            return false;
        }
        if (!this.contentEl?.isConnected) {
            return false;
        }
        return this.contentEl.offsetParent !== null || this.contentEl.getClientRects().length > 0;
    }

    private queueSettingsSave() {
        if (!this.onSettingsChange) {
            return;
        }
        if (this.settingsSaveTimer !== null) {
            window.clearTimeout(this.settingsSaveTimer);
        }
        this.settingsSaveTimer = window.setTimeout(() => {
            this.settingsSaveTimer = null;
            void this.onSettingsChange?.();
        }, 300);
    }

    private collectDailyNoteFiles(): TFile[] {
        return this.noteFilesCache.getFiles();
    }

    private async getInitialTargetIndex(): Promise<number> {
        const todayKey = toISODateKey(new Date());
        return await this.findNearestIndexWithContent(todayKey);
    }

    private async refresh(options: { preserveScroll?: boolean; alignTop?: boolean; clearFilteredCache?: boolean } = {}): Promise<void> {
        await this.queueRefresh(options);
    }

    private async refreshInternal(options: { preserveScroll?: boolean; alignTop?: boolean; clearFilteredCache?: boolean } = {}): Promise<void> {
        await refreshTimeline(this.getFlowContext(), options);
    }

    private async queueRefresh(options: { preserveScroll?: boolean; alignTop?: boolean; clearFilteredCache?: boolean } = {}): Promise<void> {
        if (this.refreshPromise) {
            this.refreshQueue = options;
            return this.refreshPromise;
        }
        this.refreshPromise = this.refreshInternal(options)
            .finally(() => {
                this.refreshPromise = null;
            });
        await this.refreshPromise;
        if (this.refreshQueue) {
            const next = this.refreshQueue;
            this.refreshQueue = null;
            await this.queueRefresh(next);
        }
    }

    private async renderRange(start: number, end: number): Promise<void> {
        const listEl = this.scrollManager.getListEl();
        if (!listEl) {
            return;
        }
        this.renderManager.clearRenderedNotes();
        listEl.empty();
        this.startIndex = start;
        this.endIndex = end;
        for (let i = start; i <= end; i += 1) {
            await this.renderNote(this.noteFiles[i], 'append', i);
        }
        this.updateRenderedRangeFromDom();
    }

    private async renderNote(file: TFile, position: 'append' | 'prepend', noteIndex: number): Promise<void> {
        const listEl = this.scrollManager.getListEl();
        if (!listEl) {
            return;
        }
        await this.renderManager.renderNote(listEl, file, position, noteIndex);
    }

    private async updateTaskLine(file: TFile, lineIndex: number, checked: boolean): Promise<void> {
        await this.app.vault.process(file, (content) => {
            const lines = content.split('\n');
            if (lineIndex < 0 || lineIndex >= lines.length) {
                return content;
            }
            const line = lines[lineIndex];
            const updated = line.replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/, `$1${checked ? 'x' : ' '}$3`);
            if (updated === line) {
                return content;
            }
            lines[lineIndex] = updated;
            return lines.join('\n');
        });
        this.renderManager.invalidateFile(file.path);
    }

    private async scrollToToday(): Promise<void> {
        await scrollToToday(this.getFlowContext());
    }

    private updateRenderedRangeFromDom() {
        const listEl = this.scrollManager.getListEl();
        if (!listEl || listEl.children.length === 0) {
            return;
        }
        const first = listEl.firstElementChild as HTMLElement | null;
        const last = listEl.lastElementChild as HTMLElement | null;
        const firstIndex = first?.dataset.index ? Number(first.dataset.index) : Number.NaN;
        const lastIndex = last?.dataset.index ? Number(last.dataset.index) : Number.NaN;
        if (Number.isFinite(firstIndex)) {
            this.startIndex = firstIndex;
        }
        if (Number.isFinite(lastIndex)) {
            this.endIndex = lastIndex;
        }
    }

    private async jumpToDateKey(dateKey: string) {
        await jumpToDateKey(this.getFlowContext(), dateKey);
    }

    private async hasFilteredContent(file: TFile): Promise<boolean> {
        return await this.renderManager.hasFilteredContent(file);
    }

    private findIndexByDateKey(dateKey: string): number {
        return this.noteFileIndex.indexByDateKey.get(dateKey) ?? -1;
    }

    private async findNearestIndexWithContent(dateKey: string): Promise<number> {
        const cacheKey = this.getNearestIndexCacheKey(dateKey);
        const cached = this.nearestIndexCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const index = await findNearestIndexWithContent({
            files: this.noteFiles,
            index: this.noteFileIndex,
            targetDateKey: dateKey,
            hasFilteredContent: (file) => this.hasFilteredContent(file)
        });
        this.nearestIndexCache.set(cacheKey, index);
        return index;
    }

    private getFlowContext(): TimelineFlowContext {
        return {
            getListEl: () => this.scrollManager.getListEl(),
            getScrollerEl: () => this.scrollManager.getScrollerEl(),
            getNoteFiles: () => this.noteFiles,
            setNoteFiles: (files: TFile[]) => {
                this.noteFiles = files;
                this.noteFileIndex = buildDateIndex(files, (file) => this.getDateKeyFromFile(file));
                this.noteFilesVersion += 1;
                this.nearestIndexCache.clear();
            },
            getStartIndex: () => this.startIndex,
            setStartIndex: (value: number) => {
                this.startIndex = value;
            },
            getEndIndex: () => this.endIndex,
            setEndIndex: (value: number) => {
                this.endIndex = value;
            },
            getPageSize: () => this.pageSize,
            clearFilteredContentCache: () => {
                this.renderManager.clearFilteredContentCache();
            },
            clearRenderedNotes: () => this.renderManager.clearRenderedNotes(),
            collectDailyNoteFiles: () => this.collectDailyNoteFiles(),
            getInitialTargetIndex: () => this.getInitialTargetIndex(),
            getTopVisibleDateKey: () => this.scrollManager.getTopVisibleDateKey(),
            getTopVisibleOffset: () => this.scrollManager.getTopVisibleOffset(),
            findIndexByDateKey: (targetKey: string) => this.findIndexByDateKey(targetKey),
            hasFilteredContent: (file: TFile) => this.hasFilteredContent(file),
            findNearestIndexWithContent: (targetKey: string) => this.findNearestIndexWithContent(targetKey),
            renderRange: (start: number, end: number) => this.renderRange(start, end),
            getListTopOffset: () => this.scrollManager.getListTopOffset(),
            scrollToTargetIndex: (targetIndex: number, offset: number) => this.scrollManager.scrollToTargetIndex(targetIndex, offset),
            ensureScrollable: () => this.scrollManager.ensureScrollable(),
            scheduleTopVisibleUpdate: () => this.scrollManager.scheduleTopVisibleUpdate(),
            debugLog: (message: string, details?: Record<string, unknown>) => this.debugLog(message, details)
        };
    }

    private getDateKeyFromFile(file: TFile): string | null {
        const config = this.getDailyNotesConfig();
        if (!config) {
            return null;
        }
        const cacheKey = `${config.folder}::${config.format}`;
        if (this.dateKeyCacheKey !== cacheKey) {
            this.dateKeyCacheKey = cacheKey;
            this.dateKeyCache.clear();
        }
        if (this.dateKeyCache.has(file.path)) {
            return this.dateKeyCache.get(file.path) ?? null;
        }
        const key = getDateKeyFromFile(file, config);
        this.dateKeyCache.set(file.path, key);
        return key;
    }

    private getNearestIndexCacheKey(dateKey: string): string {
        const heading = this.headingFilterText.trim();
        const query = this.searchQuery.trim().toLowerCase();
        return `${this.noteFilesVersion}::${this.activeFilter}::${heading}::${query}::${dateKey}`;
    }

    private getDailyNotesConfig(): DailyNotesConfig | null {
        try {
            if (!appHasDailyNotesPluginLoaded()) {
                this.dailyNotesConfig = null;
                return null;
            }
            const settings = getDailyNoteSettings();
            const folder = this.normalizeFolderPath(settings?.folder ?? '');
            const format = settings?.format?.trim() || DEFAULT_DAILY_NOTE_FORMAT;
            this.dailyNotesConfig = { folder, format };
            return this.dailyNotesConfig;
        } catch (error) {
            this.dailyNotesConfig = null;
            return null;
        }
    }

    private normalizeFolderPath(folder: string): string {
        const trimmed = folder.trim();
        if (!trimmed) {
            return '';
        }
        return trimmed.replace(/^\/+|\/+$/g, '');
    }

    private isInDailyNotesFolder(filePath: string, folder: string): boolean {
        const normalized = this.normalizeFolderPath(folder);
        if (normalized.length === 0) {
            return !filePath.includes('/');
        }
        return filePath.startsWith(`${normalized}/`);
    }

    private invalidateDateKeyCache(path?: string) {
        if (!path) {
            this.dateKeyCache.clear();
            return;
        }
        this.dateKeyCache.delete(path);
    }

    async onVaultModify(file: TFile | any): Promise<void> {
        if (!(file instanceof TFile)) {
            return;
        }
        const config = this.getDailyNotesConfig();
        if (!config) {
            return;
        }
        if (!this.isInDailyNotesFolder(file.path, config.folder)) {
            return;
        }
        if (file.extension !== 'md') {
            return;
        }
        this.renderManager.invalidateFile(file.path);
        const updated = await this.tryUpdateRenderedNote(file);
        if (updated) {
            return;
        }
        this.scheduleRefresh({ preserveScroll: true, clearFilteredCache: false });
    }

    onVaultCreate(file: TFile | any) {
        if (!(file instanceof TFile)) {
            return;
        }
        const config = this.getDailyNotesConfig();
        if (!config) {
            return;
        }
        if (!this.isInDailyNotesFolder(file.path, config.folder)) {
            return;
        }
        if (file.extension !== 'md') {
            return;
        }
        const updated = this.noteFilesCache.updateForAdd(file);
        if (!updated) {
            this.noteFilesCache.invalidate();
        }
        this.invalidateDateKeyCache(file.path);
        this.renderManager.invalidateFile(file.path);
        this.scheduleRefresh({ preserveScroll: true, clearFilteredCache: false });
    }

    onVaultDelete(file: TFile | any) {
        if (!(file instanceof TFile)) {
            return;
        }
        const config = this.getDailyNotesConfig();
        if (!config) {
            return;
        }
        if (!this.isInDailyNotesFolder(file.path, config.folder)) {
            return;
        }
        if (file.extension !== 'md') {
            return;
        }
        const updated = this.noteFilesCache.updateForRemove(file.path);
        if (!updated) {
            this.noteFilesCache.invalidate();
        }
        this.invalidateDateKeyCache(file.path);
        this.renderManager.invalidateFile(file.path);
        this.scheduleRefresh({ preserveScroll: true, clearFilteredCache: false });
    }

    onVaultRename(file: TFile | any, oldPath?: string) {
        if (!(file instanceof TFile)) {
            return;
        }
        const config = this.getDailyNotesConfig();
        if (!config) {
            return;
        }
        const wasInFolder = oldPath ? this.isInDailyNotesFolder(oldPath, config.folder) : false;
        const isInFolder = this.isInDailyNotesFolder(file.path, config.folder);
        if (!wasInFolder && !isInFolder) {
            return;
        }
        const removed = oldPath ? this.noteFilesCache.updateForRemove(oldPath) : false;
        const added = isInFolder ? this.noteFilesCache.updateForAdd(file) : false;
        if (!removed && !added) {
            this.noteFilesCache.invalidate();
        }
        this.invalidateDateKeyCache(oldPath);
        this.invalidateDateKeyCache(file.path);
        if (oldPath) {
            this.renderManager.invalidateFile(oldPath);
        }
        this.renderManager.invalidateFile(file.path);
        this.scheduleRefresh({ preserveScroll: true, clearFilteredCache: false });
    }

    private async tryUpdateRenderedNote(file: TFile): Promise<boolean> {
        const listEl = this.scrollManager.getListEl();
        if (!listEl) {
            return false;
        }
        const noteEl = this.renderManager.getRenderedNoteElement(file.path);
        if (!noteEl) {
            return false;
        }
        const updated = await this.renderManager.rerenderNote(noteEl, file);
        if (updated) {
            return true;
        }
        this.renderManager.cleanupRenderedNote(noteEl);
        noteEl.remove();
        this.updateRenderedRangeFromDom();
        if (listEl.children.length === 0) {
            await this.refresh({ preserveScroll: true, clearFilteredCache: false });
        }
        return true;
    }

    // Notice removed: view already shows "No daily notes found."
}
