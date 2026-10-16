/** Letras "Z" que flotan junto a Xolo mientras duerme. Decorativo: no recibe clics. */
const LETTERS = [
  { size: 20, left: 66, delay: 0 },
  { size: 28, left: 72, delay: 1.2 },
  { size: 36, left: 78, delay: 2.4 },
];

export function Zzz() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <style>{`
        @keyframes xolo-zzz { 0% { opacity: 0; transform: translateY(10px); }
          25% { opacity: 1; } 100% { opacity: 0; transform: translateY(-50px); } }
        @media (prefers-reduced-motion: reduce) { .xolo-z { animation: none !important; opacity: .8 !important; } }
      `}</style>
      {LETTERS.map((l) => (
        <span
          key={l.delay}
          className="xolo-z"
          style={{
            position: "absolute",
            top: "26%",
            left: `${l.left}%`,
            fontFamily: "system-ui, sans-serif",
            fontWeight: 700,
            fontSize: l.size,
            color: "#b9a6e8",
            textShadow: "0 1px 2px rgba(0,0,0,.25)",
            opacity: 0,
            animation: `xolo-zzz 3.6s ease-out ${l.delay}s infinite`,
          }}
        >
          Z
        </span>
      ))}
    </div>
  );
}
