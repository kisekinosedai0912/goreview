import {
	buildDeterministicIntelligence,
	buildReviewFacts,
	buildReviewPromptChunks,
	codeExplanationSchema,
	isCommentableAnchor,
	reviewIntelligenceSchema,
	scoreFileRisk,
	type CodeExplanation,
	type CommentAnchor,
	type ReviewIntelligence,
	type ReviewSnapshot,
} from "@goreview/core";
import { generateText, Output } from "ai";
import {
	cacheGet,
	cacheSet,
	fileSummaryCacheKey,
	intelligenceCacheKey,
} from "../cache";
import { optionalEnv } from "../env";

const DEFAULT_MODEL = "openai/gpt-5.6-sol";
const REVIEW_SCHEMA_VERSION = 1;
const DIRECT_PROMPT_LIMIT = 70_000;

const aiIntelligenceSchema = reviewIntelligenceSchema.omit({
	version: true,
	source: true,
	generatedAt: true,
});
const aiExplanationSchema = codeExplanationSchema.omit({ source: true });

export function reviewModel(): string {
	return optionalEnv("AI_REVIEW_MODEL") ?? DEFAULT_MODEL;
}

export function isReviewAiAvailable(): boolean {
	return Boolean(
		optionalEnv("VERCEL_OIDC_TOKEN") ||
			optionalEnv("AI_GATEWAY_API_KEY") ||
			optionalEnv("VERCEL"),
	);
}

function gatewayOptions(userId: string, feature: string) {
	return {
		gateway: {
			user: userId,
			tags: [`feature:${feature}`, "product:goreview"],
		},
	};
}

function sanitizeIntelligence(
	snapshot: ReviewSnapshot,
	value: ReviewIntelligence,
): ReviewIntelligence {
	const files = new Map(snapshot.files.map((file) => [file.path, file]));
	const validEvidence = <T extends { anchor: CommentAnchor }>(evidence: T[]) =>
		evidence.filter((item) => {
			const file = files.get(item.anchor.path);
			return file ? isCommentableAnchor(file, item.anchor) : false;
		});

	return reviewIntelligenceSchema.parse({
		...value,
		changeStory: value.changeStory
			.map((step) => ({
				...step,
				paths: step.paths.filter((path) => files.has(path)),
				evidence: validEvidence(step.evidence),
			}))
			.filter((step) => step.paths.length > 0),
		relationships: value.relationships.filter(
			(relationship) =>
				files.has(relationship.from) && files.has(relationship.to),
		),
		risks: value.risks.map((risk) => ({
			...risk,
			evidence: validEvidence(risk.evidence),
		})),
		testGaps: value.testGaps
			.map((gap) => ({
				...gap,
				relatedPaths: gap.relatedPaths.filter((path) => files.has(path)),
			}))
			.filter((gap) => gap.relatedPaths.length > 0),
		reviewOrder: value.reviewOrder.filter((item) => files.has(item.path)),
	});
}

async function summarizeFile(
	owner: string,
	repo: string,
	snapshot: ReviewSnapshot,
	path: string,
	parts: string[],
	model: string,
	userId: string,
): Promise<string> {
	const key = fileSummaryCacheKey(owner, repo, snapshot.headSha, model, path);
	const cached = await cacheGet(key);
	if (cached) return cached;

	const partials: string[] = [];
	for (let index = 0; index < parts.length; index += 1) {
		const result = await generateText({
			model,
			system:
				"You summarize pull-request code changes. State behavior, intent, coupling, risks, and verification needs. Do not invent facts beyond the supplied diff.",
			prompt: `Summarize part ${index + 1}/${parts.length} of ${path} in at most 180 words.\n\n${parts[index]}`,
			maxOutputTokens: 350,
			providerOptions: gatewayOptions(userId, "review-file-summary"),
		});
		partials.push(result.text);
	}

	let summary = partials.join("\n");
	if (partials.length > 1) {
		const result = await generateText({
			model,
			system:
				"Consolidate partial code-review summaries without adding unsupported claims.",
			prompt: `Create one evidence-conscious summary for ${path} in at most 240 words:\n\n${summary}`,
			maxOutputTokens: 500,
			providerOptions: gatewayOptions(userId, "review-file-summary"),
		});
		summary = result.text;
	}
	await cacheSet(key, summary);
	return summary;
}

async function boundedChangeContext(
	owner: string,
	repo: string,
	snapshot: ReviewSnapshot,
	model: string,
	userId: string,
): Promise<string> {
	const chunks = buildReviewPromptChunks(snapshot);
	const direct = chunks.map((chunk) => chunk.text).join("\n\n");
	if (direct.length <= DIRECT_PROMPT_LIMIT) return direct;

	const byPath = new Map<string, string[]>();
	for (const chunk of chunks) {
		const parts = byPath.get(chunk.path) ?? [];
		parts.push(chunk.text);
		byPath.set(chunk.path, parts);
	}
	const summaries: string[] = [];
	for (const [path, parts] of byPath) {
		const summary = await summarizeFile(
			owner,
			repo,
			snapshot,
			path,
			parts,
			model,
			userId,
		);
		summaries.push(`FILE ${path}\n${summary}`);
	}
	return summaries.join("\n\n");
}

export async function generateReviewIntelligence(input: {
	owner: string;
	repo: string;
	snapshot: ReviewSnapshot;
	userId: string;
}): Promise<ReviewIntelligence> {
	const model = reviewModel();
	const key = intelligenceCacheKey(
		input.owner,
		input.repo,
		input.snapshot.headSha,
		model,
		REVIEW_SCHEMA_VERSION,
	);
	const cached = await cacheGet(key);
	if (cached) {
		try {
			const parsed = reviewIntelligenceSchema.safeParse(JSON.parse(cached));
			if (parsed.success) return parsed.data;
		} catch {
			// Ignore stale or malformed cache entries.
		}
	}

	const facts = buildReviewFacts(input.snapshot);
	const boundedFacts = {
		...facts,
		files: [...facts.files]
			.sort((a, b) => b.riskScore - a.riskScore)
			.slice(0, 200),
	};
	const changeContext = await boundedChangeContext(
		input.owner,
		input.repo,
		input.snapshot,
		model,
		input.userId,
	);
	const { output } = await generateText({
		model,
		output: Output.object({ schema: aiIntelligenceSchema }),
		system: `You are an evidence-bound pull-request reviewer.
Return a concise change story, cross-file relationships, ranked risks, test gaps, review order, and open questions.
Every path must be one supplied changed path. Evidence anchors must use only the supplied L<number>/R<number> coordinates: LEFT for L, RIGHT for R. Never invent files or lines.
Use deterministic facts as constraints, not suggestions. Avoid generic advice.`,
		prompt: `PR: ${input.snapshot.title}
Repository: ${input.snapshot.repo}
Head: ${input.snapshot.headSha}

DETERMINISTIC FACTS
${JSON.stringify(boundedFacts)}

BOUNDED DIFFS OR CACHED FILE SUMMARIES
${changeContext}`,
		maxOutputTokens: 4_000,
		providerOptions: gatewayOptions(input.userId, "review-intelligence"),
	});
	const intelligence = sanitizeIntelligence(input.snapshot, {
		...output,
		version: 1,
		source: "ai",
		generatedAt: new Date().toISOString(),
	});
	await cacheSet(key, JSON.stringify(intelligence));
	return intelligence;
}

export function deterministicExplanation(
	snapshot: ReviewSnapshot,
	path: string,
): CodeExplanation {
	const file = snapshot.files.find((candidate) => candidate.path === path);
	if (!file) throw new Error("Changed file not found.");
	const risk = scoreFileRisk(file);
	const churn =
		(file.additions ?? file.diff?.additions ?? 0) +
		(file.deletions ?? file.diff?.deletions ?? 0);
	return {
		source: "deterministic",
		what: `${file.status} ${file.path} with ${churn} changed lines.`,
		why:
			file.events[0]
				? `Static analysis detected ${file.events[0].kind.replaceAll(".", " ")}.`
				: `This file participates in the pull request's ${file.categories.join(", ")} changes.`,
		impact:
			risk.reasons.length > 0
				? risk.reasons.join("; ")
				: "No elevated deterministic impact signal was found.",
		verify: file.categories.includes("test")
			? ["Confirm the changed assertions cover the intended behavior."]
			: ["Run the closest automated tests and exercise the changed path."],
	};
}

export async function generateCodeExplanation(input: {
	snapshot: ReviewSnapshot;
	path: string;
	anchor?: CommentAnchor;
	userId: string;
}): Promise<CodeExplanation> {
	const file = input.snapshot.files.find(
		(candidate) => candidate.path === input.path,
	);
	if (!file) throw new Error("Changed file not found.");
	const facts = buildReviewFacts(input.snapshot);
	const relatedPaths = new Set(
		facts.relationships
			.filter(
				(relationship) =>
					relationship.from === input.path || relationship.to === input.path,
			)
			.flatMap((relationship) => [relationship.from, relationship.to]),
	);
	relatedPaths.add(input.path);
	const relatedFiles = input.snapshot.files
		.filter((candidate) => relatedPaths.has(candidate.path))
		.slice(0, 6);
	const chunks = buildReviewPromptChunks({
		...input.snapshot,
		files: relatedFiles,
	});
	const context = chunks.map((chunk) => chunk.text).join("\n\n");
	const { output } = await generateText({
		model: reviewModel(),
		output: Output.object({ schema: aiExplanationSchema }),
		system:
			"Explain code changes concisely for a reviewer. Stay grounded in the supplied diff. Separate what changed, why it likely changed, impact, and concrete verification.",
		prompt: `Explain ${input.anchor ? `${input.anchor.side} line ${input.anchor.line} in` : "the changed file"} ${input.path}.

RELATED FILE FACTS
${JSON.stringify(facts.relationships.filter((relationship) => relatedPaths.has(relationship.from) && relatedPaths.has(relationship.to)))}

${context}`,
		maxOutputTokens: 900,
		providerOptions: gatewayOptions(input.userId, "review-explanation"),
	});
	return codeExplanationSchema.parse({ ...output, source: "ai" });
}

export function deterministicReviewIntelligence(
	snapshot: ReviewSnapshot,
): ReviewIntelligence {
	return buildDeterministicIntelligence(snapshot);
}
