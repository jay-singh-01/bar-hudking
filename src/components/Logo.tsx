// The BarHudking mark: a cocktail glass under a small crown, inside a gold
// ring. Same drawing as the animated splash in index.html, kept static here.
export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7d58b" />
          <stop offset="1" stopColor="#d99a3a" />
        </linearGradient>
        <linearGradient id="lg-drink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a3d" />
          <stop offset="1" stopColor="#ff3d7f" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill="#0f0d0a" stroke="url(#lg-gold)" strokeWidth="3" />
      <path d="M41 50 H79 L60 72 Z" fill="url(#lg-drink)" opacity="0.95" />
      <path d="M34 42 H86 L60 72 Z M60 72 V92 M47 93 H73" fill="none" stroke="url(#lg-gold)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="71" cy="52" r="4" fill="#9fd36b" stroke="#0f0d0a" strokeWidth="1.5" />
      <path d="M47 32 L50 20 L57 27 L60 18 L63 27 L70 20 L73 32 Z" fill="url(#lg-gold)" />
    </svg>
  );
}
