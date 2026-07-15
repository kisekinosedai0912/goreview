import type { ChangeCategory } from "../schemas/review";

export type CategoryRule = {
	category: ChangeCategory;
	patterns: string[];
};

export const categoryRules: CategoryRule[] = [
	{
		category: "package",
		patterns: [
			"package.json",
			"package-lock.json",
			"pnpm-lock.yaml",
			"yarn.lock",
			"bun.lockb",
		],
	},
	{
		category: "database",
		patterns: [
			"**/*.prisma",
			"**/prisma/**",
			"**/migrations/**",
			"**/*.sql",
		],
	},
	{
		category: "backend",
		patterns: ["**/api/**", "**/routes/**", "**/server/**", "**/backend/**"],
	},
	{
		category: "ui",
		patterns: [
			"**/*.tsx",
			"**/components/**",
			"**/pages/**",
			"**/app/**",
			"**/ui/**",
		],
	},
	{
		category: "test",
		patterns: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/tests/**"],
	},
	{
		category: "ci",
		patterns: [
			".github/**",
			"**/.github/**",
			"**/workflows/**",
			"**/*ci*.*",
			"**/Dockerfile",
		],
	},
	{
		category: "docs",
		patterns: ["**/*.md", "**/docs/**", "README*"],
	},
	{
		category: "config",
		patterns: [
			"**/*.config.*",
			"**/.env*",
			"**/tsconfig*.json",
			"**/.eslintrc*",
			"**/eslint.config.*",
			"**/vite.config.*",
			"components.json",
		],
	},
];
