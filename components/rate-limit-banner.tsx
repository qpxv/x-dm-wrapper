"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RateLimitBanner(): JSX.Element {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  async function handleContinue(): Promise<void> {
    setIsRetrying(true);
    await fetch("/api/x/rate-limit/bump", { method: "POST" });
    setIsRetrying(false);
    router.refresh();
  }

  return (
    <Alert>
      <AlertDescription>
        Daily X API call cap reached — some messages may be incomplete.
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={handleContinue} disabled={isRetrying}>
          {isRetrying ? "Fetching..." : "Continue anyway"}
        </Button>
      </AlertAction>
    </Alert>
  );
}
