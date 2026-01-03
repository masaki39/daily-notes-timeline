import {
    extractHeadingSectionFromContent,
    filterCalloutsContent,
    filterImagesContent,
    filterLinksContent,
    filterTasksContent,
    filterTimelineContent,
    findHeadingSectionRange
} from '../src/daily-notes-timeline/filters';
import { collectDailyNoteFiles, extractDateFromFileName, toISODateKey } from '../src/daily-notes-timeline/data';
import { mapTaskLineIndices } from '../src/daily-notes-timeline/view/tasks';
import { buildDateIndex, findNearestIndexWithContent } from '../src/daily-notes-timeline/view/timeline-index';
import { TFile } from 'obsidian';

class MockFile extends TFile {
    path: string;
    extension: string;
    basename: string;

    constructor(path: string) {
        super();
        this.path = path;
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        const dotIndex = filename.lastIndexOf('.');
        this.extension = dotIndex === -1 ? '' : filename.slice(dotIndex + 1);
        this.basename = dotIndex === -1 ? filename : filename.slice(0, dotIndex);
    }
}

const createAppWithFiles = (paths: string[]) => {
    const files = paths.map(path => new MockFile(path));
    return {
        vault: {
            getFiles: () => files
        }
    } as any;
};

describe('daily note timeline filters', () => {
    test('filterTasksContent returns task lines only', () => {
        const input = [
            '# Title',
            '- [ ] Task one',
            'Paragraph',
            '- [x] Done',
            '- [ ] Task two',
        ].join('\n');

        expect(filterTasksContent(input)).toBe('- [ ] Task one\n- [x] Done\n- [ ] Task two');
    });

    test('filterTasksContent returns null when no tasks', () => {
        const input = ['# Title', 'Paragraph', '- item'].join('\n');
        expect(filterTasksContent(input)).toBeNull();
    });

    test('filterTasksContent includes + and numbered tasks', () => {
        const input = [
            '# Title',
            '+ [ ] Plus task',
            '1. [x] Numbered task',
            '- [ ] Dash task'
        ].join('\n');

        expect(filterTasksContent(input)).toBe('+ [ ] Plus task\n1. [x] Numbered task\n- [ ] Dash task');
    });

    test('extractHeadingSectionFromContent matches heading text ignoring hashes', () => {
        const input = [
            '# One',
            'a',
            '## Target',
            'line 1',
            'line 2',
            '### Child',
            'line 3',
            '## Next',
            'line 4',
        ].join('\n');

        expect(extractHeadingSectionFromContent(input, 'Target')).toBe('line 1\nline 2\n### Child\nline 3');
    });

    test('extractHeadingSectionFromContent returns null when heading missing', () => {
        const input = ['# One', 'text'].join('\n');
        expect(extractHeadingSectionFromContent(input, 'Missing')).toBeNull();
    });

    test('filterTimelineContent respects heading filter', () => {
        const input = ['# A', 'text', '# B', 'b1'].join('\n');
        expect(filterTimelineContent(input, 'heading', 'B')).toBe('b1');
    });

    test('findHeadingSectionRange tolerates hashes in query', () => {
        const input = ['# A', 'text', '## Target', 'line', '## Next', 'tail'].join('\n');
        const range = findHeadingSectionRange(input.split('\n'), '# Target');
        expect(range).toEqual({ start: 3, end: 4 });
    });

    test('filterLinksContent collects link lines', () => {
        const input = [
            'plain text',
            '[[Internal Link]]',
            'See [title](https://example.com)',
            'https://example.com direct'
        ].join('\n');
        expect(filterLinksContent(input)).toBe('[[Internal Link]]\nSee [title](https://example.com)\nhttps://example.com direct');
    });

    test('filterImagesContent collects image lines', () => {
        const input = [
            'text',
            '![[photo.jpg]]',
            '![alt](image.png)',
            '<img src="photo.webp" />'
        ].join('\n');
        expect(filterImagesContent(input)).toBe('![[photo.jpg]]\n![alt](image.png)\n<img src="photo.webp" />');
    });

    test('filterCalloutsContent extracts callout blocks', () => {
        const input = [
            'text',
            '> [!NOTE]',
            '> line 1',
            '> line 2',
            '',
            '> [!TIP]',
            '> tip line'
        ].join('\n');
        expect(filterCalloutsContent(input)).toBe('> [!NOTE]\n> line 1\n> line 2\n\n> [!TIP]\n> tip line');
    });

    test('extractDateFromFileName supports separators and literals', () => {
        const date = extractDateFromFileName('2024.02.03 daily', 'YYYY.MM.DD [daily]');
        expect(date).not.toBeNull();
        expect(toISODateKey(date as Date)).toBe('2024-02-03');
    });

    test('extractDateFromFileName supports weekday tokens', () => {
        const date = extractDateFromFileName('2024-02-03 Sat', 'YYYY-MM-DD ddd');
        expect(date).not.toBeNull();
        expect(toISODateKey(date as Date)).toBe('2024-02-03');
    });
});

describe('daily note timeline task mapping', () => {
    test('maps task lines included by link filter', () => {
        const content = [
            '# Log',
            '- [ ] [[Project]] review',
            '- [ ] no link',
            'text',
            '- [x] https://example.com done',
        ].join('\n');

        const filtered = filterTimelineContent(content, 'links', '') ?? '';
        const indices = mapTaskLineIndices(content, filtered);

        expect(indices).toEqual([1, 4]);
    });

    test('maps task lines inside heading section', () => {
        const content = [
            '# One',
            '- [ ] outside',
            '## Target',
            '- [ ] inside one',
            '- [x] inside two',
            '## Next',
            '- [ ] outside two',
        ].join('\n');

        const filtered = filterTimelineContent(content, 'heading', 'Target') ?? '';
        const indices = mapTaskLineIndices(content, filtered);

        expect(indices).toEqual([3, 4]);
    });

    test('maps heading tasks when duplicate lines exist elsewhere', () => {
        const content = [
            '# One',
            '- [ ] duplicate',
            '## Target',
            '- [ ] duplicate',
            '- [ ] unique',
            '## Next',
            '- [ ] duplicate',
        ].join('\n');

        const filtered = filterTimelineContent(content, 'heading', 'Target') ?? '';
        const range = findHeadingSectionRange(content.split('\n'), 'Target');
        const indices = mapTaskLineIndices(content, filtered, range ?? undefined);

        expect(indices).toEqual([3, 4]);
    });
});

describe('daily note timeline file collection', () => {
    test('collectDailyNoteFiles filters folder and sorts by date descending', () => {
        const app = createAppWithFiles([
            'Daily/2024-02-03.md',
            'Daily/2024-02-01.md',
            'Daily/2024-02-02.md',
            'Daily/notes.md',
            'Notes/2024-02-04.md',
            'Daily/2024-02-03.txt'
        ]);
        const files = collectDailyNoteFiles(app, { folder: 'Daily', format: 'YYYY-MM-DD' });
        expect(files.map(file => file.path)).toEqual([
            'Daily/2024-02-03.md',
            'Daily/2024-02-02.md',
            'Daily/2024-02-01.md'
        ]);
    });

    test('collectDailyNoteFiles respects root folder setting', () => {
        const app = createAppWithFiles([
            '2024-01-01.md',
            'Daily/2024-01-02.md',
            '2024-01-03.md'
        ]);
        const files = collectDailyNoteFiles(app, { folder: '', format: 'YYYY-MM-DD' });
        expect(files.map(file => file.path)).toEqual([
            '2024-01-03.md',
            '2024-01-01.md'
        ]);
    });
});

describe('daily note timeline index', () => {
    test('findNearestIndexWithContent falls back to first matching content for invalid date key', async () => {
        const files = [
            new MockFile('2024-01-03.md'),
            new MockFile('2024-01-02.md')
        ];
        const index = buildDateIndex(files, file => file.basename);
        const result = await findNearestIndexWithContent({
            files,
            index,
            targetDateKey: 'not-a-date',
            hasFilteredContent: async (file) => file.path.includes('2024-01-02')
        });

        expect(result).toBe(1);
    });
});
