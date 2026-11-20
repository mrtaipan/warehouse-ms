/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/inbound/wa-report/*': ['./public/fonts/open-sans/*.ttf'],
  },
};

export default nextConfig;
