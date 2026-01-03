import { setIcon } from 'obsidian';
import { DailyNotesTimelineSettings } from '../../settings';
import { getDateFromKey, toISODateKey } from '../data';

type CalendarOptions = {
    contentEl: HTMLElement;
    settings: DailyNotesTimelineSettings;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    onScrollToToday: () => void;
    onJumpToDateKey: (dateKey: string) => void;
    onQueueSettingsSave: () => void;
};

export class TimelineCalendar {
    private contentEl: HTMLElement;
    private settings: DailyNotesTimelineSettings;
    private registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    private onScrollToToday: () => void;
    private onJumpToDateKey: (dateKey: string) => void;
    private onQueueSettingsSave: () => void;
    private calendarEl: HTMLDivElement | null = null;
    private calendarGridEl: HTMLDivElement | null = null;
    private calendarTitleEl: HTMLDivElement | null = null;
    private toggleButtonEl: HTMLButtonElement | null = null;
    private isVisible = false;
    private currentMonthKey: string | null = null;
    private currentMonthDate: Date | null = null;
    private currentTopDateKey: string | null = null;

    constructor(options: CalendarOptions) {
        this.contentEl = options.contentEl;
        this.settings = options.settings;
        this.registerDomEvent = options.registerDomEvent;
        this.onScrollToToday = options.onScrollToToday;
        this.onJumpToDateKey = options.onJumpToDateKey;
        this.onQueueSettingsSave = options.onQueueSettingsSave;
    }

    build() {
        this.calendarEl = this.contentEl.createDiv('daily-notes-timeline-calendar');
        this.calendarEl.addClass('is-hidden');
        const calendarHeader = this.calendarEl.createDiv('daily-notes-timeline-calendar-header');
        this.calendarTitleEl = calendarHeader.createDiv('daily-notes-timeline-calendar-title');
        const calendarNav = calendarHeader.createDiv('daily-notes-timeline-calendar-nav');
        const prevButton = calendarNav.createEl('button', { text: '<', cls: 'daily-notes-timeline-calendar-nav-button' });
        const todayButton = calendarNav.createEl('button', { text: 'Today', cls: 'daily-notes-timeline-calendar-nav-button' });
        const nextButton = calendarNav.createEl('button', { text: '>', cls: 'daily-notes-timeline-calendar-nav-button' });
        this.registerDomEvent(prevButton, 'click', () => this.shiftCalendarMonth(-1));
        this.registerDomEvent(todayButton, 'click', () => this.scrollToToday());
        this.registerDomEvent(nextButton, 'click', () => this.shiftCalendarMonth(1));
        this.calendarGridEl = this.calendarEl.createDiv('daily-notes-timeline-calendar-grid');

        this.toggleButtonEl = this.contentEl.createEl('button', {
            cls: 'daily-notes-timeline-calendar-toggle'
        });
        setIcon(this.toggleButtonEl, 'calendar');
        this.registerDomEvent(this.toggleButtonEl, 'click', () => this.toggleCalendar());
    }

    setVisible(isVisible: boolean) {
        this.isVisible = isVisible;
        this.applyVisibility();
    }

    updateForDate(dateKey: string) {
        this.currentTopDateKey = dateKey;
        const date = getDateFromKey(dateKey);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        if (monthKey !== this.currentMonthKey) {
            this.currentMonthKey = monthKey;
            this.currentMonthDate = new Date(date.getFullYear(), date.getMonth(), 1);
            this.renderCalendar(this.currentMonthDate, dateKey);
            return;
        }
        this.updateCalendarHighlight(dateKey);
    }

    private applyVisibility() {
        if (!this.calendarEl) {
            return;
        }
        this.calendarEl.toggleClass('is-hidden', !this.isVisible);
        this.contentEl.toggleClass('daily-notes-timeline-calendar-open', this.isVisible);
        if (this.currentTopDateKey) {
            this.updateForDate(this.currentTopDateKey);
        }
    }

    private toggleCalendar() {
        this.isVisible = !this.isVisible;
        this.settings.dailyNoteTimelineCalendarDefaultOpen = this.isVisible;
        this.onQueueSettingsSave();
        this.applyVisibility();
        if (!this.currentTopDateKey) {
            this.updateForDate(toISODateKey(new Date()));
        }
    }

    private shiftCalendarMonth(offset: number) {
        const base = this.currentMonthDate ?? new Date();
        const next = new Date(base.getFullYear(), base.getMonth() + offset, 1);
        this.currentMonthDate = next;
        this.currentMonthKey = `${next.getFullYear()}-${(next.getMonth() + 1).toString().padStart(2, '0')}`;
        const activeKey = this.currentTopDateKey ?? toISODateKey(new Date());
        this.renderCalendar(next, activeKey);
    }

    private scrollToToday() {
        const todayKey = toISODateKey(new Date());
        this.onScrollToToday();
        this.updateForDate(todayKey);
    }

    private renderCalendar(baseDate: Date, activeKey: string) {
        if (!this.calendarEl || !this.calendarGridEl) {
            return;
        }
        if (this.calendarTitleEl) {
            const monthLabel = `${baseDate.getFullYear()}-${(baseDate.getMonth() + 1).toString().padStart(2, '0')}`;
            this.calendarTitleEl.textContent = monthLabel;
        }

        this.calendarGridEl.empty();
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (const [index, dayName] of weekdays.entries()) {
            const dayEl = this.calendarGridEl.createDiv('daily-notes-timeline-calendar-weekday');
            dayEl.textContent = dayName;
            if (index === 0) {
                dayEl.addClass('is-sun');
            } else if (index === 6) {
                dayEl.addClass('is-sat');
            }
        }

        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const startWeekday = firstDay.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < startWeekday; i += 1) {
            this.calendarGridEl.createDiv('daily-notes-timeline-calendar-empty');
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = new Date(year, month, day);
            const key = toISODateKey(date);
            const dayEl = this.calendarGridEl.createDiv('daily-notes-timeline-calendar-day');
            dayEl.textContent = day.toString();
            dayEl.dataset.date = key;
            if (key === activeKey) {
                dayEl.addClass('is-active');
            }
            this.registerDomEvent(dayEl, 'click', () => this.onJumpToDateKey(key));
        }

        const usedCells = startWeekday + daysInMonth;
        const trailingCells = (7 - (usedCells % 7)) % 7;
        const totalCells = usedCells + trailingCells;
        const remainingToSixRows = Math.max(0, 42 - totalCells);
        for (let i = 0; i < trailingCells + remainingToSixRows; i += 1) {
            this.calendarGridEl.createDiv('daily-notes-timeline-calendar-empty');
        }
    }

    private updateCalendarHighlight(activeKey: string) {
        if (!this.calendarGridEl) {
            return;
        }
        const activeEl = this.calendarGridEl.querySelector('.daily-notes-timeline-calendar-day.is-active');
        if (activeEl) {
            activeEl.classList.remove('is-active');
        }
        const targetEl = this.calendarGridEl.querySelector(`[data-date="${activeKey}"]`);
        if (targetEl) {
            targetEl.classList.add('is-active');
        }
    }
}
