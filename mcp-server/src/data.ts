import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SyllabaData } from './types.js';

const DATA_FILE = join(homedir(), '.syllaba', 'data.json');

/**
 * Reads courses/assignments fresh from disk on every call — no caching.
 * The file changes whenever the desktop app is used, and this server has
 * no way to be notified of that, so a cached copy would silently go stale.
 */
export function readSyllabaData(): SyllabaData | null {
  if (!existsSync(DATA_FILE)) return null;
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : []
    };
  } catch {
    return null;
  }
}

export const DATA_FILE_PATH = DATA_FILE;
