import { Cancel01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";

type AttachmentListProps = {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
};

/** The chosen files, one hairline-separated row each. */
export function AttachmentList({ files, onRemove, disabled }: AttachmentListProps) {
  if (files.length === 0) return null;

  return (
    <ul className="flex flex-col" aria-label="Attached files">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.size}-${file.lastModified}`}
          className="flex items-center gap-2 border-b py-1.5 last:border-b-0"
        >
          <HugeiconsIcon icon={File01Icon} size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
          >
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </li>
      ))}
    </ul>
  );
}
