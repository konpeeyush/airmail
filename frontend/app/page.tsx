import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <>
      <header className="flex flex-col gap-1 pb-6">
        <h1 className="font-heading text-[1.1875rem] font-medium">Email Composer</h1>
        <p className="text-muted-foreground">
          Write an email, add recipients and attachments, and send it through the API.
        </p>
      </header>

      <Separator />

      {/* The compose form lands here in Phase 7. */}
      <p className="pt-6 text-muted-foreground">Compose form coming next.</p>
    </>
  );
}
