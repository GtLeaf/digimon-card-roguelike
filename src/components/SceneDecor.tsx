export function SceneDecor({ theme }: { theme: string }) {
  return (
    <div className={`scene-decor ${theme}`} aria-hidden="true">
      <div className="scene-moon" />
      <div className="horizon h1" />
      <div className="horizon h2" />
      <div className="scene-grid" />
      <i className="particle p1" />
      <i className="particle p2" />
      <i className="particle p3" />
      <i className="particle p4" />
    </div>
  );
}
