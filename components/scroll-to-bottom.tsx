"use client";

import { useEffect, useRef, type JSX } from "react";

export function ScrollToBottom(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView();
  }, []);

  return <div ref={ref} />;
}
