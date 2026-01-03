function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isExcludedNode(node: Node | null): boolean {
    if (!node || !(node instanceof HTMLElement)) {
        return false;
    }
    const tag = node.tagName;
    return tag === 'CODE' || tag === 'PRE' || tag === 'MARK';
}

export function highlightMatches(container: HTMLElement, query: string) {
    const terms = query
        .trim()
        .split(/\s+/)
        .filter(term => term.length > 0);
    if (terms.length === 0) {
        return;
    }
    const pattern = terms.map(term => escapeRegExp(term)).join('|');
    const regex = new RegExp(pattern, 'gi');
    const testRegex = new RegExp(pattern, 'i');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
            if (!node.parentElement) {
                return NodeFilter.FILTER_REJECT;
            }
            if (isExcludedNode(node.parentElement) || isExcludedNode(node.parentElement.closest('code, pre, mark'))) {
                return NodeFilter.FILTER_REJECT;
            }
            if (!testRegex.test(node.nodeValue ?? '')) {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    const nodes: Text[] = [];
    let current = walker.nextNode();
    while (current) {
        nodes.push(current as Text);
        current = walker.nextNode();
    }

    for (const textNode of nodes) {
        const text = textNode.nodeValue ?? '';
        regex.lastIndex = 0;
        if (!regex.test(text)) {
            continue;
        }
        regex.lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (start > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            }
            const mark = document.createElement('mark');
            mark.className = 'daily-notes-timeline-highlight';
            mark.textContent = text.slice(start, end);
            fragment.appendChild(mark);
            lastIndex = end;
        }
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode?.replaceChild(fragment, textNode);
    }
}
