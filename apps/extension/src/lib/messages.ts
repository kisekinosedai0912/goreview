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

export type BackendResponse =
	| { ok: true; data: unknown }
	| { ok: false; status: number; error: string };

export type ExtensionMessage = SnapshotRequest | FileRequest;
