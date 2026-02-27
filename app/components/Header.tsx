export default function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="demo-header">
      <div className="demo-header__brand">
        <h1 className="demo-header__title">Multi-Tenant Finance + Agentic AI Demo</h1>
        <p className="demo-header__sub">
          Reset to start over. Then run bootstrap, transactions, propose, and confirm.
        </p>
      </div>
      <div className="demo-header__actions">
        {children}
      </div>
    </header>
  );
}
