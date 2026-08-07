import type { JSX } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const xToken = await prisma.xOAuthToken.findFirst();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <p className="text-muted-foreground">Inbox coming soon.</p>
      {xToken ? (
        <p className="text-sm text-muted-foreground">X account connected</p>
      ) : (
        <Button render={<a href="/api/x/authorize" />}>Connect X account</Button>
      )}
      <SignOutButton />
    </div>
  );
}
