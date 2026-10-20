import { Button } from '../vendor/coss/button';
import { Input } from '../vendor/coss/input';
import { Badge } from '../vendor/coss/badge';
import '../styles/tailwind.css';
import Workspace, { type Controls } from '../Workspace';

const controls: Controls = {
  Button: ({ secondary, ...props }) => <Button variant={secondary ? 'outline' : 'default'} {...props} />,
  Input,
  Badge: ({ children, status }) => <Badge variant={status ? 'success' : 'secondary'}>{children}</Badge>,
};

export default function CossDemo() {
  return <Workspace controls={controls} />;
}
