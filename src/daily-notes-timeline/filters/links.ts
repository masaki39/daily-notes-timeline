const LINK_LINE_REGEX = /(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))|(https?:\/\/\S+)/;

export function filterLinksContent(content: string): string | null {
    const lines = content.split('\n');
    const linkLines = lines.filter(line => LINK_LINE_REGEX.test(line));
    return linkLines.length > 0 ? linkLines.join('\n') : null;
}
