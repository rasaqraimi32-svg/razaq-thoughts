import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, mocks) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const result = { exports: {} };
  vm.runInNewContext(compiled, { exports: result.exports, module: result, AbortController, setTimeout, clearTimeout, require: name => {
    if (name === "server-only") return {};
    if (name in mocks) return mocks[name];
    throw new Error("Unexpected import: " + name);
  } });
  return result.exports;
}
const { readQuery } = load("src/lib/journal/read-query.ts", {});
function query(promise) {
  return { signal: null, then: promise.then.bind(promise), abortSignal(signal) { this.signal = signal; return promise; } };
}
test("a stalled read rejects and aborts instead of leaving Suspense pending", async () => {
  const stalled = query(new Promise(() => {}));
  await assert.rejects(readQuery(signal => stalled.abortSignal(signal), "Temporarily unavailable.", 15), /Temporarily unavailable/);
  assert.equal(stalled.signal.aborted, true);
});
test("a resolved Supabase error rejects immediately without leaking database details", async () => {
  const failed = query(Promise.resolve({ error: { message: "private database detail" } }));
  await assert.rejects(readQuery(signal => failed.abortSignal(signal), "Temporarily unavailable.", 1000), error => error.message === "Temporarily unavailable.");
});
test("a rejected network read is sanitized", async () => {
  await assert.rejects(readQuery(() => Promise.reject(Error("private connection detail")), "Temporarily unavailable."), error => error.message === "Temporarily unavailable.");
});
test("successful reads preserve data and clear their timeout", async () => {
  const result = { data: [], count: 0, error: null };
  const successful = query(Promise.resolve(result));
  assert.equal(await readQuery(signal => successful.abortSignal(signal), "Unavailable", 10), result);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(successful.signal.aborted, false);
});
function dashboard(responses, authorized = true) {
  let index = 0;
  let reads = 0;
  const { getDashboardCounts } = load("src/lib/journal/queries.ts", {
    react: { cache: fn => fn },
    "@/lib/supabase/server": { createClient: async () => ({ from: () => {
      reads++;
      const builder = query(responses[index++]);
      builder.select = () => builder; builder.eq = () => builder;
      return builder;
    } }) },
    "@/lib/supabase/admin": { requireAdmin: async () => { if (!authorized) throw Error("Not authorized"); } },
    "./types": {}, "./validation": {},
    "./read-query": { readQuery: (builder, message) => readQuery(builder, message, 25) },
  });
  return { getDashboardCounts, reads: () => reads };
}
test("dashboard fails promptly when one count errors and siblings never settle", async () => {
  const fixture = dashboard([Promise.resolve({ error: { message: "private details" } }), ...Array.from({ length: 5 }, () => new Promise(() => {}))]);
  await assert.rejects(fixture.getDashboardCounts(), /Dashboard counts are temporarily unavailable/);
});
test("dashboard times out when all count requests never settle", async () => {
  const fixture = dashboard(Array.from({ length: 6 }, () => new Promise(() => {})));
  await assert.rejects(fixture.getDashboardCounts(), /Dashboard counts are temporarily unavailable/);
});
test("dashboard returns counts in the existing order", async () => {
  const fixture = dashboard([9, 4, 3, 2, 6, 7].map(count => Promise.resolve({ count, error: null })));
  assert.deepEqual(Array.from(await fixture.getDashboardCounts()), [9, 4, 3, 2, 6, 7]);
});
test("dashboard still authorizes before starting database reads", async () => {
  const fixture = dashboard([], false);
  await assert.rejects(fixture.getDashboardCounts(), /Not authorized/);
  assert.equal(fixture.reads(), 0);
});
