import { storage } from "#imports";

export const DEFAULT_BACKEND = "http://localhost:3000";

export const backendUrl = storage.defineItem<string>("sync:backendUrl", {
	fallback: DEFAULT_BACKEND,
});

export async function getBackendUrl(): Promise<string> {
	const value = await backendUrl.getValue();
	return value.replace(/\/$/, "");
}
