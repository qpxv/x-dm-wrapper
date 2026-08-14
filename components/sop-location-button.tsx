"use client";

import type { JSX } from "react";
import { MapPin } from "lucide-react";
import { useReply } from "@/components/reply-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SopLocationButton(): JSX.Element {
  const { fetchSopLocation, isLoadingSopLocation } = useReply();

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Locate stage in SOP"
      onClick={fetchSopLocation}
      disabled={isLoadingSopLocation}
    >
      {isLoadingSopLocation ? <Spinner /> : <MapPin className="size-4" />}
    </Button>
  );
}
