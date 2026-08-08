"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps, JSX } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>): JSX.Element {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
