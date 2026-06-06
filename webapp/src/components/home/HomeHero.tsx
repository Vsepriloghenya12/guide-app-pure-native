import { UserAuthTrigger } from '../auth/UserAuthTrigger';

export function HomeHero() {
  const heroImage = '/home-hero-background.png';

  return (
    <section className="travel-hero travel-hero--clean" aria-label="Главный экран" data-tone="coast">
      <img className="travel-hero__media" src={heroImage} alt="Место — найди своё место в городе" decoding="async" />
      <div className="travel-hero__overlay" />
      <div className="travel-hero__utility">
        <UserAuthTrigger variant="hero" />
      </div>
    </section>
  );
}
