import { useEffect, useRef } from 'react';

type TelegramLoginWidgetProps = {
  botUsername: string;
  authUrl: string;
};

export function TelegramLoginWidget({ botUsername, authUrl }: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !botUsername) {
      return;
    }

    container.innerHTML = '';
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '14');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-auth-url', new URL(authUrl, window.location.origin).toString());
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [authUrl, botUsername]);

  return <div className="public-auth-telegram-widget" ref={containerRef} />;
}
