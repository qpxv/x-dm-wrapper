"use client";

import type { JSX } from "react";
import { X } from "lucide-react";
import { useReply } from "@/components/reply-context";
import { Button } from "@/components/ui/button";

export function SopLocationPanel(): JSX.Element | null {
  const { sopLocation, sopLocationError, dismissSopLocation } = useReply();

  if (!sopLocation && !sopLocationError) {
    return null;
  }

  return (
    <div className="border-t bg-muted/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Where we&apos;re at</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismissSopLocation}>
          <X className="size-4" />
        </Button>
      </div>

      {sopLocationError ? (
        <p className="text-sm text-destructive">{sopLocationError}</p>
      ) : (
        sopLocation && (
          <div className="rounded-md border bg-background p-2 text-sm">
            <p className="font-medium">{sopLocation.stage}</p>
            <p className="text-muted-foreground">{sopLocation.summary}</p>
          </div>
        )
      )}
    </div>
  );
}
