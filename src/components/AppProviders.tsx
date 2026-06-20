"use client";

import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { QuickCapture } from "@/components/QuickCapture";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <QuickCapture />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
