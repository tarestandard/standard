import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHOPFRONT_DATE,
  SHOPFRONT_VERSION,
  SITE_ORIGIN,
  STANDARD_DATE,
  STANDARD_VERSION,
  STANDARDS,
} from "../scripts/standard-docs";
import {
  CRITICAL_FAIL_CAP,
  CRITICAL_PENDING_CAP,
  PASS_D,
  PASS_E,
  PENALTIES,
  SEVERITY_WEIGHT,
  YES,
} from "../scripts/standard-instrument";
import { CHECKS, STEPS } from "../scripts/standard-numbers";

type StandardRecord = {
  key: string;
  name: string;
  version: string;
  published: string;
  url: string;
  jobs?: number;
  checks?: { settled: number; total: number };
  steps?: { settled: number; total: number };
  grades?: string[];
  levels?: Array<{ level: number; name: string; headline: string }>;
  ungraded?: string;
};

const pin = JSON.parse(readFileSync(join(process.cwd(), "standard.json"), "utf8")) as {
  name: string;
  version: string;
  published: string;
  site: string;
  repository: string;
  license: string;
  standards: StandardRecord[];
  thresholds: {
    pass: { E: number; D: number };
    caps: { criticalFail: number; criticalPending: number };
    violationProbability: number;
    severityWeights: { C: number; H: number; M: number };
    penalties: Record<string, number>;
  };
};

const byKey = new Map(pin.standards.map((standard) => [standard.key, standard]));

describe("the machine-readable pin", () => {
  it("names the release, the site and both published standards", () => {
    expect(pin.name).toBe("Tare Standard");
    expect(pin.version).toBe(STANDARD_VERSION);
    expect(pin.published).toBe(STANDARD_DATE);
    expect(pin.site).toBe(SITE_ORIGIN);
    expect(pin.standards.map((standard) => standard.key).sort()).toEqual(
      STANDARDS.map((standard) => standard.key).sort(),
    );
  });

  it("prints each standard's own name, version, date and URL", () => {
    for (const standard of STANDARDS) {
      const record = byKey.get(standard.key);
      expect(record, standard.key).toBeDefined();
      expect(record?.name).toBe(standard.name);
      expect(record?.url).toBe(`${SITE_ORIGIN}${standard.base}`);
      expect(record?.version).toBe(standard.version);
      expect(record?.published).toBe(standard.date);
    }
    expect(byKey.get("agent")?.version).toBe(STANDARD_VERSION);
    expect(byKey.get("agent")?.published).toBe(STANDARD_DATE);
    expect(byKey.get("shopfront")?.version).toBe(SHOPFRONT_VERSION);
    expect(byKey.get("shopfront")?.published).toBe(SHOPFRONT_DATE);
  });

  it("prints the settled counts the standard prints about itself", () => {
    const agent = byKey.get("agent");
    expect(agent?.checks).toEqual(CHECKS);
    expect(agent?.steps).toEqual(STEPS);
  });

  it("prints the thresholds the published instrument applies", () => {
    expect(pin.thresholds.pass).toEqual({ E: PASS_E, D: PASS_D });
    expect(pin.thresholds.caps).toEqual({
      criticalFail: CRITICAL_FAIL_CAP,
      criticalPending: CRITICAL_PENDING_CAP,
    });
    expect(pin.thresholds.violationProbability).toBe(YES);
    expect(pin.thresholds.severityWeights).toEqual(SEVERITY_WEIGHT);
    expect(pin.thresholds.penalties).toEqual(PENALTIES);
  });

  it("prints the shopfront ladder and the grades each standard uses", () => {
    const shopfront = byKey.get("shopfront");
    expect(shopfront?.levels?.map((level) => level.level)).toEqual([1, 2, 3, 4, 5]);
    expect(shopfront?.levels?.map((level) => level.name)).toEqual([
      "Findable",
      "Actable",
      "Confirmable",
      "Recoverable",
      "Delegable",
    ]);
    expect(shopfront?.grades).toEqual(["A", "B", "C", "D", "F"]);
    expect(shopfront?.ungraded).toBe("Level 1");
    expect(byKey.get("agent")?.grades).toEqual(["critical", "major", "minor"]);
  });
});
