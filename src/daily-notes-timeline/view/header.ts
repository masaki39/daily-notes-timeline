import { TimelineFilterMode } from '../filters/filter';

type HeaderOptions = {
    contentEl: HTMLElement;
    registerDomEvent: (el: HTMLElement, type: string, callback: (event: Event) => any) => void;
    activeFilter: TimelineFilterMode;
    headingFilterText: string;
    searchQuery: string;
    isHeaderCollapsed: boolean;
    onFilterChange: (mode: TimelineFilterMode) => void;
    onHeadingInput: (value: string) => void;
    onSearchInput: (value: string) => void;
    onToday: () => void;
    onHeaderToggle: () => void;
};

export type HeaderElements = {
    filterTabButtons: HTMLButtonElement[];
    filterHeadingInputEl: HTMLInputElement;
    searchInputEl: HTMLInputElement;
    headerEl: HTMLElement;
    headerToggleButton: HTMLButtonElement;
};

export function buildTimelineHeader(options: HeaderOptions): HeaderElements {
    const headerEl = options.contentEl.createDiv('daily-notes-timeline-header');
    if (options.isHeaderCollapsed) {
        headerEl.addClass('is-collapsed');
    }

    const headerToggleButton = headerEl.createEl('button', {
        text: options.isHeaderCollapsed ? 'v' : '^',
        cls: 'daily-notes-timeline-header-toggle'
    });
    options.registerDomEvent(headerToggleButton, 'click', () => options.onHeaderToggle());

    const headerControls = headerEl.createDiv('daily-notes-timeline-controls');
    const headerTopRow = headerControls.createDiv('daily-notes-timeline-header-row');
    const headerBottomRow = headerControls.createDiv('daily-notes-timeline-header-row');

    const searchInputEl = headerTopRow.createEl('input', {
        cls: 'daily-notes-timeline-search',
        type: 'text',
        placeholder: 'Search'
    });
    searchInputEl.value = options.searchQuery;

    const headerTodayButton = headerTopRow.createEl('button', {
        text: 'Today',
        cls: 'daily-notes-timeline-today'
    });

    const filterTabsEl = headerBottomRow.createDiv('daily-notes-timeline-filter-tabs');
    const filterTabButtons: HTMLButtonElement[] = [];
    const filters: Array<{ label: string; mode: TimelineFilterMode }> = [
        { label: 'All', mode: 'all' },
        { label: 'Tasks', mode: 'tasks' },
        { label: 'Lists', mode: 'lists' },
        { label: 'Links', mode: 'links' },
        { label: 'Images', mode: 'images' },
        { label: 'Callouts', mode: 'callouts' },
        { label: 'Heading', mode: 'heading' }
    ];
    for (const filter of filters) {
        const button = filterTabsEl.createEl('button', {
            text: filter.label,
            cls: 'daily-notes-timeline-filter-tab'
        });
        button.dataset.filter = filter.mode;
        filterTabButtons.push(button);
        options.registerDomEvent(button, 'click', () => options.onFilterChange(filter.mode));
    }

    const filterHeadingInputEl = headerBottomRow.createEl('input', {
        cls: 'daily-notes-timeline-filter-heading',
        type: 'text',
        placeholder: '# Time Line'
    });
    filterHeadingInputEl.value = options.headingFilterText;

    options.registerDomEvent(filterHeadingInputEl, 'input', () => {
        options.onHeadingInput(filterHeadingInputEl.value ?? '');
    });
    options.registerDomEvent(searchInputEl, 'input', () => {
        options.onSearchInput(searchInputEl.value ?? '');
    });

    options.registerDomEvent(headerTodayButton, 'click', () => options.onToday());

    return { filterTabButtons, filterHeadingInputEl, searchInputEl, headerEl, headerToggleButton };
}
