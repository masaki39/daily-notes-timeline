import { App, MarkdownRenderChild, TFile } from 'obsidian';
import { filterTimelineContent, TimelineFilterMode } from '../filters';
import { renderNote, renderNoteContent } from './render-range';

type RenderManagerOptions = {
    app: App;
    markdownComponent: any;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    onOpenFile: (file: TFile, openInNewLeaf: boolean) => void;
    onOpenLink: (href: string, sourcePath: string, openInNewLeaf: boolean, isExternal: boolean) => void;
    onToggleTask: (file: TFile, lineIndex: number, checked: boolean) => Promise<void>;
    resolveLinkSourcePath: (file: TFile) => string;
    resolveDateKey: (file: TFile) => string | null;
    getActiveFilter: () => TimelineFilterMode;
    getHeadingFilterText: () => string;
    getSearchQuery: () => string;
};

export class TimelineRenderManager {
    private app: App;
    private markdownComponent: any;
    private registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    private onOpenFile: (file: TFile, openInNewLeaf: boolean) => void;
    private onOpenLink: (href: string, sourcePath: string, openInNewLeaf: boolean, isExternal: boolean) => void;
    private onToggleTask: (file: TFile, lineIndex: number, checked: boolean) => Promise<void>;
    private resolveLinkSourcePath: (file: TFile) => string;
    private resolveDateKey: (file: TFile) => string | null;
    private getActiveFilter: () => TimelineFilterMode;
    private getHeadingFilterText: () => string;
    private getSearchQuery: () => string;
    private filteredContentCache = new Map<string, string | null>();
    private fileContentCache = new Map<string, string>();
    private searchMatchCache = new Map<string, boolean>();
    private searchMatchCacheKey: string | null = null;
    private searchTermsCacheKey: string | null = null;
    private searchTermsCache: string[] = [];
    private readonly maxFilteredCacheEntries = 600;
    private readonly maxRawCacheEntries = 300;
    private readonly maxSearchCacheEntries = 800;
    private renderedChildren = new Map<HTMLElement, MarkdownRenderChild>();
    private renderedByPath = new Map<string, HTMLDivElement>();

    constructor(options: RenderManagerOptions) {
        this.app = options.app;
        this.markdownComponent = options.markdownComponent;
        this.registerDomEvent = options.registerDomEvent;
        this.onOpenFile = options.onOpenFile;
        this.onOpenLink = options.onOpenLink;
        this.onToggleTask = options.onToggleTask;
        this.resolveLinkSourcePath = options.resolveLinkSourcePath;
        this.resolveDateKey = options.resolveDateKey;
        this.getActiveFilter = options.getActiveFilter;
        this.getHeadingFilterText = options.getHeadingFilterText;
        this.getSearchQuery = options.getSearchQuery;
    }

    clearFilteredContentCache() {
        this.filteredContentCache.clear();
        this.fileContentCache.clear();
        this.searchMatchCache.clear();
        this.searchMatchCacheKey = null;
    }

    invalidateFile(path: string) {
        this.filteredContentCache.delete(path);
        this.fileContentCache.delete(path);
        this.searchMatchCache.delete(path);
    }

    clearRenderedNotes() {
        for (const child of this.renderedChildren.values()) {
            this.markdownComponent?.removeChild(child);
        }
        this.renderedChildren.clear();
        this.renderedByPath.clear();
    }

    cleanupRenderedNote(noteEl: HTMLElement) {
        const child = this.renderedChildren.get(noteEl);
        if (!child) {
            const path = (noteEl as HTMLElement).dataset.path;
            if (path) {
                this.renderedByPath.delete(path);
            }
            return;
        }
        const path = (noteEl as HTMLElement).dataset.path;
        if (path) {
            this.renderedByPath.delete(path);
        }
        this.renderedChildren.delete(noteEl);
        this.markdownComponent?.removeChild(child);
    }

    async renderNote(listEl: HTMLDivElement, file: TFile, position: 'append' | 'prepend', noteIndex: number): Promise<void> {
        const result = await renderNote({
            listEl,
            file,
            noteIndex,
            position,
            registerDomEvent: this.registerDomEvent,
            onOpenFile: this.onOpenFile,
            onOpenLink: this.onOpenLink,
            onToggleTask: this.onToggleTask,
            activeFilter: this.getActiveFilter(),
            headingFilterText: this.getHeadingFilterText(),
            searchQuery: this.getSearchQuery(),
            markdownComponent: this.markdownComponent,
            resolveFilteredContent: (targetFile) => this.getFilteredContent(targetFile),
            resolveRawContent: (targetFile) => this.getRawContent(targetFile),
            resolveLinkSourcePath: (targetFile) => this.resolveLinkSourcePath(targetFile),
            resolveDateKey: (targetFile) => this.resolveDateKey(targetFile)
        });
        if (!result) {
            return;
        }
        this.renderedChildren.set(result.noteEl, result.renderChild);
        this.renderedByPath.set(file.path, result.noteEl);
    }

    async hasFilteredContent(file: TFile): Promise<boolean> {
        if (this.getActiveFilter() === 'all' && this.getSearchQuery().trim().length === 0) {
            return true;
        }
        const searchKey = this.getSearchCacheKey();
        if (this.searchMatchCacheKey !== searchKey) {
            this.searchMatchCacheKey = searchKey;
            this.searchMatchCache.clear();
        }
        if (this.searchMatchCache.has(file.path)) {
            const cached = this.searchMatchCache.get(file.path) ?? false;
            this.touchCache(this.searchMatchCache, file.path, cached, this.maxSearchCacheEntries);
            return cached;
        }
        const content = await this.getFilteredContent(file);
        const matches = content !== null;
        this.touchCache(this.searchMatchCache, file.path, matches, this.maxSearchCacheEntries);
        return matches;
    }

    getRenderedNoteElement(path: string): HTMLDivElement | null {
        return this.renderedByPath.get(path) ?? null;
    }

    async rerenderNote(noteEl: HTMLDivElement, file: TFile): Promise<boolean> {
        const filtered = await this.getFilteredContent(file);
        if (filtered === null) {
            return false;
        }
        const bodyEl = noteEl.querySelector('.daily-notes-timeline-item-body') as HTMLDivElement | null;
        if (!bodyEl) {
            return false;
        }
        const existing = this.renderedChildren.get(noteEl);
        if (existing) {
            this.renderedChildren.delete(noteEl);
            this.markdownComponent?.removeChild(existing);
        }
        bodyEl.textContent = '';
        const renderChild = await renderNoteContent({
            bodyEl,
            file,
            registerDomEvent: this.registerDomEvent,
            onOpenLink: this.onOpenLink,
            onToggleTask: this.onToggleTask,
            activeFilter: this.getActiveFilter(),
            headingFilterText: this.getHeadingFilterText(),
            searchQuery: this.getSearchQuery(),
            markdownComponent: this.markdownComponent,
            resolveLinkSourcePath: (targetFile) => this.resolveLinkSourcePath(targetFile),
            filteredContent: filtered,
            rawContent: await this.getRawContent(file)
        });
        this.renderedChildren.set(noteEl, renderChild);
        this.renderedByPath.set(file.path, noteEl);
        return true;
    }

    private applyFilter(content: string): string | null {
        return filterTimelineContent(content, this.getActiveFilter(), this.getHeadingFilterText().trim());
    }

    private async getFilteredContent(file: TFile): Promise<string | null> {
        const cached = this.filteredContentCache.get(file.path);
        if (cached !== undefined) {
            this.touchCache(this.filteredContentCache, file.path, cached, this.maxFilteredCacheEntries);
            return this.applySearch(cached);
        }
        const content = await this.app.vault.cachedRead(file);
        this.touchCache(this.fileContentCache, file.path, content, this.maxRawCacheEntries);
        const filtered = this.applyFilter(content);
        this.touchCache(this.filteredContentCache, file.path, filtered, this.maxFilteredCacheEntries);
        return this.applySearch(filtered);
    }

    private async getRawContent(file: TFile): Promise<string> {
        const cached = this.fileContentCache.get(file.path);
        if (cached !== undefined) {
            this.touchCache(this.fileContentCache, file.path, cached, this.maxRawCacheEntries);
            return cached;
        }
        const content = await this.app.vault.cachedRead(file);
        this.touchCache(this.fileContentCache, file.path, content, this.maxRawCacheEntries);
        return content;
    }

    private touchCache<K, V>(cache: Map<K, V>, key: K, value: V, maxEntries: number) {
        if (cache.has(key)) {
            cache.delete(key);
        }
        cache.set(key, value);
        if (cache.size <= maxEntries) {
            return;
        }
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
            cache.delete(oldestKey);
        }
    }

    private applySearch(content: string | null): string | null {
        if (content === null) {
            return null;
        }
        const terms = this.getSearchTerms();
        if (terms.length === 0) {
            return content;
        }
        const haystack = content.toLowerCase();
        const matchesAll = terms.every(term => haystack.includes(term));
        return matchesAll ? content : null;
    }

    private getSearchTerms(): string[] {
        const query = this.getSearchQuery().trim();
        if (query.length === 0) {
            this.searchTermsCacheKey = '';
            this.searchTermsCache = [];
            return this.searchTermsCache;
        }
        const key = query.toLowerCase();
        if (this.searchTermsCacheKey === key) {
            return this.searchTermsCache;
        }
        const terms = key.split(/\s+/).filter(term => term.length > 0);
        this.searchTermsCacheKey = key;
        this.searchTermsCache = terms;
        return terms;
    }

    private getSearchCacheKey(): string {
        const heading = this.getHeadingFilterText().trim();
        const query = this.getSearchQuery().trim().toLowerCase();
        return `${this.getActiveFilter()}::${heading}::${query}`;
    }
}
