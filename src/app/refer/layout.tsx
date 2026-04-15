import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refer a friend",
  description: "Invite someone you'd love to see around the community.",
};

export default function ReferLayout({ children }: { children: React.ReactNode }) {
  return children;
}
