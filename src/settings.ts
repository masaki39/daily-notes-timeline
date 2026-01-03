import { TimelineFilterMode } from './daily-notes-timeline/filters';

export interface DailyNotesTimelineSettings {
	dailyNoteTimelineFilterHeadingDefault: string;
	dailyNoteTimelineDefaultFilter: TimelineFilterMode;
	dailyNoteTimelineCalendarDefaultOpen: boolean;
}

export const DEFAULT_SETTINGS: DailyNotesTimelineSettings = {
	dailyNoteTimelineFilterHeadingDefault: '',
	dailyNoteTimelineDefaultFilter: 'all',
	dailyNoteTimelineCalendarDefaultOpen: false
};
