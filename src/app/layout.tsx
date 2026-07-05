import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridian — The Company Brain That Keeps Everyone on One Line",
  description:
    "Meridian is a self-improving stakeholder-alignment company brain on Cognee. It ingests every conversation, builds a Stakeholder-Belief Graph, and runs an align() lint that surfaces and closes misalignments before they become failures.",
  keywords: ["Cognee", "company brain", "alignment", "knowledge graph", "AI memory"],
  openGraph: {
    title: "Meridian",
    description: "Zero degrees of separation from the truth.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
