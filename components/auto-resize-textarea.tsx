"use client";

import { useLayoutEffect, useRef, type ComponentProps, type JSX } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AutoResizeTextareaProps extends ComponentProps<"textarea"> {
  maxHeight?: number;
}

export function AutoResizeTextarea({
  maxHeight,
  className,
  value,
  ...props
}: AutoResizeTextareaProps): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    const next = maxHeight ? Math.min(el.scrollHeight, maxHeight) : el.scrollHeight;
    el.style.height = `${next}px`;
  }, [value, maxHeight]);

  return (
    <Textarea
      ref={ref}
      value={value}
      className={cn("min-h-9 resize-none overflow-y-auto", className)}
      {...props}
    />
  );
}
