import type { Metadata } from "next";
import UmrahClient from "./UmrahClient";

export const metadata: Metadata = {
  title: "Umrah du'as · du'aOS",
  description: "Collect du'as from friends and carry them with you on Umrah — all local, shared by link.",
};

export default function UmrahPage() {
  return <UmrahClient />;
}
