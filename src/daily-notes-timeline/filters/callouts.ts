const CALLOUT_START_REGEX = /^\s*>\s*\[![^\]]+\]/;
const CALLOUT_LINE_REGEX = /^\s*>/;

export function filterCalloutsContent(content: string): string | null {
    const lines = content.split('\n');
    const blocks: string[] = [];
    let i = 0;
    while (i < lines.length) {
        if (!CALLOUT_START_REGEX.test(lines[i])) {
            i += 1;
            continue;
        }
        const blockLines: string[] = [];
        blockLines.push(lines[i]);
        i += 1;
        while (i < lines.length && CALLOUT_LINE_REGEX.test(lines[i])) {
            blockLines.push(lines[i]);
            i += 1;
        }
        blocks.push(blockLines.join('\n'));
    }
    return blocks.length > 0 ? blocks.join('\n\n') : null;
}
