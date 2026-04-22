import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import ReferralsClient from "./ReferralsClient";

export const metadata: Metadata = { title: "Referrals" };

export default function ReferralsPage() {
  return <ReferralsClient navbar={<Navbar />} />;
}
