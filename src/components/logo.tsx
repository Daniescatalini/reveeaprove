export function ReveeLogo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const filter = tone === "light" ? "brightness(0) invert(1)" : undefined;

  return (
    <img
      src="/logo.png"
      alt="Revee Aprove"
      className={className || "h-7 w-auto object-contain"}
      style={{ filter }}
    />
  );
}
