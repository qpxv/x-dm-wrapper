import type { JSX } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading(): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="h-7 w-16" />
      </header>

      <ul>
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-8 shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
