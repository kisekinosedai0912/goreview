import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildDeterministicIntelligence } from "@goreview/core";
import { samplePr } from "@goreview/core/fixtures";

const mocks = vi.hoisted(() => ({
	resolveWrite: vi.fn(),
	resolveRead: vi.fn(),
	getSnapshot: vi.fn(),
	hydrateSnapshot: vi.fn(),
	available: vi.fn(),
	generate: vi.fn(),
	deterministic: vi.fn(),
	model: vi.fn(),
}));

vi.mock("@/lib/review-auth", () => ({
	resolveReviewWriteAuth: mocks.resolveWrite,
}));
vi.mock("@/lib/snapshot", () => ({
	resolveAuth: mocks.resolveRead,
	getSnapshot: mocks.getSnapshot,
}));
vi.mock("@/lib/hydrate-review-file", () => ({
	hydrateSnapshotForReview: mocks.hydrateSnapshot,
}));
vi.mock("@/lib/ai/review-intelligence", () => ({
	isReviewAiAvailable: mocks.available,
	generateReviewIntelligence: mocks.generate,
	deterministicReviewIntelligence: mocks.deterministic,
	reviewModel: mocks.model,
}));

import {
	GET,
	POST,
} from "../../app/api/reviews/[owner]/[repo]/[number]/intelligence/route";

const params = Promise.resolve({ owner: "acme", repo: "app", number: "7" });
const intelligence = buildDeterministicIntelligence(samplePr);
const snapshot = { ...samplePr, headSha: "head" };

function request(expectedHeadSha = "head"): NextRequest {
	return new NextRequest("http://localhost/api/intelligence", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-goreview-action": "intelligence",
		},
		body: JSON.stringify({ expectedHeadSha }),
	});
}

describe("review intelligence API", () => {
	const octokit = {};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resolveRead.mockResolvedValue({ kind: "installation", octokit });
		mocks.resolveWrite.mockResolvedValue({
			kind: "user",
			octokit,
			login: "reviewer",
		});
		mocks.getSnapshot.mockResolvedValue(snapshot);
		mocks.hydrateSnapshot.mockResolvedValue(snapshot);
		mocks.deterministic.mockReturnValue(intelligence);
		mocks.model.mockReturnValue("openai/gpt-5.6-sol");
		mocks.available.mockReturnValue(true);
		mocks.generate.mockResolvedValue({ ...intelligence, source: "ai" });
	});

	it("serves deterministic facts without invoking AI", async () => {
		const response = await GET(
			new NextRequest("http://localhost/api/intelligence"),
			{ params },
		);
		expect(response.status).toBe(200);
		expect((await response.json()).intelligence.source).toBe("deterministic");
		expect(mocks.generate).not.toHaveBeenCalled();
	});

	it("requires attributable user authentication for paid AI work", async () => {
		mocks.resolveWrite.mockResolvedValue(null);
		const response = await POST(request(), { params });
		expect(response.status).toBe(401);
		expect(mocks.generate).not.toHaveBeenCalled();
	});

	it("rejects generation against a stale review", async () => {
		const response = await POST(request("old-head"), { params });
		expect(response.status).toBe(409);
		expect(mocks.hydrateSnapshot).not.toHaveBeenCalled();
	});

	it("returns the deterministic fallback when Gateway is unavailable", async () => {
		mocks.available.mockReturnValue(false);
		const response = await POST(request(), { params });
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.fallback).toBe(true);
		expect(body.intelligence.source).toBe("deterministic");
		expect(mocks.generate).not.toHaveBeenCalled();
	});

	it("hydrates bounded review input and tags generation to the user", async () => {
		const ai = { ...intelligence, source: "ai" as const };
		mocks.generate.mockResolvedValue(ai);
		const response = await POST(request(), { params });
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			intelligence: ai,
			fallback: false,
		});
		expect(mocks.hydrateSnapshot).toHaveBeenCalledWith(
			octokit,
			"acme",
			"app",
			snapshot,
		);
		expect(mocks.generate).toHaveBeenCalledWith({
			owner: "acme",
			repo: "app",
			snapshot,
			userId: "reviewer",
		});
	});
});
