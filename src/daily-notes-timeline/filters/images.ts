const IMAGE_EMBED_REGEX = /!\[\[[^\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)\]\]/i;
const IMAGE_LINK_REGEX = /!\[[^\]]*]\([^)]+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^)]*)?\)/i;
const IMAGE_HTML_REGEX = /<img\s[^>]*>/i;
const IMAGE_LINE_REGEX = new RegExp(
    `${IMAGE_EMBED_REGEX.source}|${IMAGE_LINK_REGEX.source}|${IMAGE_HTML_REGEX.source}`,
    'i'
);

export function filterImagesContent(content: string): string | null {
    const lines = content.split('\n');
    const imageLines = lines.filter(line => IMAGE_LINE_REGEX.test(line));
    return imageLines.length > 0 ? imageLines.join('\n') : null;
}
