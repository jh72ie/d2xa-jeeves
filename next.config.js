/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript type import and variable declaration removed/changed for JS

  // experimental: {
  //   ppr: true,
  // },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/d/:slug',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

// Use CommonJS module export for a .js file
module.exports = nextConfig;