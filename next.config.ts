import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App interamente dietro login: le pagine si generano a ogni richiesta.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
