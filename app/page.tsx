export default function Home() {
  return (
    <main>
      <section className="welcome" aria-labelledby="brand-name">
        <header className="topline">
          <span className="topline-label">Ease your way</span>
          <span className="topline-index">Created by Aina Farhanah</span>
        </header>

        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <h1 id="brand-name">arah</h1>
          <p className="brand-caption">Find your own way.</p>

          <nav className="menu" aria-label="Main menu">
            <a href="/navigation">
              <span>01</span>
              <span>Start Navigate</span>
              <span className="menu-arrow" aria-hidden="true">↗</span>
            </a>
            <a href="/parking">
              <span>02</span>
              <span>Save Parking</span>
              <span className="menu-arrow" aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </section>     
    </main>
  );
}