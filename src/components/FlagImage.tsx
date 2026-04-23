export function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2 || code === "zz") return "🏴";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65
  );
}

interface FlagImageProps {
  code: string;
  name: string;
  size?: number;
}

export default function FlagImage({ code, name, size = 40 }: FlagImageProps) {
  const fontSize = Math.round(size * 0.72);
  return (
    <span
      style={{ fontSize: `${fontSize}px`, lineHeight: 1 }}
      role="img"
      aria-label={`Drapeau ${name}`}
      className="select-none inline-block"
    >
      {getFlagEmoji(code)}
    </span>
  );
}
