/**
 * Filesystem access to the vendored font files. Node only — used by tests and
 * by any server-side render. The browser resolves fonts by URL instead.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "files");

export function fontFilePath(fileName: string): string {
  return path.join(FILES_DIR, fileName);
}

export function readFontFile(fileName: string): Buffer {
  return readFileSync(fontFilePath(fileName));
}

export const nodeFontResolver = fontFilePath;
