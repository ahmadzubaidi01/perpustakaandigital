import type { Metadata } from "next";
import { AuthLayout as SharedAuthLayout } from "@/components/layouts/AuthLayout";

export const metadata: Metadata = {
  title: "Login — Perpustakaan Digital",
  description: "Masuk ke sistem Perpustakaan Digital",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SharedAuthLayout>{children}</SharedAuthLayout>;
}

