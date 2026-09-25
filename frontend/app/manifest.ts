import type { MetadataRoute } from "next";

import { APP_NAME, DESCRIPTION } from "@/lib/brand";

/** Web app manifest: name and icons for "Add to Home Screen" / install. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#fdfdfc",
    theme_color: "#4e3dfc",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Artwork inset into the safe zone, so Android can crop it to any shape.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
