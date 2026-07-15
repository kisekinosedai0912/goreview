import { browser, defineBackground } from "#imports";
import type { BackendResponse, ExtensionMessage } from "../lib/messages";
import { getBackendUrl } from "../lib/settings";

/**
 * All backend calls happen here: the background context has host
 * permissions, so cookies for the goreview deployment are sent even
 * though the request originates from a github.com page.
 */
async function callBackend(path: string): Promise<BackendResponse> {
	const base = await getBackendUrl();
	try {
		const response = await fetch(`${base}${path}`, {
			credentials: "include",
			headers: { Accept: "application/json" },
		});
		const data: unknown = await response.json().catch(() => null);

		if (!response.ok) {
			const error =
				typeof data === "object" && data !== null && "error" in data
					? String((data as { error: unknown }).error)
					: `Backend responded with ${response.status}`;
			return { ok: false, status: response.status, error };
		}

		return { ok: true, data };
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error:
				error instanceof Error
					? `Could not reach ${base}: ${error.message}`
					: `Could not reach ${base}`,
		};
	}
}

export default defineBackground(() => {
	browser.runtime.onMessage.addListener(
		(message: ExtensionMessage, _sender, sendResponse) => {
			const handle = async (): Promise<BackendResponse> => {
				switch (message.type) {
					case "goreview:snapshot":
						return callBackend(
							`/api/snapshot/${message.owner}/${message.repo}/${message.number}`,
						);
					case "goreview:file":
						return callBackend(
							`/api/snapshot/${message.owner}/${message.repo}/${message.number}/file?path=${encodeURIComponent(message.path)}`,
						);
				}
			};

			handle().then(sendResponse);
			return true; // async response
		},
	);
});
