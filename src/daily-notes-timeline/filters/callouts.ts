const CALLOUT_START_REGEX = /^\s*>\s*\[![^\]]+\]/;
const CALLOUT_LINE_REGEX = /^\s*>/;

export function filterCalloutsContent(content: string): string | null {
    const lines = content.split('\n');
    const blocks: string[] = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line) {
            i += 1;
            continue;
        }
        if (!CALLOUT_START_REGEX.test(line)) {
            i += 1;
            continue;
        }
        const blockLines: string[] = [];
        blockLines.push(line);
        i += 1;
        while (i < lines.length) {
            const nextLine = lines[i];
            if (!nextLine || !CALLOUT_LINE_REGEX.test(nextLine)) {
                break;
            }
            blockLines.push(nextLine);
            i += 1;
        }
        blocks.push(blockLines.join('\n'));
    }
    return blocks.length > 0 ? blocks.join('\n\n') : null;
}
