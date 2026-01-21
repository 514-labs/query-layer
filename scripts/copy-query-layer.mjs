#!/usr/bin/env node

/**
 * Copy the query-layer source to a target directory.
 *
 * Usage:
 *   pnpm copy:query-layer -- --to /path/to/your-project/moose/src/query-layer
 *
 * Or directly:
 *   node scripts/copy-query-layer.mjs --to /path/to/destination
 */

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, "..", "src");

function parseArgs(args) {
  const toIndex = args.indexOf("--to");
  if (toIndex === -1 || toIndex === args.length - 1) {
    return null;
  }
  return args[toIndex + 1];
}

function main() {
  const destination = parseArgs(process.argv);

  if (!destination) {
    console.error(`
Usage: pnpm copy:query-layer -- --to <destination>

Example:
  pnpm copy:query-layer -- --to /path/to/your-project/moose/src/query-layer

This copies the query-layer source files from this repo's /src folder
to the specified destination directory.
`);
    process.exit(1);
  }

  const destPath = resolve(destination);

  // Create destination directory if it doesn't exist
  if (!existsSync(destPath)) {
    mkdirSync(destPath, { recursive: true });
    console.log(`Created directory: ${destPath}`);
  }

  // Copy source files
  try {
    cpSync(SRC_DIR, destPath, { recursive: true });
    console.log(`\nSuccessfully copied query-layer to:\n  ${destPath}\n`);
    console.log(`Next steps:`);
    console.log(`  1. Import in your code:`);
    console.log(`     import { defineQueryModel, buildQuery } from "./query-layer";`);
    console.log(`  2. Define your query models and start building type-safe queries!\n`);
  } catch (error) {
    console.error(`Error copying files: ${error.message}`);
    process.exit(1);
  }
}

main();
