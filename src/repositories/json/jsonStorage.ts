import fs from 'fs';
import path from 'path';

export interface JsonStorePaths {
  dataDir: string;
  usersFile: string;
  sessionsFile: string;
  attemptsFile: string;
  progressFile: string;
  historyFile: string;
  groupsFile: string;
  questionsFile: string;
}

export function resolveJsonStorePaths(dataDir?: string): JsonStorePaths {
  const dir = dataDir || path.join(process.cwd(), 'server-data');
  return {
    dataDir: dir,
    usersFile: path.join(dir, 'users.json'),
    sessionsFile: path.join(dir, 'sessions.json'),
    attemptsFile: path.join(dir, 'attempts.json'),
    progressFile: path.join(dir, 'progress.json'),
    historyFile: path.join(dir, 'user_history.json'),
    groupsFile: path.join(dir, 'groups.json'),
    questionsFile: path.join(dir, 'questions_bank.json')
  };
}

export function readJsonStoreFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`Error reading JSON store ${filePath}:`, err);
  }
  return fallback;
}

export function writeJsonStoreFile<T>(filePath: string, data: T): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
