"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Attachment01Icon, MailSend01Icon, MinusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { AttachmentList } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  checkFile,
  validateCompose,
  type ComposeValues,
  type FieldErrors,
  type FieldName,
} from "@/lib/email-schema";
import { formatBytes } from "@/lib/format";
import { ACCEPT, LIMITS } from "@/lib/limits";
import { useUiSounds } from "@/lib/sound";

const EMPTY: ComposeValues = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  isHtml: false,
  attachments: [],
};

// Order used to move focus to the first problem after a failed submit.
const FIELD_ORDER: FieldName[] = ["to", "cc", "bcc", "subject", "body", "attachments"];

const ATTACHMENT_HINT = `Up to ${LIMITS.MAX_FILES} files, ${formatBytes(LIMITS.MAX_FILE_SIZE)} each, ${formatBytes(
  LIMITS.MAX_TOTAL_SIZE,
)} in total. PDF, images, TXT, CSV, DOCX, XLSX or ZIP.`;

/** ["a", "b", "c"] → "a, b and c". */
function formatList(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Focuses the first field with an error. Returns whether there was one. */
function focusFirstInvalid(errors: FieldErrors): boolean {
  const first = FIELD_ORDER.find((field) => errors[field]);
  if (first) document.getElementById(first)?.focus();
  return Boolean(first);
}

type ComposeFormProps = {
  /** Called with values that passed client-side validation. */
  onSubmit: (values: ComposeValues) => void;
  /** While true every control is disabled, which also prevents double submits. */
  isSending?: boolean;
  /** Field errors returned by the API (400). Each clears once its field is edited. */
  serverErrors?: FieldErrors;
};

const NO_ERRORS: FieldErrors = {};

export function ComposeForm({ onSubmit, isSending = false, serverErrors = NO_ERRORS }: ComposeFormProps) {
  const [values, setValues] = useState<ComposeValues>(EMPTY);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  // When errors show ("reward early, punish late"):
  // - a field you've edited shows its error when you leave it (blur)
  // - from then on that field's error updates live, so fixing it clears it
  // - clicking Send shows every remaining error at once
  // Typing never shows an error mid-word, and tabbing past an empty field
  // doesn't flag it as required.
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<FieldName>>(new Set());
  const edited = useRef(new Set<FieldName>());
  // Files refused at pick time (wrong type, too big…). They never enter state.
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);

  // Server errors are copied into state when a new set arrives, so editing a
  // field can clear its server error without waiting for another round trip.
  const [receivedServerErrors, setReceivedServerErrors] = useState(serverErrors);
  const [openServerErrors, setOpenServerErrors] = useState(serverErrors);
  if (serverErrors !== receivedServerErrors) {
    setReceivedServerErrors(serverErrors);
    setOpenServerErrors(serverErrors);
  }

  const fileInput = useRef<HTMLInputElement>(null);
  const sounds = useUiSounds();

  // Client rules win when both disagree; the server only adds what the client can't know.
  const clientErrors = validateCompose(values);
  const visibleClientErrors: FieldErrors = attempted
    ? clientErrors
    : Object.fromEntries(Object.entries(clientErrors).filter(([field]) => touched.has(field as FieldName)));
  const errors: FieldErrors = { ...openServerErrors, ...visibleClientErrors };

  // Move focus to the first field the server rejected.
  useEffect(() => {
    focusFirstInvalid(serverErrors);
  }, [serverErrors]);
  const totalSize = values.attachments.reduce((sum, file) => sum + file.size, 0);

  // Send stays disabled until the required fields have content. Format problems
  // (e.g. "bob@") still need a click on Send, or a blur, to show.
  const missing = [
    !values.to.trim() && "a recipient",
    !values.subject.trim() && "a subject",
    !values.body.trim() && "a message",
  ].filter((item): item is string => Boolean(item));
  const canSend = missing.length === 0 && !isSending;

  function update<K extends keyof ComposeValues>(field: K, value: ComposeValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    edited.current.add(field as FieldName);
    if (field in openServerErrors) {
      setOpenServerErrors((current) => {
        const next = { ...current };
        delete next[field as FieldName];
        return next;
      });
    }
  }

  function addFiles(picked: FileList | null) {
    if (!picked) return;

    const accepted = [...values.attachments];
    const problems: string[] = [];
    let total = totalSize;

    for (const file of Array.from(picked)) {
      const duplicate = accepted.some(
        (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
      );
      if (duplicate) continue;

      const problem = checkFile(file);
      if (problem) {
        problems.push(problem);
      } else if (accepted.length >= LIMITS.MAX_FILES) {
        problems.push(`"${file.name}" was not added: you can attach at most ${LIMITS.MAX_FILES} files`);
      } else if (total + file.size > LIMITS.MAX_TOTAL_SIZE) {
        problems.push(`"${file.name}" was not added: attachments would exceed ${formatBytes(LIMITS.MAX_TOTAL_SIZE)} in total`);
      } else {
        accepted.push(file);
        total += file.size;
      }
    }

    if (problems.length > 0) sounds.warning();
    else if (accepted.length > values.attachments.length) sounds.add();

    update("attachments", accepted);
    setRejectedFiles(problems);
    // Clear the native input so picking the same file again still fires onChange.
    if (fileInput.current) fileInput.current.value = "";
  }

  /**
   * Collapses the Cc or Bcc field. Its value goes with it, so hidden addresses
   * are never sent, and focus returns to To so keyboard users aren't lost.
   */
  function hideCopyField(field: "cc" | "bcc") {
    sounds.hide();
    update(field, "");
    edited.current.delete(field);
    setTouched((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
    if (field === "cc") setShowCc(false);
    else setShowBcc(false);
    document.getElementById("to")?.focus();
  }

  function removeFile(index: number) {
    sounds.remove();
    update(
      "attachments",
      values.attachments.filter((_, i) => i !== index),
    );
    setRejectedFiles([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setAttempted(true);

    const found = validateCompose(values);
    if (focusFirstInvalid(found)) {
      sounds.warning();
      return;
    }

    sounds.send();
    onSubmit(values);
  }

  /** aria wiring shared by every control: invalid state + which text describes it. */
  function a11y(field: FieldName, hasDescription = false) {
    const describedBy = [hasDescription && `${field}-description`, errors[field] && `${field}-error`]
      .filter(Boolean)
      .join(" ");
    return {
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": describedBy || undefined,
    };
  }

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={isSending} className="flex flex-col gap-6">
      {/* A disabled fieldset disables every control inside it natively. */}
      <fieldset
        disabled={isSending}
        className="min-w-0"
        // One delegated listener for every text field: a soft tick when a click
        // moves focus into a field. Keyboard focus and clicks inside the field
        // you're already typing in stay silent.
        // Delegated blur (React's onBlur bubbles): leaving a field you've edited reveals its error.
        onBlur={(event) => {
          const field = event.target.id as FieldName;
          if (edited.current.has(field) && !touched.has(field)) {
            setTouched((current) => new Set(current).add(field));
            // The moment an inline error first appears. Not while typing, and not
            // again for an error that is already showing (or after Send showed them all).
            if (clientErrors[field] && !attempted) sounds.error();
          }
        }}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.matches("input, textarea") && target !== document.activeElement) sounds.field();
        }}
      >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.to}>
          <FieldLabel htmlFor="to">To</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="to"
              name="to"
              value={values.to}
              onChange={(e) => update("to", e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              autoComplete="off"
              spellCheck={false}
              {...a11y("to", true)}
            />
            {(!showCc || !showBcc) && (
              <InputGroupAddon align="inline-end">
                {!showCc && (
                  <InputGroupButton
                    onClick={() => {
                      sounds.reveal();
                      setShowCc(true);
                    }}
                    aria-label="Add Cc recipients"
                  >
                    Cc
                  </InputGroupButton>
                )}
                {!showBcc && (
                  <InputGroupButton
                    onClick={() => {
                      sounds.reveal();
                      setShowBcc(true);
                    }}
                    aria-label="Add Bcc recipients"
                  >
                    Bcc
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            )}
          </InputGroup>
          <FieldDescription id="to-description">Separate multiple addresses with commas.</FieldDescription>
          <FieldError id="to-error">{errors.to}</FieldError>
        </Field>

        {showCc && (
          <Field data-invalid={!!errors.cc}>
            <FieldLabel htmlFor="cc">Cc</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="cc"
                name="cc"
                value={values.cc}
                onChange={(e) => update("cc", e.target.value)}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                {...a11y("cc")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs"
                  // Stays grey when the field is invalid, so it doesn't read as an error icon.
                  className="text-muted-foreground" onClick={() => hideCopyField("cc")} aria-label="Remove Cc">
                  <HugeiconsIcon icon={MinusSignIcon} />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError id="cc-error">{errors.cc}</FieldError>
          </Field>
        )}

        {showBcc && (
          <Field data-invalid={!!errors.bcc}>
            <FieldLabel htmlFor="bcc">Bcc</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="bcc"
                name="bcc"
                value={values.bcc}
                onChange={(e) => update("bcc", e.target.value)}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                {...a11y("bcc", true)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs"
                  // Stays grey when the field is invalid, so it doesn't read as an error icon.
                  className="text-muted-foreground" onClick={() => hideCopyField("bcc")} aria-label="Remove Bcc">
                  <HugeiconsIcon icon={MinusSignIcon} />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id="bcc-description">Bcc recipients are hidden from everyone else.</FieldDescription>
            <FieldError id="bcc-error">{errors.bcc}</FieldError>
          </Field>
        )}

        <Field data-invalid={!!errors.subject}>
          <FieldLabel htmlFor="subject">Subject</FieldLabel>
          <Input
            id="subject"
            name="subject"
            value={values.subject}
            onChange={(e) => update("subject", e.target.value)}
            maxLength={LIMITS.MAX_SUBJECT_LENGTH}
            autoComplete="off"
            {...a11y("subject")}
          />
          <FieldError id="subject-error">{errors.subject}</FieldError>
        </Field>

        <Field data-invalid={!!errors.body}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="body">Message</FieldLabel>
            <ToggleGroup
              value={[values.isHtml ? "html" : "text"]}
              // Base UI allows deselecting the active item; ignore that so one format is always chosen.
              onValueChange={(next) => {
                if (next.length === 0) return;
                sounds.tab();
                update("isHtml", next[0] === "html");
              }}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Message format"
              // An invalid Field turns its contents red; the error is about the text, not the format.
              className="text-foreground"
            >
              <ToggleGroupItem value="text">Plain text</ToggleGroupItem>
              <ToggleGroupItem value="html">HTML</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Textarea
            id="body"
            name="body"
            value={values.body}
            onChange={(e) => update("body", e.target.value)}
            placeholder={values.isHtml ? "<p>Hello,</p>\n<p>…</p>" : "Hello,"}
            className={values.isHtml ? "min-h-48 font-mono" : "min-h-48"}
            spellCheck={!values.isHtml}
            {...a11y("body", values.isHtml)}
          />
          {values.isHtml && (
            <FieldDescription id="body-description">
              A plain-text copy is sent too, for mail apps that don&apos;t show HTML.
            </FieldDescription>
          )}
          <FieldError id="body-error">{errors.body}</FieldError>
        </Field>

        {/* No data-invalid here: it would turn the file list and button red.
            The error text below is red on its own. */}
        <Field>
          <div className="flex items-center justify-between gap-2">
            <FieldTitle id="attachments-label">Attachments</FieldTitle>
            <Button
              id="attachments"
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                sounds.press();
                fileInput.current?.click();
              }}
              aria-describedby="attachments-description"
            >
              <HugeiconsIcon icon={Attachment01Icon} data-icon="inline-start" />
              Attach files
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
            aria-labelledby="attachments-label"
          />
          <FieldContent>
            <AttachmentList files={values.attachments} onRemove={removeFile} />
            <FieldDescription id="attachments-description">{ATTACHMENT_HINT}</FieldDescription>
          </FieldContent>
          <FieldError
            errors={[...rejectedFiles, errors.attachments].filter(Boolean).map((message) => ({ message }))}
          />
        </Field>
      </FieldGroup>
      </fieldset>

      <Separator />

      <div className="flex items-center gap-4">
        <Button
          type="submit"
          size="lg"
          disabled={!canSend}
          aria-describedby={missing.length > 0 && !isSending ? "send-hint" : undefined}
        >
          {isSending ? (
            <>
              <Spinner data-icon="inline-start" />
              Sending…
            </>
          ) : (
            <>
              <HugeiconsIcon icon={MailSend01Icon} data-icon="inline-start" />
              Send email
            </>
          )}
        </Button>
        {/* A disabled button can't explain itself, so say what's missing. */}
        {missing.length > 0 && !isSending && (
          <p id="send-hint" className="text-muted-foreground">
            Add {formatList(missing)} to send.
          </p>
        )}
        {values.attachments.length > 0 && (
          <p className="ml-auto text-muted-foreground tabular-nums">
            {values.attachments.length} {values.attachments.length === 1 ? "file" : "files"}, {formatBytes(totalSize)}
          </p>
        )}
      </div>
    </form>
  );
}
