"use client";

import { useRef, useState, type FormEvent } from "react";
import { Attachment01Icon, MailSend01Icon } from "@hugeicons/core-free-icons";
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

type ComposeFormProps = {
  /** Called with valid values. Wired to the API in Phase 8. */
  onSubmit: (values: ComposeValues) => void;
};

export function ComposeForm({ onSubmit }: ComposeFormProps) {
  const [values, setValues] = useState<ComposeValues>(EMPTY);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  // Errors appear only after the first submit attempt, then update live as
  // the user fixes things ("reward early, punish late").
  const [attempted, setAttempted] = useState(false);
  // Files refused at pick time (wrong type, too big…). They never enter state.
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);

  const fileInput = useRef<HTMLInputElement>(null);

  const errors: FieldErrors = attempted ? validateCompose(values) : {};
  const totalSize = values.attachments.reduce((sum, file) => sum + file.size, 0);

  function update<K extends keyof ComposeValues>(field: K, value: ComposeValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
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

    update("attachments", accepted);
    setRejectedFiles(problems);
    // Clear the native input so picking the same file again still fires onChange.
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeFile(index: number) {
    update(
      "attachments",
      values.attachments.filter((_, i) => i !== index),
    );
    setRejectedFiles([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);

    const found = validateCompose(values);
    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

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
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
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
                  <InputGroupButton onClick={() => setShowCc(true)} aria-label="Add Cc recipients">
                    Cc
                  </InputGroupButton>
                )}
                {!showBcc && (
                  <InputGroupButton onClick={() => setShowBcc(true)} aria-label="Add Bcc recipients">
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
            <Input
              id="cc"
              name="cc"
              value={values.cc}
              onChange={(e) => update("cc", e.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              {...a11y("cc")}
            />
            <FieldError id="cc-error">{errors.cc}</FieldError>
          </Field>
        )}

        {showBcc && (
          <Field data-invalid={!!errors.bcc}>
            <FieldLabel htmlFor="bcc">Bcc</FieldLabel>
            <Input
              id="bcc"
              name="bcc"
              value={values.bcc}
              onChange={(e) => update("bcc", e.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              {...a11y("bcc", true)}
            />
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
              onValueChange={(next) => next.length > 0 && update("isHtml", next[0] === "html")}
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
              onClick={() => fileInput.current?.click()}
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

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <Button type="submit" size="lg">
          <HugeiconsIcon icon={MailSend01Icon} data-icon="inline-start" />
          Send email
        </Button>
        {values.attachments.length > 0 && (
          <p className="text-muted-foreground tabular-nums">
            {values.attachments.length} {values.attachments.length === 1 ? "file" : "files"}, {formatBytes(totalSize)}
          </p>
        )}
      </div>
    </form>
  );
}
