/**
 * Regenerates the template gallery's pictures.
 *
 *   pnpm thumbnails:build
 *
 * Runs `template-images.test.ts` in update mode, which is where the rendering
 * lives — it needs the emitter, which needs the project's TypeScript and path
 * aliases, which Vitest already resolves. A wrapper rather than an inline
 * environment variable in `package.json` because `VAR=1 cmd` is not a thing
 * `cmd.exe` understands, and this repository is developed on Windows.
 */

import { spawnSync } from "node:child_process";
import process from "node:process";

const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "src/lib/thumbnail/template-images.test.ts"],
  { stdio: "inherit", env: { ...process.env, UPDATE_TEMPLATE_IMAGES: "1" } },
);
process.exit(result.status ?? 1);
