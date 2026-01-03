import { App, TFile } from 'obsidian';
import { extractDateFromFileName, toISODateKey } from './date';

export type DailyNotesConfig = {
    folder: string;
    format: string;
};

function stripExtension(path: string, extension: string): string | null {
    const suffix = `.${extension}`;
    if (!path.endsWith(suffix)) {
        return null;
    }
    return path.slice(0, -suffix.length);
}

function normalizeFolderPath(folder: string): string {
    const trimmed = folder.trim();
    if (!trimmed) {
        return '';
    }
    return trimmed.replace(/^\/+|\/+$/g, '');
}

function getPathForFormat(filePath: string, config: DailyNotesConfig): string | null {
    const withoutExtension = stripExtension(filePath, 'md');
    if (!withoutExtension) {
        return null;
    }
    const folder = normalizeFolderPath(config.folder);
    if (!folder) {
        return withoutExtension;
    }
    const prefix = `${folder}/`;
    if (!withoutExtension.startsWith(prefix)) {
        return null;
    }
    return withoutExtension.slice(prefix.length);
}

export function isDailyNotePath(filePath: string, config: DailyNotesConfig): boolean {
    const pathForFormat = getPathForFormat(filePath, config);
    if (!pathForFormat) {
        return false;
    }
    return extractDateFromFileName(pathForFormat, config.format) !== null;
}

export function getDateKeyFromFile(file: TFile, config: DailyNotesConfig): string | null {
    const pathForFormat = getPathForFormat(file.path, config);
    if (!pathForFormat) {
        return null;
    }
    const date = extractDateFromFileName(pathForFormat, config.format);
    return date ? toISODateKey(date) : null;
}

export function collectDailyNoteFiles(app: App, config: DailyNotesConfig): TFile[] {
    const files = app.vault.getFiles().filter(file => file.extension === 'md');
    const withDates = files
        .map(file => {
            const pathForFormat = getPathForFormat(file.path, config);
            if (!pathForFormat) {
                return null;
            }
            const date = extractDateFromFileName(pathForFormat, config.format);
            if (!date) {
                return null;
            }
            return { file, date };
        })
        .filter(entry => entry !== null) as Array<{ file: TFile; date: Date }>;

    withDates.sort((a, b) => b.date.getTime() - a.date.getTime());
    return withDates.map(entry => entry.file);
}
