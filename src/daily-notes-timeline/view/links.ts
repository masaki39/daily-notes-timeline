type RegisterDomEvent = (el: HTMLElement, type: string, callback: (event: Event) => any) => void;

export function attachTimelineLinkHandler(
    registerDomEvent: RegisterDomEvent,
    container: HTMLElement,
    sourcePath: string,
    onOpenLink: (href: string, sourcePath: string, openInNewLeaf: boolean, isExternal: boolean) => void
) {
    if (container.dataset.dailyNotesTimelineLinkHandlerAttached === '1') {
        return;
    }
    container.dataset.dailyNotesTimelineLinkHandlerAttached = '1';
    registerDomEvent(container, 'click', (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const linkEl = target?.closest('a') as HTMLAnchorElement | null;
        if (!linkEl) {
            return;
        }
        const dataHref = linkEl.getAttribute('data-href');
        const href = dataHref ?? linkEl.getAttribute('href');
        if (!href) {
            return;
        }
        const openInNewLeaf = event.metaKey || event.ctrlKey;

        if (dataHref) {
            event.preventDefault();
            onOpenLink(dataHref, sourcePath, openInNewLeaf, false);
            return;
        }

        const isExternal = /^(https?:|mailto:|file:)/.test(href);
        if (isExternal) {
            event.preventDefault();
            onOpenLink(href, sourcePath, openInNewLeaf, true);
            return;
        }

        event.preventDefault();
        onOpenLink(href, sourcePath, openInNewLeaf, false);
    });
}
