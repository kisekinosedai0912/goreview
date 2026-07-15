import type { CommentAnchor } from "@goreview/core";

export type SnapshotRequest = {
	type: "goreview:snapshot";
	owner: string;
	repo: string;
	number: number;
};

export type FileRequest = {
	type: "goreview:file";
	owner: string;
	repo: string;
	number: number;
	path: string;
};

export type CommentListRequest = {
	type: "goreview:comments:list";
	owner: string;
	repo: string;
	number: number;
};

export type CommentCreateRequest = {
	type: "goreview:comments:create";
	owner: string;
	repo: string;
	number: number;
	anchor: CommentAnchor;
	body: string;
	expectedHeadSha: string;
};

export type CommentReplyRequest = {
	type: "goreview:comments:reply";
	owner: string;
	repo: string;
	number: number;
	rootId: number;
	body: string;
};

export type BackendResponse =
	| { ok: true; data: unknown }
	| { ok: false; status: number; error: string };

export type ExtensionMessage =
	| SnapshotRequest
	| FileRequest
	| CommentListRequest
	| CommentCreateRequest
	| CommentReplyRequest;
