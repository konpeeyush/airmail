"use client";

import { useEffect, useRef, useState } from "react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { ComposeForm } from "@/components/compose-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/toast";
import { SendError, sendEmail, type SendResult } from "@/lib/api";
import type { ComposeValues, FieldErrors } from "@/lib/email-schema";
import { useUiSounds } from "@/lib/sound";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "failed"; error: SendError };

const NO_ERRORS: FieldErrors = {};

/**
 * Success is a toast: the form clears, so there's nothing on the page to
 * point at, and the toast carries the Ethereal link as its action.
 * Failures stay inline next to the form, because the user needs them while fixing it.
 */
function showSentToast(message: string, result: SendResult) {
  const details = [
    result.attachments > 0 && `With ${result.attachments} attachment${result.attachments === 1 ? "" : "s"}.`,
    result.rejected.length > 0 && `Not delivered to ${result.rejected.join(", ")}.`,
  ].filter(Boolean);

  const previewUrl = result.previewUrl;
  toast.add({
    type: "success",
    title: message,
    description: details.length > 0 ? details.join(" ") : undefined,
    // Longer than the default when there's a link to click.
    timeout: previewUrl ? 10_000 : 5_000,
    actionProps: previewUrl
      ? { children: "View", onClick: () => window.open(previewUrl, "_blank", "noopener,noreferrer") }
      : undefined,
  });
}

/** Owns the send lifecycle: calls the API and shows the outcome. The form only handles input. */
export function EmailComposer() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Changing the key remounts the form, which clears every field after a successful send.
  const [formKey, setFormKey] = useState(0);
  const outcome = useRef<HTMLDivElement>(null);
  const sounds = useUiSounds();

  async function handleSubmit(values: ComposeValues) {
    setStatus({ kind: "sending" });
    try {
      const { message, data } = await sendEmail(values);
      sounds.success();
      showSentToast(message, data);
      setStatus({ kind: "idle" });
      setFormKey((key) => key + 1);
    } catch (error) {
      sounds.error();
      setStatus({
        kind: "failed",
        error: error instanceof SendError ? error : new SendError("Something went wrong. Please try again.", 0),
      });
    }
  }

  // Bring the result into view; the form can be taller than the screen.
  useEffect(() => {
    if (status.kind === "failed") {
      outcome.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [status.kind]);

  const serverErrors = status.kind === "failed" ? status.error.fieldErrors : NO_ERRORS;

  return (
    <div className="flex flex-col gap-4">
      <ComposeForm
        key={formKey}
        onSubmit={handleSubmit}
        isSending={status.kind === "sending"}
        serverErrors={serverErrors}
      />

      <div ref={outcome}>
        {status.kind === "failed" && <FailedAlert error={status.error} />}
      </div>
    </div>
  );
}

function FailedAlert({ error }: { error: SendError }) {
  const hasFieldErrors = Object.keys(error.fieldErrors).length > 0;

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={Alert02Icon} aria-hidden />
      <AlertTitle>Couldn&apos;t send the email</AlertTitle>
      <AlertDescription>
        {/* "Validation failed" is for API clients; people get pointed at the fields instead. */}
        {hasFieldErrors ? "Some fields need attention. They're marked above." : error.message}
      </AlertDescription>
    </Alert>
  );
}
