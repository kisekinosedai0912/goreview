import { z } from "zod";
import { commentAnchorSchema } from "./comment";

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const intelligenceEvidenceSchema = z.object({
	anchor: commentAnchorSchema,
	label: z.string().min(1),
});

export const riskHotspotSchema = z.object({
	id: z.string(),
	title: z.string(),
	level: riskLevelSchema,
	score: z.number().min(0).max(100),
	reason: z.string(),
	evidence: z.array(intelligenceEvidenceSchema),
});

export const changeStoryStepSchema = z.object({
	id: z.string(),
	title: z.string(),
	summary: z.string(),
	paths: z.array(z.string()).min(1),
	evidence: z.array(intelligenceEvidenceSchema),
});

export const testGapSchema = z.object({
	id: z.string(),
	title: z.string(),
	reason: z.string(),
	relatedPaths: z.array(z.string()).min(1),
	severity: z.enum(["notice", "warning"]),
});

export const reviewOrderItemSchema = z.object({
	path: z.string(),
	reason: z.string(),
	riskScore: z.number().min(0).max(100),
	dependsOn: z.array(z.string()),
});

export const fileRelationshipSchema = z.object({
	from: z.string(),
	to: z.string(),
	kind: z.enum(["test", "dependency", "feature", "directory"]),
	reason: z.string(),
});

export const reviewIntelligenceSchema = z.object({
	version: z.literal(1),
	source: z.enum(["deterministic", "ai"]),
	summary: z.string(),
	changeStory: z.array(changeStoryStepSchema),
	relationships: z.array(fileRelationshipSchema),
	risks: z.array(riskHotspotSchema),
	testGaps: z.array(testGapSchema),
	reviewOrder: z.array(reviewOrderItemSchema),
	questions: z.array(z.string()),
	generatedAt: z.string(),
});

export const codeExplanationSchema = z.object({
	what: z.string(),
	why: z.string(),
	impact: z.string(),
	verify: z.array(z.string()),
	source: z.enum(["deterministic", "ai"]),
});

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type IntelligenceEvidence = z.infer<typeof intelligenceEvidenceSchema>;
export type RiskHotspot = z.infer<typeof riskHotspotSchema>;
export type ChangeStoryStep = z.infer<typeof changeStoryStepSchema>;
export type TestGap = z.infer<typeof testGapSchema>;
export type ReviewOrderItem = z.infer<typeof reviewOrderItemSchema>;
export type FileRelationship = z.infer<typeof fileRelationshipSchema>;
export type ReviewIntelligence = z.infer<typeof reviewIntelligenceSchema>;
export type CodeExplanation = z.infer<typeof codeExplanationSchema>;
