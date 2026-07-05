/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the Cognee API key server-side only. Never expose it to the client.
  env: {},
  // reactflow ships ESM; transpile for safety across Next versions.
  transpilePackages: ["reactflow"],
};

export default nextConfig;
