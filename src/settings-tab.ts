import { App, PluginSettingTab, Setting } from 'obsidian';
import { DailyNotesTimelineSettings } from './settings';
import { TimelineFilterMode } from './daily-notes-timeline/filters/filter';
import type DailyNotesTimelinePlugin from './main';

export class DailyNotesTimelineSettingTab extends PluginSettingTab {
	plugin: DailyNotesTimelinePlugin;
	settings: DailyNotesTimelineSettings;

	constructor(app: App, plugin: DailyNotesTimelinePlugin, settings: DailyNotesTimelineSettings) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = settings;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Filter Heading')
			.setDesc('The heading used for filtering content.')
			.addText(text => text
				.setValue(this.settings.dailyNoteTimelineFilterHeadingDefault)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteTimelineFilterHeadingDefault = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Filter Mode')
			.setDesc('The default filter mode applied to the timeline.')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All')
				.addOption('tasks', 'Tasks')
				.addOption('lists', 'Lists')
				.addOption('links', 'Links')
				.addOption('images', 'Images')
				.addOption('callouts', 'Callouts')
				.addOption('heading', 'Heading')
				.setValue(this.settings.dailyNoteTimelineDefaultFilter as string)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteTimelineDefaultFilter = value as TimelineFilterMode;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Calendar Open')
			.setDesc('Whether the calendar is open by default.')
			.addToggle(toggle => toggle
				.setValue(this.settings.dailyNoteTimelineCalendarDefaultOpen)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteTimelineCalendarDefaultOpen = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Header Collapsed')
			.setDesc('Whether the header is collapsed by default.')
			.addToggle(toggle => toggle
				.setValue(this.settings.dailyNoteTimelineHeaderCollapsed)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteTimelineHeaderCollapsed = value;
					await this.plugin.saveSettings();
				}));
	}
}
