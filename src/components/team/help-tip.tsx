/** (?) icon with a hover / focus tooltip (Figma "Help" frames). Replaces inline help paragraphs. */
export function HelpTip({ text, size = 15 }: { text: string; size?: number }) {
  return (
    <span className="tm-help" tabIndex={0} role="img" aria-label={`Aide : ${text}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" /><circle cx="12" cy="17" r=".6" fill="currentColor" />
      </svg>
      <span className="tm-help-pop" role="tooltip">{text}</span>
    </span>
  );
}
