"use client";

import dynamic from "next/dynamic";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";

const QuickCapture = dynamic(
  () => import("@/components/QuickCapture").then((mod) => mod.QuickCapture),
  { ssr: false },
);

const Inspector = dynamic(
  () => import("react-dev-inspector").then((mod) => mod.Inspector),
  { ssr: false },
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <>
      {isDev && <Inspector />}
      <AuthProvider>
        {children}
        <QuickCapture />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </>
  );
}
