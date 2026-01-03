import { App, TFile } from 'obsidian';
import { collectDailyNoteFiles, DailyNotesConfig } from '../data';
import { dateKeyToNumber } from './timeline-index';

type NoteFilesCacheOptions = {
    app: App;
    getConfig: () => DailyNotesConfig | null;
    isInDailyNotesFolder: (path: string, folder: string) => boolean;
    getDateKeyFromFile: (file: TFile) => string | null;
};

export class TimelineNoteFilesCache {
    private app: App;
    private getConfig: () => DailyNotesConfig | null;
    private isInDailyNotesFolder: (path: string, folder: string) => boolean;
    private getDateKeyFromFile: (file: TFile) => string | null;
    private cache: TFile[] | null = null;
    private cacheKey: string | null = null;

    constructor(options: NoteFilesCacheOptions) {
        this.app = options.app;
        this.getConfig = options.getConfig;
        this.isInDailyNotesFolder = options.isInDailyNotesFolder;
        this.getDateKeyFromFile = options.getDateKeyFromFile;
    }

    getFiles(): TFile[] {
        const config = this.getConfig();
        if (!config) {
            this.invalidate();
            return [];
        }
        const cacheKey = `${config.folder}::${config.format}`;
        if (this.cache && this.cacheKey === cacheKey) {
            return this.cache;
        }
        const files = collectDailyNoteFiles(this.app, config);
        this.cache = files;
        this.cacheKey = cacheKey;
        return files;
    }

    invalidate() {
        this.cache = null;
        this.cacheKey = null;
    }

    updateForAdd(file: TFile): boolean {
        if (!this.cache) {
            return false;
        }
        const config = this.getConfig();
        if (!config) {
            return false;
        }
        const cacheKey = `${config.folder}::${config.format}`;
        if (this.cacheKey !== cacheKey) {
            this.invalidate();
            return false;
        }
        if (!this.isInDailyNotesFolder(file.path, config.folder)) {
            return false;
        }
        if (file.extension !== 'md') {
            return false;
        }
        const existingIndex = this.cache.findIndex(entry => entry.path === file.path);
        if (existingIndex !== -1) {
            return true;
        }
        const dateKey = this.getDateKeyFromFile(file);
        if (!dateKey) {
            return false;
        }
        const dateNumber = dateKeyToNumber(dateKey);
        if (!Number.isFinite(dateNumber)) {
            return false;
        }
        let insertIndex = this.cache.length;
        for (let i = 0; i < this.cache.length; i += 1) {
            const existingKey = this.getDateKeyFromFile(this.cache[i]);
            const existingNumber = dateKeyToNumber(existingKey ?? '');
            if (!Number.isFinite(existingNumber)) {
                continue;
            }
            if (dateNumber > existingNumber) {
                insertIndex = i;
                break;
            }
        }
        this.cache.splice(insertIndex, 0, file);
        return true;
    }

    updateForRemove(path: string): boolean {
        if (!this.cache) {
            return false;
        }
        const config = this.getConfig();
        if (!config) {
            return false;
        }
        const cacheKey = `${config.folder}::${config.format}`;
        if (this.cacheKey !== cacheKey) {
            this.invalidate();
            return false;
        }
        const index = this.cache.findIndex(file => file.path === path);
        if (index === -1) {
            return false;
        }
        this.cache.splice(index, 1);
        return true;
    }
}
