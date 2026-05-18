import { PropsWithChildren, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getOwnerSession } from '../../utils/ownerAuth';

export function RequireOwner({ children }: PropsWithChildren) {
  const location = useLocation();
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;

    void getOwnerSession()
      .then((result) => {
        if (!cancelled) {
          setStatus(result.authenticated ? 'allowed' : 'denied');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('denied');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="page-stack owner-login-page">
        <section className="owner-login-card">
          <div className="owner-login-card__intro">
            <span className="eyebrow">Owner CMS</span>
            <h2>Проверяем доступ</h2>
            <p>Сессия владельца проверяется на сервере.</p>
          </div>
        </section>
      </div>
    );
  }

  if (status === 'denied') {
    return <Navigate to="/owner-login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
