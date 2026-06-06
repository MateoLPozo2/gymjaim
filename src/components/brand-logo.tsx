import logoAsset from "@/assets/gymjaim-logo.svg.asset.json";

interface BrandLogoProps {
  className?: string;
  showWordmark?: boolean;
}

export function BrandLogo({ className = "", showWordmark = true }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoAsset.url}
        alt="Jim's Data Gym — Bayes Law"
        className="h-8 w-auto"
      />
      {showWordmark && (
        <span className="font-display text-xl font-semibold tracking-tight">
          Jim's Data Gym
        </span>
      )}
    </span>
  );
}
