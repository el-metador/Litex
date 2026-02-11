export function GeneratedApp({ routePath }: { routePath: string }) {
  return (
    <main className="page">
      <div className="container">
        <div className="card stack">
          <h1>Generated route: {routePath}</h1>
          <p>Run export endpoint to overwrite this placeholder with Project IR rendering code.</p>
        </div>
      </div>
    </main>
  );
}
