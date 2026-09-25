import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { APP_NAME, DESCRIPTION, INK, PAPER, TAGLINE } from "@/lib/brand";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = `${APP_NAME}: ${DESCRIPTION}`;

const GREY = "rgba(0,0,0,0.42)";
const HAIRLINE = "#ececeb";

/** One row of the sketched compose form: a grey label and its value, over a hairline. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 28,
        padding: "18px 0",
        borderBottom: `1.5px solid ${HAIRLINE}`,
        fontSize: 27,
      }}
    >
      <div style={{ display: "flex", width: 120, color: GREY }}>{label}</div>
      <div style={{ display: "flex", color: INK }}>{value}</div>
    </div>
  );
}

/**
 * The Open Graph card, built on the same rules as the page (and konpeeyush.me's
 * cards): paper ground, ink title in Cooper, one grey for everything
 * secondary, hairlines instead of boxes. The middle is a quiet sketch of the
 * compose form, so the card says "email" before anyone reads it.
 *
 * Satori can't read woff2, so this loads Cooper's TTFs; the page uses the woff2.
 */
export async function ogImage() {
  const [medium, regular, icon] = await Promise.all([
    readFile(join(process.cwd(), "fonts/cooper/Cooper-Medium.ttf")),
    readFile(join(process.cwd(), "fonts/cooper/Cooper-Regular.ttf")),
    readFile(join(process.cwd(), "assets/icon.png")),
  ]);
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAPER,
          color: INK,
          padding: "64px 80px",
        }}
      >
        {/* mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
          <img src={iconSrc} width={52} height={52} alt="" />
          <div style={{ display: "flex", fontSize: 28, color: GREY }}>{APP_NAME}</div>
        </div>

        {/* the compose form, sketched */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          <Row label="To" value="alice@example.com, bob@example.com" />
          <Row label="Subject" value="Quarterly report" />
          <Row label="Attached" value="report.pdf · 1.2 MB" />
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", fontFamily: "Cooper", fontSize: 68, fontWeight: 500, letterSpacing: "-0.015em" }}>
          {TAGLINE}
        </div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 28, color: GREY }}>{DESCRIPTION}</div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Cooper", data: medium, style: "normal", weight: 500 },
        { name: "Cooper", data: regular, style: "normal", weight: 400 },
      ],
    },
  );
}
