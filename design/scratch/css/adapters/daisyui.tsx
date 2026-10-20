import '../styles/daisyui.css';
import Workspace, { type Controls } from '../Workspace';

const controls: Controls = {
  Button: ({ secondary, type = 'button', ...props }) => <button type={type} className={`btn btn-sm ${secondary ? 'btn-outline' : 'btn-primary'}`} {...props} />,
  Input: props => <input className="input input-sm w-full" {...props} />,
  Badge: ({ children, status }) => <span className={`badge badge-sm ${status ? 'badge-success badge-soft demo-status-badge' : 'badge-ghost'}`}>{children}</span>,
};

export default function DaisyDemo() {
  return <Workspace controls={controls} tableClassName="table table-sm" />;
}
