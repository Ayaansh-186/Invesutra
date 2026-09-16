"use client";

/**
 * The Invesutra orb — used large on the marketing hero and small as the
 * assistant's avatar inside the app, so the same character appears in both.
 */
export default function AiOrb({
  speaking = false,
  size = "lg",
  showWaveform = true,
}: {
  speaking?: boolean;
  size?: "sm" | "md" | "lg";
  showWaveform?: boolean;
}) {
  const wrapper =
    size === "sm"
      ? "h-9 w-9"
      : size === "md"
        ? "h-20 w-20"
        : "h-56 w-56 md:h-64 md:w-64";

  const core =
    size === "sm" ? "orb-core-sm" : size === "md" ? "orb-core-md" : "orb-core";

  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center justify-center ${wrapper}`}
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(103,232,249,0.28),transparent_70%)] blur-2xl animate-glow-pulse" />
      <div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.2),transparent_70%)] blur-2xl animate-glow-pulse"
        style={{ animationDelay: "1.2s" }}
      />

      <div className="orb-spin">
        <div className={`${core} ${speaking ? "orb-speaking" : ""}`} />
      </div>

      {showWaveform && size === "lg" && (
        <div
          className={`pointer-events-none absolute bottom-8 flex items-end gap-1 transition-opacity duration-300 ${
            speaking ? "opacity-90" : "opacity-30"
          }`}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="orb-bar w-1 rounded-full bg-white/90"
              style={{ animationDelay: `${i * 0.11}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
