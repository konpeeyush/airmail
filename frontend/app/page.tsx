"use client";

import { useState } from "react";

import { ComposeForm } from "@/components/compose-form";
import { Separator } from "@/components/ui/separator";
import type { ComposeValues } from "@/lib/email-schema";

export default function Home() {
  // Phase 7 stops at client-side validation. Phase 8 replaces this with the API call.
  const [lastValid, setLastValid] = useState<ComposeValues | null>(null);

  return (
    <>
      <header className="flex flex-col gap-1 pb-6">
        <h1 className="font-heading text-[1.1875rem] font-medium">Email Composer</h1>
        <p className="text-muted-foreground">
          Write an email, add recipients and attachments, and send it through the API.
        </p>
      </header>

      <Separator className="mb-6" />

      <ComposeForm onSubmit={setLastValid} />

      {lastValid && (
        <p role="status" className="pt-4 text-muted-foreground">
          Passed client-side validation ({lastValid.attachments.length} attachment(s)). Sending is wired up in
          Phase 8.
        </p>
      )}
    </>
  );
}
