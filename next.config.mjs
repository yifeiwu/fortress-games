/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The /rules/[game] route reads Markdown from /docs at runtime; make sure those
  // files are included in the serverless function bundle on deploy.
  outputFileTracingIncludes: {
    "/rules/[game]": ["./docs/**/*.md"],
  },
};

export default nextConfig;
