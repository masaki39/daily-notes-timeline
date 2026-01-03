import { App, MarkdownRenderChild, MarkdownRenderer, TFile } from 'obsidian';
import { createNoteElements } from './render';
import { attachTimelineLinkHandler } from './links';
import { attachTaskToggleHandler } from './tasks';
import { TimelineFilterMode } from '../filters';
import { highlightMatches } from './highlight';

type RenderNoteOptions = {
    listEl: HTMLDivElement;
    file: TFile;
    noteIndex: number;
    position: 'append' | 'prepend';
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    onOpenFile: (file: TFile, openInNewLeaf: boolean) => void;
    onOpenLink: (href: string, sourcePath: string, openInNewLeaf: boolean, isExternal: boolean) => void;
    onToggleTask: (file: TFile, lineIndex: number, checked: boolean) => Promise<void>;
    activeFilter: TimelineFilterMode;
    headingFilterText: string;
    searchQuery: string;
    markdownComponent: any;
    resolveFilteredContent: (file: TFile) => Promise<string | null>;
    resolveRawContent: (file: TFile) => Promise<string>;
    resolveLinkSourcePath: (file: TFile) => string;
    resolveDateKey: (file: TFile) => string | null;
};

export type RenderNoteResult = {
    noteEl: HTMLDivElement;
    renderChild: MarkdownRenderChild;
};

type RenderNoteContentOptions = {
    bodyEl: HTMLDivElement;
    file: TFile;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    onOpenLink: (href: string, sourcePath: string, openInNewLeaf: boolean, isExternal: boolean) => void;
    onToggleTask: (file: TFile, lineIndex: number, checked: boolean) => Promise<void>;
    activeFilter: TimelineFilterMode;
    headingFilterText: string;
    searchQuery: string;
    markdownComponent: any;
    resolveLinkSourcePath: (file: TFile) => string;
    filteredContent: string;
    rawContent?: string;
};

class TimelineMarkdownRenderChild extends MarkdownRenderChild {
    private appRef: App;
    private fileRef: TFile | null;

    constructor(app: App, containerEl: HTMLElement, file: TFile | null) {
        super(containerEl);
        this.appRef = app;
        this.fileRef = file;
    }

    get app(): App {
        return this.appRef;
    }

    get file(): TFile | null {
        return this.fileRef;
    }
}

export async function renderNoteContent(options: RenderNoteContentOptions): Promise<MarkdownRenderChild> {
    const renderChild = new TimelineMarkdownRenderChild(options.markdownComponent.app, options.bodyEl, options.file);
    options.markdownComponent.addChild(renderChild);
    await MarkdownRenderer.render(
        options.markdownComponent.app,
        options.filteredContent,
        options.bodyEl,
        options.file.path,
        renderChild
    );
    await attachTaskToggleHandler({
        app: options.markdownComponent.app,
        container: options.bodyEl,
        file: options.file,
        registerDomEvent: options.registerDomEvent,
        activeFilter: options.activeFilter,
        headingFilterText: options.headingFilterText,
        filteredContent: options.filteredContent,
        rawContent: options.rawContent,
        onToggleTask: options.onToggleTask
    });
    attachTimelineLinkHandler(
        options.registerDomEvent,
        options.bodyEl,
        options.resolveLinkSourcePath(options.file),
        options.onOpenLink
    );
    highlightMatches(options.bodyEl, options.searchQuery);
    return renderChild;
}

export async function renderNote(options: RenderNoteOptions): Promise<RenderNoteResult | null> {
    const filtered = await options.resolveFilteredContent(options.file);
    if (filtered === null) {
        return null;
    }
    const rawContent = await options.resolveRawContent(options.file);
    const { noteEl, bodyEl } = createNoteElements({
        file: options.file,
        registerDomEvent: options.registerDomEvent,
        onOpenFile: options.onOpenFile
    });
    noteEl.dataset.index = String(options.noteIndex);
    const dateKey = options.resolveDateKey(options.file);
    if (dateKey) {
        noteEl.dataset.date = dateKey;
    }

    if (options.position === 'prepend') {
        options.listEl.prepend(noteEl);
    } else {
        options.listEl.appendChild(noteEl);
    }
    const renderChild = await renderNoteContent({
        bodyEl,
        file: options.file,
        registerDomEvent: options.registerDomEvent,
        onOpenLink: options.onOpenLink,
        onToggleTask: options.onToggleTask,
        activeFilter: options.activeFilter,
        headingFilterText: options.headingFilterText,
        searchQuery: options.searchQuery,
        markdownComponent: options.markdownComponent,
        resolveLinkSourcePath: options.resolveLinkSourcePath,
        filteredContent: filtered,
        rawContent
    });
    return { noteEl, renderChild };
}
