import { TFile } from 'obsidian';
import { getDateFromKey } from '../data';

export type TimelineDateIndex = {
    dateKeys: string[];
    dateNumbers: number[];
    indexByDateKey: Map<string, number>;
};

export function dateKeyToNumber(dateKey: string): number {
    if (!dateKey) {
        return Number.NaN;
    }
    const raw = dateKey.replace(/-/g, '');
    const num = Number.parseInt(raw, 10);
    return Number.isFinite(num) ? num : Number.NaN;
}

export function buildDateIndex(files: TFile[], resolveDateKey: (file: TFile) => string | null): TimelineDateIndex {
    const dateKeys = files.map(file => resolveDateKey(file) ?? '');
    const dateNumbers = dateKeys.map(key => dateKeyToNumber(key));
    const indexByDateKey = new Map<string, number>();
    for (let i = 0; i < dateKeys.length; i += 1) {
        const key = dateKeys[i];
        if (key) {
            indexByDateKey.set(key, i);
        }
    }
    return { dateKeys, dateNumbers, indexByDateKey };
}

type FindNearestOptions = {
    files: TFile[];
    index: TimelineDateIndex;
    targetDateKey: string;
    hasFilteredContent: (file: TFile) => Promise<boolean>;
};

export async function findNearestIndexWithContent(options: FindNearestOptions): Promise<number> {
    const length = options.files.length;
    if (length === 0) {
        return -1;
    }
    const targetDate = getDateFromKey(options.targetDateKey);
    const targetNumber = dateKeyToNumber(options.targetDateKey);
    if (!Number.isFinite(targetNumber) || Number.isNaN(targetDate.getTime())) {
        for (let i = 0; i < length; i += 1) {
            if (await options.hasFilteredContent(options.files[i])) {
                return i;
            }
        }
        return -1;
    }
    let left = 0;
    let right = length - 1;
    let insertionIndex = length;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midNumber = options.index.dateNumbers[mid];
        if (!Number.isFinite(midNumber)) {
            left = mid + 1;
            continue;
        }
        if (midNumber === targetNumber) {
            insertionIndex = mid;
            break;
        }
        if (midNumber > targetNumber) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
        insertionIndex = left;
    }

    const candidates: number[] = [];
    if (insertionIndex < length) {
        candidates.push(insertionIndex);
    }
    if (insertionIndex - 1 >= 0) {
        candidates.push(insertionIndex - 1);
    }
    let startIndex = candidates[0] ?? 0;
    if (candidates.length > 1) {
        const firstKey = options.index.dateKeys[candidates[0]];
        const secondKey = options.index.dateKeys[candidates[1]];
        if (firstKey && secondKey) {
            const firstDiff = Math.abs(getDateFromKey(firstKey).getTime() - targetDate.getTime());
            const secondDiff = Math.abs(getDateFromKey(secondKey).getTime() - targetDate.getTime());
            startIndex = firstDiff <= secondDiff ? candidates[0] : candidates[1];
        }
    }

    if (await options.hasFilteredContent(options.files[startIndex])) {
        return startIndex;
    }

    const orderedCandidates: number[] = [];
    let leftIndex = startIndex - 1;
    let rightIndex = startIndex + 1;
    while (leftIndex >= 0 || rightIndex < length) {
        let chooseLeft = false;
        if (leftIndex >= 0 && rightIndex < length) {
            const leftKey = options.index.dateKeys[leftIndex];
            const rightKey = options.index.dateKeys[rightIndex];
            if (!leftKey) {
                chooseLeft = false;
            } else if (!rightKey) {
                chooseLeft = true;
            } else {
                const leftDiff = Math.abs(getDateFromKey(leftKey).getTime() - targetDate.getTime());
                const rightDiff = Math.abs(getDateFromKey(rightKey).getTime() - targetDate.getTime());
                chooseLeft = leftDiff <= rightDiff;
            }
        } else if (leftIndex >= 0) {
            chooseLeft = true;
        }

        if (chooseLeft) {
            orderedCandidates.push(leftIndex);
            leftIndex -= 1;
        } else if (rightIndex < length) {
            orderedCandidates.push(rightIndex);
            rightIndex += 1;
        }
    }

    const batchSize = 4;
    for (let i = 0; i < orderedCandidates.length; i += batchSize) {
        const batch = orderedCandidates.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(index => options.hasFilteredContent(options.files[index]))
        );
        for (let j = 0; j < results.length; j += 1) {
            if (results[j]) {
                return batch[j];
            }
        }
    }

    return -1;
}
