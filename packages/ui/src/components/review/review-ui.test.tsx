import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	buildDeterministicIntelligence,
	withComputedDiffs,
	type CommentAnchor,
} from "@goreview/core";
import { samplePr } from "@goreview/core/fixtures";
import DiffViewer from "../DiffViewer";
import FileTreeCompare from "../FileTreeCompare";
import InlineComments from "./InlineComments";
import IntelligencePanel from "./IntelligencePanel";

const snapshot = withComputedDiffs(samplePr);
const changedFile = snapshot.files.find(
	(file) => file.path === "src/components/UserCard.tsx",
)!;

describe("continuous review UI", () => {
	it("defaults each diff to split mode", () => {
		render(<DiffViewer file={changedFile} continuous />);
		expect(
			screen.getByRole("tab", { name: "Split" }).getAttribute("aria-selected"),
		).toBe("true");
		expect(document.querySelector(".diff-viewer__scroll")).toBeNull();
		expect(document.querySelector(".diff-viewer__body--continuous")).not.toBeNull();
	});

	it("exposes comment controls only for real hunk anchors", () => {
		render(
			<DiffViewer
				file={changedFile}
				continuous
				onCreateComment={vi.fn()}
			/>,
		);
		const controls = screen.getAllByRole("button", { name: /Comment on/ });
		expect(controls.length).toBeGreaterThan(0);
		expect(
			controls.every((control) => /old line|new line/.test(control.ariaLabel ?? "")),
		).toBe(true);
	});

	it("keeps sidebar filters controlled by the workspace", async () => {
		const onStatusFilterChange = vi.fn();
		render(
			<FileTreeCompare
				files={snapshot.files}
				selectedPath={snapshot.files[0]!.path}
				onSelect={vi.fn()}
				statusFilter={new Set()}
				categoryFilter={new Set()}
				onStatusFilterChange={onStatusFilterChange}
				onCategoryFilterChange={vi.fn()}
			/>,
		);
		await userEvent.click(screen.getByTitle("Added files"));
		expect(onStatusFilterChange).toHaveBeenCalledWith(new Set(["added"]));
	});
});

describe("inline comment states", () => {
	const anchor: CommentAnchor = {
		path: "src/user.ts",
		side: "RIGHT",
		line: 12,
	};

	it("disables the composer while posting and surfaces failures", async () => {
		let reject!: (reason: Error) => void;
		const onCreate = vi.fn(
			() =>
				new Promise<never>((_resolve, rejectPromise) => {
					reject = rejectPromise;
				}),
		);
		render(<InlineComments anchors={[anchor]} threads={[]} onCreate={onCreate} />);
		await userEvent.click(
			screen.getByRole("button", { name: "Comment on new line 12" }),
		);
		await userEvent.type(screen.getByRole("textbox"), "Please cover this.");
		await userEvent.click(screen.getByRole("button", { name: "Comment" }));
		expect(
			(screen.getByRole("button", { name: "Posting…" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		reject(new Error("The diff changed."));
		expect(await screen.findByText("The diff changed.")).toBeTruthy();
		expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
			"Please cover this.",
		);
	});
});

describe("review intelligence navigation", () => {
	it("links evidence to its exact changed line", async () => {
		const intelligence = buildDeterministicIntelligence(snapshot);
		const evidence = intelligence.risks.flatMap((risk) => risk.evidence)[0];
		expect(evidence).toBeDefined();
		const onNavigate = vi.fn();
		render(
			<IntelligencePanel
				result={{ intelligence, aiAvailable: true }}
				generating={false}
				onGenerate={vi.fn()}
				onNavigate={onNavigate}
			/>,
		);
		await userEvent.click(
			screen.getByRole("button", {
				name: `${evidence!.label} · ${evidence!.anchor.side} ${evidence!.anchor.line}`,
			}),
		);
		expect(onNavigate).toHaveBeenCalledWith(evidence!.anchor);
	});
});
