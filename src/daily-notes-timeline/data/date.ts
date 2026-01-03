export function toISODateKey(date: Date): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getDateFromKey(key: string): Date {
    const [year, month, day] = key.split('-').map(value => parseInt(value, 10));
    return new Date(year, month - 1, day);
}

type DateMatchPattern = {
    regex: RegExp;
    yearIndex?: number;
    monthIndex?: number;
    dayIndex?: number;
};

const DATE_PATTERN_CACHE = new Map<string, DateMatchPattern | null>();

const DATE_TOKENS: Record<string, { pattern: string; capture?: 'year' | 'month' | 'day' }> = {
    YYYY: { pattern: '\\d{4}', capture: 'year' },
    YY: { pattern: '\\d{2}', capture: 'year' },
    MM: { pattern: '\\d{2}', capture: 'month' },
    M: { pattern: '\\d{1,2}', capture: 'month' },
    DD: { pattern: '\\d{2}', capture: 'day' },
    D: { pattern: '\\d{1,2}', capture: 'day' }
};

const NON_DATE_TOKENS: Record<string, string> = {
    H: '\\d{1,2}',
    HH: '\\d{2}',
    h: '\\d{1,2}',
    hh: '\\d{2}',
    m: '\\d{1,2}',
    mm: '\\d{2}',
    s: '\\d{1,2}',
    ss: '\\d{2}',
    S: '\\d{1}',
    SS: '\\d{2}',
    SSS: '\\d{3}',
    A: '[A-Za-z]+',
    a: '[A-Za-z]+',
    Z: '[+-]\\d{2}:?\\d{2}',
    ZZ: '[+-]\\d{2}:?\\d{2}',
    d: '\\d',
    dd: '\\d{2}',
    ddd: '[^\\d]+',
    dddd: '[^\\d]+',
    w: '\\d{1,2}',
    ww: '\\d{2}',
    W: '\\d{1,2}',
    WW: '\\d{2}',
    Q: '\\d',
    X: '\\d+',
    x: '\\d+',
    MMM: '[^\\d]+',
    MMMM: '[^\\d]+'
};

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTwoDigitYear(year: number): number {
    return year <= 68 ? 2000 + year : 1900 + year;
}

function tokenizeFormat(format: string): Array<{ type: 'literal' | 'token'; value: string }> {
    const tokens: Array<{ type: 'literal' | 'token'; value: string }> = [];
    let i = 0;
    while (i < format.length) {
        const char = format[i];
        if (char === '[') {
            const end = format.indexOf(']', i + 1);
            if (end === -1) {
                tokens.push({ type: 'literal', value: char });
                i += 1;
                continue;
            }
            const literal = format.slice(i + 1, end);
            tokens.push({ type: 'literal', value: literal });
            i = end + 1;
            continue;
        }
        if (/[A-Za-z]/.test(char)) {
            let j = i + 1;
            while (j < format.length && format[j] === char) {
                j += 1;
            }
            tokens.push({ type: 'token', value: format.slice(i, j) });
            i = j;
            continue;
        }
        tokens.push({ type: 'literal', value: char });
        i += 1;
    }
    return tokens;
}

function buildDatePattern(format: string): DateMatchPattern | null {
    if (!format) {
        return null;
    }
    const cached = DATE_PATTERN_CACHE.get(format);
    if (cached !== undefined) {
        return cached;
    }
    const tokens = tokenizeFormat(format);
    const parts: string[] = ['^'];
    let groupIndex = 0;
    let yearIndex: number | undefined;
    let monthIndex: number | undefined;
    let dayIndex: number | undefined;

    for (const token of tokens) {
        if (token.type === 'literal') {
            parts.push(escapeRegex(token.value));
            continue;
        }
        const dateToken = DATE_TOKENS[token.value];
        if (dateToken) {
            groupIndex += 1;
            parts.push(`(${dateToken.pattern})`);
            if (dateToken.capture === 'year' && yearIndex === undefined) {
                yearIndex = groupIndex;
            }
            if (dateToken.capture === 'month' && monthIndex === undefined) {
                monthIndex = groupIndex;
            }
            if (dateToken.capture === 'day' && dayIndex === undefined) {
                dayIndex = groupIndex;
            }
            continue;
        }
        const nonDatePattern = NON_DATE_TOKENS[token.value] ?? '[^\\d]+';
        parts.push(`(?:${nonDatePattern})`);
    }

    parts.push('$');
    const pattern = {
        regex: new RegExp(parts.join('')),
        yearIndex,
        monthIndex,
        dayIndex
    };
    DATE_PATTERN_CACHE.set(format, pattern);
    return pattern;
}

export function extractDateFromFileName(fileName: string, format: string): Date | null {
    const pattern = buildDatePattern(format);
    if (!pattern || pattern.yearIndex === undefined || pattern.monthIndex === undefined || pattern.dayIndex === undefined) {
        return null;
    }
    const match = fileName.match(pattern.regex);
    if (!match) {
        return null;
    }
    const yearText = match[pattern.yearIndex];
    const monthText = match[pattern.monthIndex];
    const dayText = match[pattern.dayIndex];
    if (!yearText || !monthText || !dayText) {
        return null;
    }
    let year = parseInt(yearText, 10);
    if (yearText.length === 2) {
        year = normalizeTwoDigitYear(year);
    }
    const month = parseInt(monthText, 10);
    const day = parseInt(dayText, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }
    const date = new Date(year, month - 1, day);
    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }
    return date;
}
