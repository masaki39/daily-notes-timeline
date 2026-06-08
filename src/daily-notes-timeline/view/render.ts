import { TFile } from 'obsidian';

type NoteElementOptions = {
    file: TFile;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => void) => void;
    onOpenFile: (file: TFile, openInNewLeaf: boolean) => void;
};

export type NoteElements = {
    noteEl: HTMLDivElement;
    bodyEl: HTMLDivElement;
};

export function createNoteElements(options: NoteElementOptions): NoteElements {
    const noteEl = activeDocument.createElement('div') as HTMLDivElement;
    noteEl.className = 'daily-notes-timeline-item';
    noteEl.dataset.path = options.file.path;

    const titleRowEl = activeDocument.createElement('div') as HTMLDivElement;
    titleRowEl.className = 'daily-notes-timeline-item-header';

    const titleEl = activeDocument.createElement('a') as HTMLAnchorElement;
    titleEl.className = 'daily-notes-timeline-item-title';
    titleEl.textContent = options.file.basename;
    titleEl.href = options.file.path;
    titleEl.setAttribute('data-href', options.file.path);
    options.registerDomEvent(titleEl, 'click', async (event: MouseEvent) => {
        event.preventDefault();
        const openInNewLeaf = event.metaKey || event.ctrlKey;
        options.onOpenFile(options.file, openInNewLeaf);
    });

    titleRowEl.appendChild(titleEl);

    const bodyEl = activeDocument.createElement('div') as HTMLDivElement;
    bodyEl.className = 'daily-notes-timeline-item-body';

    noteEl.appendChild(titleRowEl);
    noteEl.appendChild(bodyEl);

    return { noteEl, bodyEl };
}
