"use client";

export default function AiOrb({ speaking = false }: { speaking?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-56 w-56 items-center justify-center md:h-64 md:w-64"
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(103,232,249,0.28),transparent_70%)] blur-2xl animate-glow-pulse" />
      <div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.2),transparent_70%)] blur-2xl animate-glow-pulse"
        style={{ animationDelay: "1.2s" }}
      />

      <div className="orb-spin">
        <div className={`orb-core ${speaking ? "orb-speaking" : ""}`} />
      </div>

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
    </div>
  );
}
