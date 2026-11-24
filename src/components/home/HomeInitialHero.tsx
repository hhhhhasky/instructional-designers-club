/** @jsxRuntime automatic */
import { HOME_LANDING_DEFAULTS } from "../../lib/home-landing-content";

import { COURSE_PATH } from "../../lib/course-paths";

export default function HomeInitialHero() {
  const hero = HOME_LANDING_DEFAULTS.home_hero;
  return (
    <section className="home-initial-hero" aria-label={hero.kicker}>
      <div>
        <p className="home-initial-kicker">{hero.kicker}</p>
        <h1>{hero.title_line1}<br /><span>{hero.title_line2}</span></h1>
        <p className="home-initial-description">{hero.description}</p>
        <a href={COURSE_PATH}>{hero.secondary_cta}</a>
      </div>
    </section>
  );
}
