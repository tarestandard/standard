/**
 * The published scope counts, parsed once from the Family table the /scope page
 * renders.
 *
 * The front page used to type the split ("three in Safety and three in
 * Reliability") beside the same table it contradicted. This module is the one
 * parse behind the sentence, the page's heading and the metadata, and
 * `assertScopeSplit` fails the build when the rendered table and the sentence
 * disagree (critique 2026-11-13, priority issue 1).
 *
 * The denominator is AIUC-1's own count — 50 live requirements in six families
 * — as `docs/standard/mappings.md` states. The table supplies what that count
 * cannot: which requirements have a row, in which family.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const AIUC1_LIVE_REQUIREMENTS = 50;
export const AIUC1_FAMILY_COUNT = 6;

export type ScopeFamilyCount = {
  letter: string;
  name: string;
  count: number;
};

export type ScopeCounts = {
  total: number;
  covered: number;
  noRow: number;
  zeroFamilies: number;
  families: ScopeFamilyCount[];
};

const SCOPE_SECTION = /^##\s+Scope\b/;
const FAMILY_HEADER = /^\|\s*Family\s*\|\s*AIUC-1 requirement\s*\|/;

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

/** Spell a count the way the front-page sentence speaks it. */
export function spellCount(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new Error(`No published spelling for the scope count ${value}`);
  }
  if (value < 20) return ONES[value] ?? String(value);
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  if (ones === 0) return TENS[tens] ?? String(value);
  return `${TENS[tens]}-${ONES[ones]}`;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Read the Scope Family table out of the mappings Markdown. Throws when the
 * section, the table or a row's family is not readable, so a restructured
 * document fails the build instead of silently changing the denominator.
 */
export function parseScopeCounts(markdown: string): ScopeCounts {
  const lines = markdown.split(/\r?\n/);
  const scopeStart = lines.findIndex((line) => SCOPE_SECTION.test(line));
  if (scopeStart === -1) {
    throw new Error(
      "docs/standard/mappings.md has no Scope section, so the published split cannot be derived",
    );
  }

  let header = -1;
  for (let index = scopeStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^##\s/.test(line)) break;
    if (FAMILY_HEADER.test(line)) {
      header = index;
      break;
    }
  }
  if (header === -1) {
    throw new Error(
      "docs/standard/mappings.md has no Family | AIUC-1 requirement table in its Scope section",
    );
  }

  const families = new Map<string, ScopeFamilyCount>();
  // The denominator counts distinct requirements, not rows: a requirement
  // printed twice would otherwise publish "7 of 50" consistently and pass.
  const requirements = new Set<string>();
  for (let index = header + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim().startsWith("|")) break;
    const cells = splitRow(line);
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;

    const family = cells[0] ?? "";
    const match = /^([A-Z])\s+(.+)$/.exec(family);
    const letter = match?.[1];
    const name = match?.[2]?.trim();
    if (!letter || !name) {
      throw new Error(`The scope Family table has a row without a family: ${line}`);
    }

    const requirement = cells[1] ?? "";
    const requirementId = /\b([A-F]\d{3})\b/.exec(requirement)?.[1];
    if (!requirementId) {
      throw new Error(`The scope Family table has a row without an AIUC-1 requirement id: ${line}`);
    }
    if (requirements.has(requirementId)) {
      throw new Error(
        `The AIUC-1 requirement ${requirementId} appears twice in the scope Family table; ` +
          "each requirement is covered once.",
      );
    }
    requirements.add(requirementId);

    const current = families.get(letter);
    families.set(letter, {
      letter,
      name: current?.name ?? name,
      count: (current?.count ?? 0) + 1,
    });
  }
  const covered = requirements.size;

  if (covered === 0) {
    throw new Error("The scope Family table in docs/standard/mappings.md has no rows");
  }
  if (covered > AIUC1_LIVE_REQUIREMENTS) {
    throw new Error(
      `The scope Family table has ${covered} rows for ${AIUC1_LIVE_REQUIREMENTS} live AIUC-1 requirements`,
    );
  }
  if (families.size > AIUC1_FAMILY_COUNT) {
    throw new Error(
      `The scope Family table names ${families.size} families; AIUC-1 publishes ${AIUC1_FAMILY_COUNT}`,
    );
  }

  return {
    total: AIUC1_LIVE_REQUIREMENTS,
    covered,
    noRow: AIUC1_LIVE_REQUIREMENTS - covered,
    zeroFamilies: AIUC1_FAMILY_COUNT - families.size,
    families: [...families.values()].sort((a, b) => a.letter.localeCompare(b.letter)),
  };
}

/** Load the counts from the document the /scope page renders. */
export function loadScopeCounts(): ScopeCounts {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return parseScopeCounts(readFileSync(resolve(repoRoot, "docs/standard/mappings.md"), "utf8"));
}

function familyPhrase(families: readonly ScopeFamilyCount[]): string {
  const parts = families.map((family) => `${spellCount(family.count)} in ${family.name}`);
  if (parts.length === 0) return "none";
  if (parts.length === 1) return parts[0] ?? "none";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * The front page's scope sentence, in the voice it already had. Every numeral
 * in it comes from the Family table: the covered count, the per-family split,
 * the requirements with no row, and the families left at zero.
 */
export function scopeSentence(counts: ScopeCounts): string {
  const covered = capitalise(spellCount(counts.covered));
  const requirements = counts.covered === 1 ? "requirement has" : "requirements have";
  const noRow = capitalise(spellCount(counts.noRow));
  const noRowVerb = counts.noRow === 1 ? "has" : "have";
  const zeroClause =
    counts.zeroFamilies === 0
      ? "No family is at zero."
      : counts.zeroFamilies === 1
        ? "One family is at zero."
        : `${capitalise(spellCount(counts.zeroFamilies))} families are at zero.`;
  return (
    `${covered} AIUC-1 ${requirements} a published job that can genuinely speak to them: ` +
    `${familyPhrase(counts.families)}. ${noRow} ${noRowVerb} no row. ${zeroClause}`
  );
}

/** The section heading, derived from the same counts. */
export function scopeHeading(counts: ScopeCounts): string {
  return `The scope: ${counts.covered} of ${counts.total}`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** The Family table as the rendered /scope page prints it, family → row count. */
export function renderedFamilyCounts(scopeHtml: string): Map<string, number> {
  const tables = [...scopeHtml.matchAll(/<table\b[\s\S]*?<\/table>/g)].map((match) => match[0]);
  const table = tables.find((candidate) => {
    const head = candidate.slice(
      candidate.indexOf("<thead>"),
      candidate.indexOf("</thead>") + "</thead>".length,
    );
    return plainText(head).includes("AIUC-1 requirement");
  });
  if (!table) {
    throw new Error("The /scope page has no Family | AIUC-1 requirement table to check");
  }

  const bodyStart = table.indexOf("<tbody>");
  const bodyEnd = table.indexOf("</tbody>");
  if (bodyStart === -1 || bodyEnd === -1) {
    throw new Error("The /scope Family table has no <tbody> to read rows from");
  }
  const body = table.slice(bodyStart, bodyEnd);
  const counts = new Map<string, number>();
  for (const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cell = /<td\b[^>]*>([\s\S]*?)<\/td>/.exec(row[1] ?? "");
    const family = plainText(cell?.[1] ?? "");
    if (!family) {
      throw new Error("The /scope Family table has a row without a readable family");
    }
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return counts;
}

function describeFamilies(counts: ReadonlyMap<string, number>): string {
  return (
    [...counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([family, count]) => `${family}: ${count}`)
      .join(", ") || "no rows"
  );
}

/**
 * The build gate: the rendered /scope Family table must be the table the front
 * page's sentence and heading were derived from. A typed split fails here with
 * both counts named.
 */
export function assertScopeSplit(input: {
  indexHtml: string;
  scopeHtml: string;
  counts: ScopeCounts;
}): void {
  const rendered = renderedFamilyCounts(input.scopeHtml);
  const expected = new Map(
    input.counts.families.map((family) => [`${family.letter} ${family.name}`, family.count]),
  );
  const agrees =
    rendered.size === expected.size &&
    [...expected].every(([family, count]) => rendered.get(family) === count);
  if (!agrees) {
    throw new Error(
      "The /scope Family table does not match the mappings parse: the page prints " +
        `${describeFamilies(rendered)}; docs/standard/mappings.md derives ${describeFamilies(expected)}. ` +
        "The build refuses to publish two counts for one scope.",
    );
  }

  const heading = scopeHeading(input.counts);
  const sentence = scopeSentence(input.counts);
  const text = plainText(input.indexHtml);
  if (!text.includes(heading) || !text.includes(sentence)) {
    throw new Error(
      `The front page does not print the scope derived from its /scope Family table (${describeFamilies(expected)}). ` +
        `Expected "${heading}" and "${sentence}". ` +
        "Derive the numerals from docs/standard/mappings.md; do not type the split.",
    );
  }
}
