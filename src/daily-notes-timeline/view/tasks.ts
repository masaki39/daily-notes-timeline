import { App, TFile } from 'obsidian';
import { findHeadingSectionRange, isTaskLine, TimelineFilterMode } from '../filters';

type TaskToggleOptions = {
    app: App;
    container: HTMLElement;
    file: TFile;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    activeFilter: TimelineFilterMode;
    headingFilterText: string;
    filteredContent: string;
    rawContent?: string;
    onToggleTask: (file: TFile, lineIndex: number, checked: boolean) => Promise<void>;
};

export function mapTaskLineIndices(
    content: string,
    filteredContent: string,
    range?: { start: number; end: number }
): number[] {
    const lines = content.split('\n');
    const filteredLines = filteredContent.split('\n');
    const filteredTaskLines = filteredLines.filter(line => isTaskLine(line));
    if (filteredTaskLines.length === 0) {
        return [];
    }
    const lineIndexMap = new Map<string, number[]>();
    const start = range ? Math.max(0, range.start) : 0;
    const end = range ? Math.min(lines.length, range.end) : lines.length;
    for (let i = start; i < end; i += 1) {
        const line = lines[i];
        if (!isTaskLine(line)) {
            continue;
        }
        const existing = lineIndexMap.get(line);
        if (existing) {
            existing.push(i);
        } else {
            lineIndexMap.set(line, [i]);
        }
    }
    const cursorByLine = new Map<string, number>();
    const indices: number[] = [];
    let searchFrom = start;
    for (const taskLine of filteredTaskLines) {
        const candidates = lineIndexMap.get(taskLine);
        if (!candidates || candidates.length === 0) {
            continue;
        }
        let cursor = cursorByLine.get(taskLine) ?? 0;
        while (cursor < candidates.length && candidates[cursor] < searchFrom) {
            cursor += 1;
        }
        if (cursor >= candidates.length) {
            cursorByLine.set(taskLine, cursor);
            continue;
        }
        const index = candidates[cursor];
        cursorByLine.set(taskLine, cursor + 1);
        indices.push(index);
        searchFrom = index + 1;
    }
    return indices;
}

export async function attachTaskToggleHandler(options: TaskToggleOptions): Promise<void> {
    const checkboxes = Array.from(options.container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    if (checkboxes.length === 0) {
        return;
    }

    const content = options.rawContent ?? await options.app.vault.cachedRead(options.file);
    const headingRange = options.activeFilter === 'heading'
        ? findHeadingSectionRange(content.split('\n'), options.headingFilterText)
        : null;
    const taskLineIndices = mapTaskLineIndices(content, options.filteredContent, headingRange ?? undefined);
    const mappedCount = Math.min(taskLineIndices.length, checkboxes.length);
    for (let i = 0; i < checkboxes.length; i += 1) {
        const mappedIndex = i < mappedCount ? taskLineIndices[i] : null;
        if (mappedIndex !== null && Number.isFinite(mappedIndex)) {
            checkboxes[i].dataset.dailyNotesTimelineTaskLine = String(mappedIndex);
        } else {
            delete checkboxes[i].dataset.dailyNotesTimelineTaskLine;
        }
    }

    if (options.container.dataset.dailyNotesTimelineTaskHandlerAttached === '1') {
        return;
    }
    options.container.dataset.dailyNotesTimelineTaskHandlerAttached = '1';
    options.registerDomEvent(options.container, 'change', async (event: Event) => {
        const target = event.target as HTMLInputElement | null;
        if (!target || target.type !== 'checkbox') {
            return;
        }
        const lineAttr = target.dataset.dailyNotesTimelineTaskLine ?? null;
        const lineIndex = lineAttr !== null ? Number(lineAttr) : Number.NaN;
        if (!Number.isFinite(lineIndex)) {
            return;
        }
        await options.onToggleTask(options.file, lineIndex, target.checked);
    });
}
