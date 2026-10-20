import '../styles/basecoat.css';
import Workspace, { type Controls } from '../Workspace';

const controls: Controls = {
  Button: ({ secondary, type = 'button', ...props }) => <button type={type} className="btn" data-variant={secondary ? 'outline' : 'primary'} {...props} />,
  Input: props => <input className="input" {...props} />,
  Badge: ({ children, status }) => <span className={`badge ${status ? 'demo-status-badge' : ''}`} data-variant="secondary">{children}</span>,
};

export default function BasecoatDemo() {
  return <Workspace controls={controls} tableClassName="table" />;
}
