#!/usr/bin/env node
/**
 * Iteratively fix extensionless relative imports surfaced by `deno check`
 * on an Edge Function entrypoint. Stops when check passes or no fix applied.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENTRY = process.argv[2] ?? "supabase/functions/process-user-edition-job/index.ts";

function denoCheck() {
  const result = spawnSync(
    "npx",
    ["--yes", "deno@2.1.4", "check", "--no-lock", "index.ts"],
    {
      cwd: join(ROOT, dirname(ENTRY)),
      encoding: "utf8",
    }
  );
  return (result.stdout ?? "") + (result.stderr ?? "");
}

function parseError(output) {
  const missing = output.match(
    /Module not found "file:\/\/\/[^"]+\/kindred\/([^"]+)"/
  );
  const at = output.match(
    /at file:\/\/\/[^"]+\/kindred\/([^:]+):(\d+):(\d+)/
  );
  if (!missing || !at) return null;
  return {
    missingPath: missing[1],
    filePath: at[1],
    line: Number(at[2]),
    col: Number(at[3]),
  };
}

function tryFix(err) {
  const fileAbs = join(ROOT, err.filePath);
  const lines = readFileSync(fileAbs, "utf8").split("\n");
  const lineIdx = err.line - 1;
  const line = lines[lineIdx];
  if (!line) return false;

  const importMatch = line.match(
    /from\s+["'](\.\.?\/[^"']+)["']/
  );
  const inlineMatch = line.match(
    /import\(["'](\.\.?\/[^"']+)["']\)/
  );
  const spec = importMatch?.[1] ?? inlineMatch?.[1];
  if (!spec) return false;
  if (spec.endsWith(".ts") || spec.endsWith(".tsx")) return false;

  const dir = dirname(fileAbs);
  const candidate = join(dir, `${spec}.ts`);
  const candidateIndex = join(dir, spec, "index.ts");
  let ext;
  if (existsSync(candidate)) {
    ext = ".ts";
  } else if (existsSync(candidateIndex)) {
    ext = "/index.ts";
  } else {
    return false;
  }

  const fixed = line
    .replace(`from "${spec}"`, `from "${spec}${ext}"`)
    .replace(`from '${spec}'`, `from '${spec}${ext}'`)
    .replace(`import("${spec}")`, `import("${spec}${ext}")`)
    .replace(`import('${spec}')`, `import('${spec}${ext}')`);
  if (fixed === line) return false;

  lines[lineIdx] = fixed;
  writeFileSync(fileAbs, lines.join("\n"));
  console.log(`fixed ${err.filePath}:${err.line}  ${spec} -> ${spec}.ts`);
  return true;
}

for (let i = 0; i < 200; i++) {
  const output = denoCheck();
  if (!/error:/i.test(output)) {
    console.log("deno check passed");
    process.exit(0);
  }
  const err = parseError(output);
  if (!err) {
    console.error(output);
    process.exit(1);
  }
  if (!tryFix(err)) {
    console.error("could not auto-fix:\n", output);
    process.exit(1);
  }
}

console.error("max iterations reached");
process.exit(1);
