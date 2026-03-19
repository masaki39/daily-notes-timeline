import { TimelineFilterMode } from './daily-notes-timeline/filters';

export interface DailyNotesTimelineSettings {
	dailyNoteTimelineFilterHeadingDefault: string;
	dailyNoteTimelineDefaultFilter: TimelineFilterMode;
	dailyNoteTimelineCalendarDefaultOpen: boolean;
	dailyNoteTimelineHeaderCollapsed: boolean;
}

export const DEFAULT_SETTINGS: DailyNotesTimelineSettings = {
	dailyNoteTimelineFilterHeadingDefault: '',
	dailyNoteTimelineDefaultFilter: 'all',
	dailyNoteTimelineCalendarDefaultOpen: false,
	dailyNoteTimelineHeaderCollapsed: false
};
