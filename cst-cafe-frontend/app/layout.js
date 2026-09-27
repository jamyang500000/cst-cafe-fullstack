import "./globals.css";
import CafeBackgroundArt from "../components/CafeBackgroundArt";
import { AuthProvider } from "@/lib/AuthContext";
import { LiveEventsProvider } from "@/lib/LiveEvents";
import PwaSetup from "@/components/PwaSetup";

export const metadata = {
  title: "CST Cafe",
  description: "Book a table, pre-order your meal, and skip the queue at CST Cafe.",
  applicationName: "CST Cafe",
  // iPhone: "Add to Home Screen" opens full-screen with this name and icon
  appleWebApp: { capable: true, title: "CST Cafe", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Colour of the phone's status bar / browser toolbar
export const viewport = {
  themeColor: "#4a2a1a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Applies the saved light/dark preference before the page paints,
            so there's no flash of the wrong theme on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = window.localStorage.getItem("cst-cafe-theme");
                  var theme =
                    stored ||
                    (window.matchMedia("(prefers-color-scheme: dark)").matches
                      ? "dark"
                      : "light");
                  if (theme === "dark") {
                    document.documentElement.classList.add("dark");
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CafeBackgroundArt />
        <PwaSetup />
        <AuthProvider>
          <LiveEventsProvider>{children}</LiveEventsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}