import test from "node:test";
import assert from "node:assert/strict";
import { T } from "../src/text.js";

test("no em dash in any text", () => {
  for (const [k, v] of Object.entries(T)) assert.ok(!v.includes("—"), k);
});

test("every text the code asks for exists", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../src/", import.meta.url);
  const code = readdirSync(dir).filter((f) => f.endsWith(".jsx")).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  for (const [, key] of code.matchAll(/\bt\("([\w.-]+)"/g)) assert.ok(key in T, key);
});
