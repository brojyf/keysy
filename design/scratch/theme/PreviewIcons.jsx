const icons = {
  home: <path d="m3 10 9-7 9 7v11h-6v-8H9v8H3Z" />,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M3 14h18" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3m6 0h4" /></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
  folder: <path d="M3 7h6l2-3h4l2 3h4v13H3Z" />,
  key: <><circle cx="8" cy="9" r="5" /><path d="m12 13 8 8m-4-4 3-3m-7 3 3-3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
  down: <path d="m8 10 4 4 4-4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8Z" />,
  branch: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="19" r="2" /><path d="M6 7v10m0-4h5a7 7 0 0 0 7-5" /></>,
  file: <><path d="M5 3h9l5 5v13H5Z" /><path d="M14 3v6h5M8 13h8M8 17h5" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V3H3v12h5" /></>,
  book: <path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2Z" />,
};

export function Icon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">{icons[name] || icons.file}</svg>;
}

export function Logo() {
  return <span className="keysy-symbol" aria-hidden="true" />;
}

export function FauxButton({ children, name, primary = false }) {
  return <span className={`ui-button${primary ? ' primary' : ''}`}>{name && <Icon name={name} />}{children}</span>;
}
