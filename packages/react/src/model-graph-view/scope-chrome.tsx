import { useSubGraphNav } from "./nav-context.ts";

export function ScopeChrome() {
  const { depth, scopeName, navigateBack } = useSubGraphNav();
  if (depth === 0) return null;
  return (
    <div className="wetron-scope-chrome">
      <button
        type="button"
        className="wetron-scope-back"
        onClick={navigateBack}
        aria-label="Back to parent graph"
      >
        ← Back
      </button>
      {scopeName ? <span className="wetron-scope-name">{scopeName}</span> : null}
    </div>
  );
}
