import { reviewSnapshotSchema } from "../schemas/review";

export const samplePr = reviewSnapshotSchema.parse({
	baseSha: "a1b2c3d",
	headSha: "e4f5g6h",
	title: "Add user verification and refresh UserCard",
	repo: "jasper/goreview",
	baseBranch: "main",
	headBranch: "feat/user-verification",
	files: [
		{
			path: "package.json",
			status: "modified",
			oldContent: `{
  "name": "goreview",
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  }
}`,
			newContent: `{
  "name": "goreview",
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "zod": "^4.4.3"
  }
}`,
			language: "json",
			categories: ["package"],
			events: [
				{
					kind: "dependency.added",
					name: "zod",
					version: "^4.4.3",
				},
			],
		},
		{
			path: "src/components/UserCard.tsx",
			status: "modified",
			oldContent: `export function UserCard({ name }: { name: string }) {
  return <div className="card">{name}</div>;
}`,
			newContent: `import { useMemo } from "react";

export function UserCard({ name, verified }: { name: string; verified: boolean }) {
  const label = useMemo(() => (verified ? \`\${name} ✓\` : name), [name, verified]);
  return <div className="card">{label}</div>;
}`,
			language: "typescript",
			categories: ["ui"],
			events: [
				{
					kind: "signature.changed",
					symbol: "UserCard",
					before: "({ name }: { name: string })",
					after: "({ name, verified }: { name: string; verified: boolean })",
				},
				{
					kind: "symbol.added",
					symbol: "label",
					type: "function",
				},
			],
		},
		{
			path: "src/api/users.ts",
			status: "modified",
			oldContent: `export async function getUser(id: string) {
  return fetch(\`/api/users/\${id}\`);
}`,
			newContent: `export async function getUser(id: string) {
  return fetch(\`/api/users/\${id}\`);
}

export async function verifyUser(id: string) {
  return fetch(\`/api/users/\${id}/verify\`, { method: "POST" });
}`,
			language: "typescript",
			categories: ["backend"],
			events: [
				{
					kind: "symbol.added",
					symbol: "verifyUser",
					type: "function",
				},
			],
		},
		{
			path: "prisma/schema.prisma",
			status: "modified",
			oldContent: `model User {
  id    String @id @default(cuid())
  name  String
  email String @unique
}`,
			newContent: `model User {
  id            String  @id @default(cuid())
  name          String
  email         String  @unique
  emailVerified Boolean @default(false)
}`,
			language: "prisma",
			categories: ["database"],
			events: [
				{
					kind: "symbol.added",
					symbol: "emailVerified",
					type: "class",
				},
			],
		},
		{
			path: "README.md",
			status: "modified",
			oldContent: `# Goreview

Code review helper.`,
			newContent: `# Goreview

Code review helper with category-aware comparison trees.`,
			language: "markdown",
			categories: ["docs"],
			events: [],
		},
		{
			path: "src/lib/legacy-auth.ts",
			status: "deleted",
			oldContent: `export function legacyLogin() {
  return "deprecated";
}`,
			newContent: null,
			language: "typescript",
			categories: ["backend"],
			events: [
				{
					kind: "symbol.removed",
					symbol: "legacyLogin",
				},
			],
		},
		{
			path: "src/components/VerifiedBadge.tsx",
			status: "added",
			oldContent: null,
			newContent: `export function VerifiedBadge() {
  return <span className="badge">Verified</span>;
}`,
			language: "typescript",
			categories: ["ui"],
			events: [
				{
					kind: "symbol.added",
					symbol: "VerifiedBadge",
					type: "component",
				},
			],
		},
	],
});
