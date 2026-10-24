import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Savdo ERP — O'zbekiston uchun CRM, POS va ERP",
    template: "%s · Savdo ERP",
  },
  description:
    "Chakana va ulgurji savdo uchun omni-channel CRM/POS/ERP: kassa, nasiya daftari, ombor, moliya va analitika.",
  applicationName: "Savdo ERP",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
