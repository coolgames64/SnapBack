import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SnapBack — Everything in its place",
  description: "A private photo setup library, built-in camera and subscription AI comparisons.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
