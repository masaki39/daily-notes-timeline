import { isTaskLine } from './tasks';

const LIST_LINE_REGEX = /^\s*(?:[-*+]|\d+\.)\s+/;

function isListLine(line: string): boolean {
    return LIST_LINE_REGEX.test(line);
}

export function filterListsContent(content: string): string | null {
    const lines = content.split('\n');
    const listLines = lines.filter(line => isListLine(line) && !isTaskLine(line));
    return listLines.length > 0 ? listLines.join('\n') : null;
}
