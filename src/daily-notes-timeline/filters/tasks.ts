const TASK_LINE_REGEX = /^\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s+/;

export function isTaskLine(line: string): boolean {
    return TASK_LINE_REGEX.test(line);
}

export function filterTasksContent(content: string): string | null {
    const lines = content.split('\n');
    const taskLines = lines.filter(line => isTaskLine(line));
    return taskLines.length > 0 ? taskLines.join('\n') : null;
}
