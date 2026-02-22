import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATX Scrubbin' — Mobile Car Wash in Austin, TX",
  description:
    "We scrub so you don't have to. Premium mobile car wash service in Austin, Texas. Book online in minutes.",
  openGraph: {
    title: "ATX Scrubbin' — Mobile Car Wash in Austin, TX",
    description:
      "We scrub so you don't have to. Premium mobile car wash service in Austin, Texas.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
