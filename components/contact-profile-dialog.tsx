"use client";

import { useState, useTransition, type JSX } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getContactProfile } from "@/app/conversations/[id]/actions";

export function ContactProfileDialog({
  contactId,
  name,
  username,
  profileImageUrl,
  description,
}: {
  contactId: string;
  name: string;
  username: string;
  profileImageUrl: string | null;
  description: string | null;
}): JSX.Element {
  const [profile, setProfile] = useState({ name, username, profileImageUrl, description });
  const [isLoading, startTransition] = useTransition();

  const handleOpenChange = (open: boolean): void => {
    if (open && profile.description === null) {
      startTransition(() => {
        getContactProfile(contactId).then(setProfile);
      });
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar>
          <AvatarImage src={profile.profileImageUrl ?? undefined} />
          <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{profile.name}</p>
          <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
        </div>
      </DialogTrigger>
      <DialogContent className="flex flex-col items-center gap-3 text-center">
        <a href={`https://x.com/${profile.username}`} target="_blank" rel="noopener noreferrer">
          <Avatar size="lg" className="size-20">
            <AvatarImage src={profile.profileImageUrl ?? undefined} />
            <AvatarFallback className="text-xl">{profile.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </a>
        <div>
          <DialogTitle className="text-base">{profile.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
        </div>
        {isLoading ? (
          <Spinner />
        ) : profile.description ? (
          <p className="text-sm text-muted-foreground">{profile.description}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
