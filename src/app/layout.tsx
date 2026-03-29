import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Graphene — Paper Intelligence",
  description: "A knowledge graph for academic papers",
  icons: {
    icon: "/graphene.png",
    apple: "/graphene.png",
  },
  openGraph: {
    title: "Graphene",
    description: "A knowledge graph for academic papers",
    images: ["/graphene.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
