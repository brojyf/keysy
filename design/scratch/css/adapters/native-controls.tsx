import type { Controls } from '../Workspace';
import '../styles/native.css';

export const nativeControls: Controls = {
  Button: ({ secondary, type = 'button', ...props }) => <button type={type} className={`native-button ${secondary ? 'native-secondary' : ''}`} {...props} />,
  Input: props => <input className="native-input" {...props} />,
  Badge: ({ children, status }) => <span className={`native-badge ${status ? 'demo-status-badge' : ''}`}>{children}</span>,
};
