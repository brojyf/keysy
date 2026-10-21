import { useEffect } from 'react';
import LogoPreview from './logo/LogoPreview.jsx';
import candidates from './logo/candidates.json';
import { palettes } from '../theme/palettes.js';

export default function DesignStudio() {
  useEffect(() => {
    document.title = 'Keysy — Logo · Design Studio';
  }, []);

  return <div className="design-studio">
    <header className="design-header">
      <div className="design-header-inner">
        <div className="design-brand"><strong>keysy<span>↗</span></strong><span>Design Studio</span></div>
        <span className="design-meta">{candidates.length} marks <span>·</span> {palettes.length} color systems</span>
      </div>
    </header>
    <main><LogoPreview /></main>
    <footer className="design-footer"><span>KEYSY / DESIGN STUDIES</span><p>A space to explore. Not production UI.</p></footer>
  </div>;
}
