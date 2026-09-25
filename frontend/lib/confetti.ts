/**
 * Confetti on a successful send: two cannons, bottom-left and bottom-right,
 * angled inward and up so their streams cross over the form.
 *
 * canvas-confetti is imported on demand, so it only downloads the first time
 * someone actually sends an email. It is skipped entirely for people who
 * ask their OS for reduced motion.
 */

// The four doodle hues from konpeeyush.me, plus ink: the only saturated colours in the design.
const COLORS = ["#2f7fe4", "#c9702f", "#3f9e63", "#dc9a1e", "#111111"];

/** How long both cannons keep firing. Pieces fall and fade for ~2s after that. */
const DURATION_MS = 1000;

export async function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const { default: confetti } = await import("canvas-confetti");

  const shared = {
    colors: COLORS,
    disableForReducedMotion: true,
    scalar: 0.9,
    spread: 55,
    startVelocity: 60,
    ticks: 170, // each piece lives ~3s at 60fps, fading out at the end
  };

  const end = performance.now() + DURATION_MS;
  const frame = () => {
    confetti({ ...shared, particleCount: 4, angle: 60, origin: { x: 0, y: 1 } }); // bottom-left, aiming up-right
    confetti({ ...shared, particleCount: 4, angle: 120, origin: { x: 1, y: 1 } }); // bottom-right, aiming up-left
    if (performance.now() < end) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
