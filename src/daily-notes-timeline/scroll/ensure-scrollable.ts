type EnsureScrollableOptions = {
    scrollerEl: HTMLDivElement;
    getStartIndex: () => number;
    getEndIndex: () => number;
    getNoteFilesLength: () => number;
    loadNext: () => Promise<void>;
    loadPrevious: () => Promise<void>;
    scheduleTopVisibleUpdate: () => void;
};

export async function ensureScrollable(options: EnsureScrollableOptions): Promise<void> {
    let guard = 0;
    const maxIterations = Math.max(10, options.getNoteFilesLength());
    while (options.scrollerEl.scrollHeight <= options.scrollerEl.clientHeight + 32) {
        const previousHeight = options.scrollerEl.scrollHeight;
        if (options.getStartIndex() === 0 && options.getEndIndex() >= options.getNoteFilesLength() - 1) {
            break;
        }
        if (options.getEndIndex() < options.getNoteFilesLength() - 1) {
            await options.loadNext();
        } else if (options.getStartIndex() > 0) {
            await options.loadPrevious();
        } else {
            break;
        }
        guard += 1;
        if (options.scrollerEl.scrollHeight <= previousHeight + 1) {
            break;
        }
        if (guard >= maxIterations) {
            break;
        }
    }
    options.scheduleTopVisibleUpdate();
}
