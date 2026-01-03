import { DailyNotesTimelineSettings } from '../../settings';
import { TimelineCalendar } from '../calendar';
import { TimelineFilterMode } from '../filters';
import { buildTimelineHeader } from './header';

type TimelineControllerUiOptions = {
    contentEl: HTMLElement;
    settings: DailyNotesTimelineSettings;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    onFilterChange: (mode: TimelineFilterMode) => void;
    onHeadingInput: (value: string) => void;
    onSearchInput: (value: string) => void;
    onToday: () => void;
    onScrollToToday: () => void;
    onJumpToDateKey: (dateKey: string) => void;
    onQueueSettingsSave: () => void;
};

export class TimelineControllerUi {
    private contentEl: HTMLElement;
    private settings: DailyNotesTimelineSettings;
    private registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    private onFilterChange: (mode: TimelineFilterMode) => void;
    private onHeadingInput: (value: string) => void;
    private onSearchInput: (value: string) => void;
    private onToday: () => void;
    private onScrollToToday: () => void;
    private onJumpToDateKey: (dateKey: string) => void;
    private onQueueSettingsSave: () => void;
    private filterTabButtons: HTMLButtonElement[] = [];
    private filterHeadingInputEl: HTMLInputElement | null = null;
    private calendar: TimelineCalendar | null = null;

    constructor(options: TimelineControllerUiOptions) {
        this.contentEl = options.contentEl;
        this.settings = options.settings;
        this.registerDomEvent = options.registerDomEvent;
        this.onFilterChange = options.onFilterChange;
        this.onHeadingInput = options.onHeadingInput;
        this.onSearchInput = options.onSearchInput;
        this.onToday = options.onToday;
        this.onScrollToToday = options.onScrollToToday;
        this.onJumpToDateKey = options.onJumpToDateKey;
        this.onQueueSettingsSave = options.onQueueSettingsSave;
    }

    buildHeader(activeFilter: TimelineFilterMode, headingFilterText: string, searchQuery: string) {
        const elements = buildTimelineHeader({
            contentEl: this.contentEl,
            registerDomEvent: this.registerDomEvent,
            activeFilter,
            headingFilterText,
            searchQuery,
            onFilterChange: this.onFilterChange,
            onHeadingInput: this.onHeadingInput,
            onSearchInput: this.onSearchInput,
            onToday: this.onToday
        });
        this.filterTabButtons = elements.filterTabButtons;
        this.filterHeadingInputEl = elements.filterHeadingInputEl;
        this.updateFilterUi(activeFilter);
    }

    buildCalendar() {
        this.calendar = new TimelineCalendar({
            contentEl: this.contentEl,
            settings: this.settings,
            registerDomEvent: this.registerDomEvent,
            onScrollToToday: this.onScrollToToday,
            onJumpToDateKey: this.onJumpToDateKey,
            onQueueSettingsSave: this.onQueueSettingsSave
        });
        this.calendar.build();
    }

    setCalendarVisible(isVisible: boolean) {
        this.calendar?.setVisible(isVisible);
    }

    updateCalendarForDate(dateKey: string) {
        this.calendar?.updateForDate(dateKey);
    }

    setHeadingFilterText(value: string) {
        if (this.filterHeadingInputEl) {
            this.filterHeadingInputEl.value = value;
        }
    }

    updateFilterUi(activeFilter: TimelineFilterMode) {
        if (!this.filterHeadingInputEl) {
            return;
        }
        this.filterHeadingInputEl.toggleClass('is-hidden', activeFilter !== 'heading');
        for (const button of this.filterTabButtons) {
            const mode = (button.dataset.filter as TimelineFilterMode) ?? 'all';
            button.toggleClass('is-active', mode === activeFilter);
        }
    }
}
