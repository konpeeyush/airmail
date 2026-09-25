import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { APP_NAME, DESCRIPTION, TAGLINE } from "@/lib/brand";
import { LIMITS } from "@/lib/limits";
import { COLORS } from "@/lib/templates/welcome-email";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = `${APP_NAME}: ${DESCRIPTION}`;

const STRIPES = [COLORS.brand, COLORS.card, COLORS.lime, COLORS.card];
const STRIPE_COUNT = 32;

/** Alternating blue / lime / white blocks, like the striped edge of an airmail envelope. */
function StripeBand() {
  return (
    <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden" }}>
      {Array.from({ length: STRIPE_COUNT }, (_, i) => (
        <div key={i} style={{ display: "flex", flex: 1, backgroundColor: STRIPES[i % STRIPES.length] }} />
      ))}
    </div>
  );
}

function TicketColumn({ label, value, align }: { label: string; value: string; align: "flex-start" | "center" | "flex-end" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, flex: 1 }}>
      <div style={{ display: "flex", fontSize: 14, letterSpacing: "0.1em", fontWeight: 600, color: COLORS.muted }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: "flex", marginTop: 4, fontSize: 24, fontWeight: 600, color: COLORS.ink }}>{value}</div>
    </div>
  );
}

/**
 * The Open Graph card, in the same visual language as the welcome email
 * (lib/templates/welcome-email.ts): warm grey page, a white card with the
 * airmail stripe band, the mascot cover, and the boarding-pass ticket.
 *
 * Satori can't read woff2 or webp, so this loads Inter's TTFs and the JPEG
 * cover the email uses.
 */
export async function ogImage() {
  const [regular, semibold, bold, cover] = await Promise.all([
    readFile(join(process.cwd(), "fonts/inter/Inter-Regular.ttf")),
    readFile(join(process.cwd(), "fonts/inter/Inter-SemiBold.ttf")),
    readFile(join(process.cwd(), "fonts/inter/Inter-Bold.ttf")),
    readFile(join(process.cwd(), "public/email/cover.jpg")),
  ]);
  const coverSrc = `data:image/jpeg;base64,${cover.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: COLORS.page,
          padding: 32,
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            backgroundColor: COLORS.card,
            border: `2px solid ${COLORS.line}`,
            borderRadius: 32,
            padding: 18,
          }}
        >
          <StripeBand />

          {/* The cover is 2.6:1; cropping a little off the top and bottom keeps
              the logo and mascot whole and leaves room for the text. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain <img> */}
          <img
            src={coverSrc}
            alt=""
            width={1096}
            height={316}
            style={{ marginTop: 14, borderRadius: 18, objectFit: "cover" }}
          />

          <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 40, padding: "0 22px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", fontSize: 17, letterSpacing: "0.12em", fontWeight: 700, color: COLORS.brand }}>
                CLEARED FOR TAKEOFF
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  fontSize: 46,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  fontWeight: 700,
                  color: COLORS.ink,
                }}
              >
                {TAGLINE}
              </div>
            </div>

            {/* the boarding pass */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 448,
                backgroundColor: "#fafaf7",
                border: `2px solid ${COLORS.line}`,
                borderRadius: 18,
              }}
            >
              <div style={{ display: "flex", padding: "16px 22px 14px" }}>
                <TicketColumn label="From" value="You" align="flex-start" />
                <TicketColumn label="To" value={`Up to ${LIMITS.MAX_RECIPIENTS}`} align="center" />
                <TicketColumn label="Cargo" value={`${LIMITS.MAX_FILES} files`} align="flex-end" />
              </div>
              <div
                style={{
                  display: "flex",
                  borderTop: "2px dashed #d9d9d0",
                  padding: "10px 22px",
                  fontSize: 13,
                  letterSpacing: "0.1em",
                  fontWeight: 600,
                  color: COLORS.muted,
                }}
              >
                PLAIN TEXT OR HTML · CC & BCC ·&nbsp;<span style={{ color: COLORS.brand }}>BOARDING NOW</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Inter", data: regular, style: "normal", weight: 400 },
        { name: "Inter", data: semibold, style: "normal", weight: 600 },
        { name: "Inter", data: bold, style: "normal", weight: 700 },
      ],
    },
  );
}
