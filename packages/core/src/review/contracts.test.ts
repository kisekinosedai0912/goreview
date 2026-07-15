import { describe, expect, it } from "vitest";
import { withComputedDiffs } from "../diff/compute-diff";
import { samplePr } from "../fixtures/sample-pr";
import { getCommentableAnchors, isCommentableAnchor } from "./anchors";
import {
	buildDeterministicIntelligence,
	scoreFileRisk,
	validateIntelligenceEvidence,
} from "./intelligence";
import { getOrderedFiles } from "./order";

const snapshot = withComputedDiffs(samplePr);

describe("canonical review order", () => {
	it("uses directory-tree depth-first order", () => {
		const paths = getOrderedFiles(snapshot.files).map((file) => file.path);
		expect(paths).toEqual([
			"prisma/schema.prisma",
			"src/api/users.ts",
			"src/components/UserCard.tsx",
			"src/components/VerifiedBadge.tsx",
			"src/lib/legacy-auth.ts",
			"package.json",
			"README.md",
		]);
	});

	it("applies status and category filters without changing relative order", () => {
		const statuses = new Set(["added"] as const);
		const paths = getOrderedFiles(snapshot.files, { statuses }).map(
			(file) => file.path,
		);
		expect(paths).toEqual(["src/components/VerifiedBadge.tsx"]);
	});
});

describe("comment anchors", () => {
	it("maps added lines to RIGHT and removed lines to LEFT", () => {
		const file = snapshot.files.find(
			(candidate) => candidate.path === "src/components/UserCard.tsx",
		)!;
		const anchors = getCommentableAnchors(file);
		expect(anchors.some((anchor) => anchor.side === "RIGHT")).toBe(true);
		expect(anchors.some((anchor) => anchor.side === "LEFT")).toBe(true);
	});

	it("rejects lines outside the diff", () => {
		const file = snapshot.files[0]!;
		expect(
			isCommentableAnchor(file, {
				path: file.path,
				side: "RIGHT",
				line: 999_999,
			}),
		).toBe(false);
	});
});

describe("deterministic review intelligence", () => {
	it("scores database and dependency changes above trivial files", () => {
		const database = snapshot.files.find((file) =>
			file.categories.includes("database"),
		)!;
		const docsLike = {
			...snapshot.files[0]!,
			path: "README.md",
			categories: ["docs" as const],
			events: [],
			additions: 1,
			deletions: 0,
		};
		expect(scoreFileRisk(database).score).toBeGreaterThan(
			scoreFileRisk(docsLike).score,
		);
	});

	it("only emits evidence anchored to the real diff", () => {
		const intelligence = buildDeterministicIntelligence(snapshot);
		expect(validateIntelligenceEvidence(snapshot, intelligence)).toEqual({
			valid: true,
			invalid: [],
		});
	});

	it("detects invalid AI evidence", () => {
		const intelligence = buildDeterministicIntelligence(snapshot);
		intelligence.risks[0]!.evidence = [
			{
				label: "hallucinated",
				anchor: { path: "missing.ts", side: "RIGHT", line: 1 },
			},
		];
		const result = validateIntelligenceEvidence(snapshot, intelligence);
		expect(result.valid).toBe(false);
		expect(result.invalid).toHaveLength(1);
	});
});
