type HeadingSectionRange = { start: number; end: number };

export function findHeadingSectionRange(lines: string[], headingText: string): HeadingSectionRange | null {
    const targetText = headingText.replace(/^#+\s*/, '').trim();
    if (!targetText) {
        return null;
    }
    let startIndex = -1;
    let level = 1;
    for (let i = 0; i < lines.length; i += 1) {
        const match = lines[i].match(/^(#+)\s+(.*)$/);
        if (!match) {
            continue;
        }
        const [, hashes, text] = match;
        if (text.trim() === targetText) {
            startIndex = i;
            level = hashes.length;
            break;
        }
    }
    if (startIndex === -1) {
        return null;
    }
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i += 1) {
        const headingMatch = lines[i].match(/^(#+)\s/);
        if (headingMatch && headingMatch[1].length <= level) {
            endIndex = i;
            break;
        }
    }
    return { start: startIndex + 1, end: endIndex };
}

export function extractHeadingSectionFromContent(content: string, headingText: string): string | null {
    const lines = content.split('\n');
    const range = findHeadingSectionRange(lines, headingText);
    if (!range) {
        return null;
    }
    const sectionLines = lines.slice(range.start, range.end);
    return sectionLines.length > 0 ? sectionLines.join('\n') : null;
}
