import { FormEvent, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { loginOwner } from '../utils/ownerAuth';

export function OwnerLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || '/owner';
  }, [location.state]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await loginOwner(password);
      if (response.authenticated) {
        navigate(nextPath, { replace: true });
        return;
      }

      setError('Неверный пароль. Проверь значение и попробуй снова.');
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : 'Owner request failed';

      if (message === 'Invalid password') {
        setError('Неверный пароль. Проверь значение и попробуй снова.');
      } else if (message === 'Failed to fetch' || message === 'Owner request failed') {
        setError('Не удалось связаться с локальным сервером. Откройте локальную версию на 127.0.0.1:5180 и попробуйте снова.');
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-stack owner-login-page">
      <PageHeader
        title="Вход для владельца"
        subtitle="Это отдельная ссылка для входа в закрытую owner-CMS. В публичном приложении кнопок сюда нет."
        showBack
        badgeLabel="Owner CMS"
      />

      <section className="owner-login-card">
        <div className="owner-login-card__intro">
          <span className="eyebrow">Owner CMS</span>
          <h2>Управление наполнением приложения</h2>
          <p>
            Вход владельца теперь проверяется на сервере, а сессия хранится в cookie. Пароль удобно
            задаётся через Railway Variables.
          </p>
          <p>
            Документы: <a href="/terms" target="_blank" rel="noreferrer">соглашение</a>,{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">конфиденциальность</a>,{' '}
            <a href="/delete-profile" target="_blank" rel="noreferrer">удаление данных</a>,{' '}
            <a href="/support" target="_blank" rel="noreferrer">поддержка</a>.
          </p>
        </div>

        <form className="owner-login-form" onSubmit={handleSubmit}>
          <label className="field owner-login-form__field">
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError('');
              }}
              placeholder="Введите пароль владельца"
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </label>

          {error ? <div className="owner-login-form__error">{error}</div> : null}

          <div className="owner-login-form__actions">
            <button className="button button--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Проверяем пароль…' : 'Войти в owner-CMS'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
