import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apply",
  description: "Apply to join Standard Spaces.",
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
