import Image from "next/image";

import cover from "@/assets/cover.webp";
import { EmailComposer } from "@/components/email-composer";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/brand";

export default function Home() {
  return (
    <>
      {/* Already a compressed WebP sized for the column at 2x, so it's served as-is.
          On mobile it bleeds to the screen edges and stays pinned while the form
          scrolls under it, so it sits directly in <main> for sticky to work. */}
      <Image
        src={cover}
        alt=""
        preload
        unoptimized
        draggable={false}
        sizes="(max-width: 640px) 100vw, 582px"
        className="mb-5 block h-auto w-full rounded-xl select-none max-md:sticky max-md:top-0 max-md:z-10 max-md:-mx-6 max-md:-mt-8 max-md:w-[calc(100%+3rem)] max-md:max-w-none max-md:rounded-none max-md:shadow-[0_8px_16px_-8px_rgb(0_0_0/0.3)]"
      />
      <header className="flex flex-col gap-1 pb-6">
        <h1 className="font-heading text-[1.1875rem] font-medium">{APP_NAME}</h1>
      </header>

      <Separator className="mb-6" />

      <EmailComposer />
    </>
  );
}
