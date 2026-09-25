/** The product's name and copy, in one place: page, metadata, icons and the OG card. */
export const APP_NAME = "Airmail";
export const TAGLINE = "Write it, attach it, send it.";
export const DESCRIPTION = "Compose and send email with CC, BCC, HTML bodies and attachments.";

/**
 * Absolute base for metadata URLs (og:image etc.). Set NEXT_PUBLIC_SITE_URL
 * when deploying; social previews need a public URL to fetch the image from.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const INK = "#111";
export const PAPER = "#fdfdfc";
