/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    localPatterns: [
      { pathname: "/api/vendor-media/**" },
      { pathname: "/demo/**", search: "" }
    ],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" }
    ]
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "shopfia.app" }],
        destination: "https://www.shopfia.app/:path*",
        permanent: true
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.tiktok.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com https://*.stripe.com",
              "connect-src 'self' blob: https://api.stripe.com https://*.stripe.com https://*.stripe.network https://*.supabase.co wss://*.supabase.co",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://www.tiktok.com https://www.instagram.com https://embed.music.apple.com https://open.spotify.com https://maps.google.com https://www.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join("; ")
          }
        ]
      },
      {
        source: "/api/pinterest-board",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "default-src 'none'; script-src 'unsafe-inline' https://assets.pinterest.com https://widgets.pinterest.com; style-src 'unsafe-inline'; img-src https://*.pinimg.com https://assets.pinterest.com data:; connect-src https://widgets.pinterest.com; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" }
        ]
      }
    ];
  }
};

export default nextConfig;
