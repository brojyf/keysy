import { Button } from '../vendor/shadcn/button';
import { Input } from '../vendor/shadcn/input';
import { Badge } from '../vendor/shadcn/badge';
import '../styles/shadcn.css';
import Workspace, { type Controls } from '../Workspace';

const controls: Controls = {
  Button: ({ secondary, ...props }) => <Button variant={secondary ? 'outline' : 'default'} {...props} />,
  Input,
  Badge: ({ children, status }) => <Badge variant="secondary" className={status ? 'demo-status-badge' : ''}>{children}</Badge>,
};

export default function ShadcnDemo() {
  return <Workspace controls={controls} />;
}
