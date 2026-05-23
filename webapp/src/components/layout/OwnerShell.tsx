import { Outlet } from 'react-router-dom';

export function OwnerShell() {
  return (
    <div className="owner-shell">
      <main className="owner-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
