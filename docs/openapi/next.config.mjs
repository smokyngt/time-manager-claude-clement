import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  basePath: '/openapi',
  images: { unoptimized: true },
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
};

export default withMDX(config);
