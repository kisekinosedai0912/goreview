import { describe, expect, it } from "vitest";
import { withComputedDiffs } from "../diff/compute-diff";
import { samplePr } from "../fixtures/sample-pr";
import { buildAnnotations, buildReviewReport } from "./markdown";

const snapshot = withComputedDiffs(samplePr);

describe("buildReviewReport", () => {
	it("summarizes file count, churn, and categories in the title", () => {
		const report = buildReviewReport(snapshot);
		expect(report.title).toMatch(/^7 files · \+\d+ −\d+ · \d+ categories$/);
	});

	it("renders the directory tree with status markers and rollups", () => {
		const report = buildReviewReport(snapshot);
		expect(report.summary).toContain("### Tree comparison");
		expect(report.summary).toContain("src/");
		expect(report.summary).toContain("[M] UserCard.tsx");
		expect(report.summary).toContain("[D] legacy-auth.ts");
		expect(report.summary).toContain("[A] VerifiedBadge.tsx");
	});

	it("includes the category table", () => {
		const report = buildReviewReport(snapshot);
		expect(report.summary).toContain("| Category | Files |");
		expect(report.summary).toMatch(/\| package \| 1 \|/);
	});

	it("includes highlights from analyzer events", () => {
		const report = buildReviewReport(snapshot);
		expect(report.summary).toContain("### Highlights");
		expect(report.summary).toContain("Added package zod");
	});

	it("links to the hosted review when a url is provided", () => {
		const report = buildReviewReport(snapshot, {
			reviewUrl: "https://goreview.example/r/jasper/goreview/1",
		});
		expect(report.summary).toContain(
			"[Open the full interactive review →](https://goreview.example/r/jasper/goreview/1)",
		);
	});
});

describe("buildAnnotations", () => {
	it("anchors events to lines on the new side", () => {
		const annotations = buildAnnotations(snapshot);

		const zod = annotations.find((a) => a.title.includes("zod"));
		expect(zod).toBeDefined();
		expect(zod!.path).toBe("package.json");
		expect(zod!.start_line).toBeGreaterThan(0);

		const signature = annotations.find((a) =>
			a.title.startsWith("Signature changed"),
		);
		expect(signature).toBeDefined();
		expect(signature!.annotation_level).toBe("warning");
	});

	it("skips deleted files entirely", () => {
		const annotations = buildAnnotations(snapshot);
		expect(annotations.every((a) => a.path !== "src/lib/legacy-auth.ts")).toBe(
			true,
		);
	});
});
