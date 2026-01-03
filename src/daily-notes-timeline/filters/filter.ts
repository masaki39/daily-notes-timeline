import { extractHeadingSectionFromContent } from './header';
import { filterCalloutsContent } from './callouts';
import { filterImagesContent } from './images';
import { filterLinksContent } from './links';
import { filterListsContent } from './lists';
import { filterTasksContent } from './tasks';

export type TimelineFilterMode = 'all' | 'tasks' | 'lists' | 'links' | 'images' | 'callouts' | 'heading';

export function filterTimelineContent(content: string, mode: TimelineFilterMode, headingText: string): string | null {
    if (mode === 'tasks') {
        return filterTasksContent(content);
    }
    if (mode === 'lists') {
        return filterListsContent(content);
    }
    if (mode === 'links') {
        return filterLinksContent(content);
    }
    if (mode === 'images') {
        return filterImagesContent(content);
    }
    if (mode === 'callouts') {
        return filterCalloutsContent(content);
    }
    if (mode === 'heading') {
        return extractHeadingSectionFromContent(content, headingText);
    }
    return content;
}
