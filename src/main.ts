import { Plugin } from 'obsidian';
import { DailyNotesTimelineModule } from './daily-notes-timeline';
import { DEFAULT_SETTINGS, DailyNotesTimelineSettings } from './settings';
import { DailyNotesTimelineSettingTab } from './settings-tab';

export default class DailyNotesTimelinePlugin extends Plugin {
	settings: DailyNotesTimelineSettings;
	private timelineModule: DailyNotesTimelineModule | null = null;

	async onload() {
		await this.loadSettings();

		this.timelineModule = new DailyNotesTimelineModule(this, this.settings, async () => {
			await this.saveSettings();
		});
		this.timelineModule.onload();
		this.addSettingTab(new DailyNotesTimelineSettingTab(this.app, this, this.settings));
	}

	onunload() {
		this.timelineModule = null;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<DailyNotesTimelineSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.timelineModule?.updateSettings(this.settings);
	}
}
