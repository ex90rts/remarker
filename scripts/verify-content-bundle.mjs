import { readFile } from "node:fs/promises";

const content = await readFile(new URL("../dist/content.js", import.meta.url), "utf8");

if (/^\s*(?:import|export)\b/u.test(content)) {
  throw new Error(
    "dist/content.js must be a self-contained classic script; ESM imports and exports are not supported by manifest content_scripts.",
  );
}

if (!/^\s*\(function\(\)\{/u.test(content)) {
  throw new Error("dist/content.js was not generated as a self-contained IIFE.");
}
