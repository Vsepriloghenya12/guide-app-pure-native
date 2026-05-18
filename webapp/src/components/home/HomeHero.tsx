import { AppLogo } from '../common/AppLogo';
import { UserAuthTrigger } from '../auth/UserAuthTrigger';

export function HomeHero() {
  const heroImage = '/home-hero-background.png';
  const heroLogo = {
    type: 'image' as const,
    src: '/home-hero-logo-custom.png',
    alt: 'Городской гид Дананг'
  };

  return (
    <section className="travel-hero travel-hero--clean" aria-label="Главный экран" data-tone="coast">
      <img className="travel-hero__media" src={heroImage} alt="" decoding="async" />
      <div className="travel-hero__overlay" />
      <div className="travel-hero__utility">
        <UserAuthTrigger variant="hero" />
      </div>

      <div className="travel-hero__content travel-hero__content--logo-only">
        <AppLogo className="travel-hero__brand-logo travel-hero__brand-logo--hero-only" alt={heroLogo.alt} media={heroLogo} />
      </div>
    </section>
  );
}
