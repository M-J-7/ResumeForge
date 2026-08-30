import type { Metadata } from "next";
import { BuilderShell } from "@/components/builder/BuilderShell";

export const metadata: Metadata = {
  title: "Build your resume",
  description: "Build an ATS-safe resume in your browser. Nothing is uploaded.",
};

export default function BuilderPage() {
  return <BuilderShell />;
}
