import type { JSX } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Loading(): JSX.Element {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col overflow-hidden">
      <div className="shrink-0">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <Skeleton className="size-5" />
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </header>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden px-4 py-4">
        {[false, true, true, false, true].map((outbound, i) => (
          <div key={i} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
            <Skeleton className="h-9 w-2/5 rounded-2xl" />
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t px-4 py-3">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}
