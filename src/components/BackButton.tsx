"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type BackButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "asChild" | "onClick" | "type"
> & {
  fallbackHref?: string;
};

export function BackButton({
  fallbackHref = "/",
  children,
  ...props
}: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button type="button" onClick={handleBack} {...props}>
      {children}
    </Button>
  );
}
