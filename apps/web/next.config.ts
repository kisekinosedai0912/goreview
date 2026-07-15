import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Workspace packages ship raw TypeScript.
	transpilePackages: ["@goreview/core", "@goreview/ui"],
	serverExternalPackages: ["ts-morph"],
};

export default nextConfig;
