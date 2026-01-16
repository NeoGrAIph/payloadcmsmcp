import assert from "node:assert/strict";
import { resolveDraft, hasDraftStatusFilter } from "../lib/payload/draft-utils.mjs";

const cases = [
  {
    name: "status draft overrides draft=false",
    input: { status: "draft", draft: false },
    expected: true,
  },
  {
    name: "status draft overrides undefined draft",
    input: { status: "draft" },
    expected: true,
  },
  {
    name: "where _status equals draft",
    input: { where: { _status: { equals: "draft" } } },
    expected: true,
  },
  {
    name: "where _status in list",
    input: { where: { _status: { in: ["draft", "published"] } } },
    expected: true,
  },
  {
    name: "nested and/or _status equals draft",
    input: { where: { and: [{ slug: { equals: "syrm" } }, { _status: { equals: "draft" } }] } },
    expected: true,
  },
  {
    name: "status published keeps draft undefined",
    input: { status: "published" },
    expected: undefined,
  },
  {
    name: "no status/where returns draft value",
    input: { draft: false },
    expected: false,
  },
];

for (const test of cases) {
  assert.equal(resolveDraft(test.input), test.expected, test.name);
}

assert.equal(hasDraftStatusFilter({ _status: { equals: "draft" } }), true, "hasDraftStatusFilter equals");
assert.equal(hasDraftStatusFilter({ _status: { in: ["draft"] } }), true, "hasDraftStatusFilter in");
assert.equal(hasDraftStatusFilter({ _status: { equals: "published" } }), false, "hasDraftStatusFilter published");
assert.equal(hasDraftStatusFilter({ and: [{ _status: { equals: "draft" } }] }), true, "hasDraftStatusFilter nested");

console.log("draft/status tests: ok");
