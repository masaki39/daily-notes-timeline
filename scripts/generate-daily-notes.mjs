import { promises as fs } from 'node:fs';
import path from 'node:path';

const VAULT_PATH = process.env.VAULT_PATH
  ? path.resolve(process.env.VAULT_PATH)
  : path.resolve(process.cwd(), '../../..');
const DAILY_NOTES_FOLDER = 'DailyNotes';
const DATE_FORMAT = 'YYYY-MM-DD';
const TOTAL_DAYS = 3650;

const dailyNotesPath = path.join(VAULT_PATH, DAILY_NOTES_FOLDER);

function toISODateKey(date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildRandomContent(dateKey) {
  const tasks = Array.from({ length: randomInt(1, 4) }, (_, i) => {
    const done = Math.random() > 0.7 ? 'x' : ' ';
    return `- [${done}] Task ${i + 1} for ${dateKey}`;
  });

  const links = Array.from({ length: randomInt(1, 3) }, (_, i) => {
    return `- [[Note-${dateKey}-${i + 1}]]`;
  });

  const lists = Array.from({ length: randomInt(1, 3) }, (_, i) => {
    return `- Item ${i + 1}`;
  });

  const callouts = [
    '> [!info] Log',
    `> Random note for ${dateKey}.`
  ];

  const images = [
    `![img](attachments/${dateKey}.png)`
  ];

  return [
    `# Daily Note ${dateKey}`,
    '',
    '## Timeline',
    ...tasks,
    '',
    '## Links',
    ...links,
    '',
    '## List',
    ...lists,
    '',
    '## Callout',
    ...callouts,
    '',
    '## Image',
    ...images,
    ''
  ].join('\n');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  if (DATE_FORMAT !== 'YYYY-MM-DD') {
    throw new Error('This script assumes YYYY-MM-DD file names.');
  }

  await ensureDir(dailyNotesPath);

  const endDate = new Date();
  let created = 0;
  for (let i = 0; i < TOTAL_DAYS; i += 1) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - i);
    const dateKey = toISODateKey(date);
    const filePath = path.join(dailyNotesPath, `${dateKey}.md`);
    const content = buildRandomContent(dateKey);
    await fs.writeFile(filePath, content, 'utf8');
    created += 1;
  }

  console.log(`Created ${created} daily notes in ${dailyNotesPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
