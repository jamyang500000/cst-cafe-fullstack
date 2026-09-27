// Web app manifest - lets phones install CST Cafe like an app
// (own icon on the home screen, opens full-screen without the browser bar).
// Next.js serves this at /manifest.webmanifest automatically.

export default function manifest() {
  return {
    name: "CST Cafe",
    short_name: "CST Cafe",
    description: "Book a table, pre-order your meal, and skip the queue at CST Cafe.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdf6ec",
    theme_color: "#4a2a1a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
