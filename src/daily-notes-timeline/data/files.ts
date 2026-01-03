import { App, TFile } from 'obsidian';
import { extractDateFromFileName, toISODateKey } from './date';

export type DailyNotesConfig = {
    folder: string;
    format: string;
};

export function getDateKeyFromFile(file: TFile, config: DailyNotesConfig): string | null {
    const date = extractDateFromFileName(file.basename, config.format);
    return date ? toISODateKey(date) : null;
}

function normalizeFolderPath(folder: string): string {
    const trimmed = folder.trim();
    if (!trimmed) {
        return '';
    }
    return trimmed.replace(/^\/+|\/+$/g, '');
}

export function collectDailyNoteFiles(app: App, config: DailyNotesConfig): TFile[] {
    const folder = normalizeFolderPath(config.folder);
    const files = app.vault.getFiles().filter(file => {
        if (file.extension !== 'md') {
            return false;
        }
        if (folder.trim().length === 0) {
            return !file.path.includes('/');
        }
        return file.path.startsWith(`${folder}/`);
    });
    const withDates = files
        .map(file => ({
            file,
            date: extractDateFromFileName(file.basename, config.format)
        }))
        .filter(entry => entry.date !== null) as Array<{ file: TFile; date: Date }>;

    withDates.sort((a, b) => b.date.getTime() - a.date.getTime());
    return withDates.map(entry => entry.file);
}
