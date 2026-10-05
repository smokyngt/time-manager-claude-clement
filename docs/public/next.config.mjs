import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  basePath: '',
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default withMDX(config);
