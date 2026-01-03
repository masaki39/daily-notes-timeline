import { Plugin } from 'obsidian';
import { DailyNotesTimelineSettings } from '../settings';
import { DAILY_NOTES_TIMELINE_VIEW, DailyNotesTimelineView } from './view';

export class DailyNotesTimelineModule {
    private plugin: Plugin;
    private settings: DailyNotesTimelineSettings;
    private onSettingsChange: () => Promise<void>;

    constructor(plugin: Plugin, settings: DailyNotesTimelineSettings, onSettingsChange: () => Promise<void>) {
        this.plugin = plugin;
        this.settings = settings;
        this.onSettingsChange = onSettingsChange;
    }

    onload() {
        this.plugin.registerView(DAILY_NOTES_TIMELINE_VIEW, (leaf) => {
            return new DailyNotesTimelineView(leaf, this.settings, this.onSettingsChange);
        });

        this.plugin.addCommand({
            id: 'daily-notes-timeline-open',
            name: 'Open daily notes timeline',
            callback: () => {
                void this.activateView();
            }
        });
    }

    updateSettings(settings: DailyNotesTimelineSettings) {
        this.settings = settings;
        this.updateViews();
    }

    private async activateView() {
        const { workspace } = this.plugin.app;
        let leaf = workspace.getLeavesOfType(DAILY_NOTES_TIMELINE_VIEW)[0];
        const isNewLeaf = !leaf;
        if (!leaf) {
            leaf = workspace.getLeaf('tab');
        }
        if (!leaf) {
            return;
        }
        await leaf.setViewState({ type: DAILY_NOTES_TIMELINE_VIEW, active: true });
        await workspace.revealLeaf(leaf);
        if (isNewLeaf) {
            const view = leaf.view;
            if (view instanceof DailyNotesTimelineView) {
                void view.handleViewActivated();
            }
        }
    }

    private updateViews() {
        const leaves = this.plugin.app.workspace.getLeavesOfType(DAILY_NOTES_TIMELINE_VIEW);
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view instanceof DailyNotesTimelineView) {
                view.setSettings(this.settings);
            }
        }
    }
}
