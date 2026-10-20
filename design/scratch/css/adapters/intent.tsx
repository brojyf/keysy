import { TextField } from 'react-aria-components/TextField';
import { Button } from '../vendor/intent/button';
import { Input } from '../vendor/intent/input';
import { Badge } from '../vendor/intent/badge';
import '../styles/intent.css';
import Workspace, { type Controls } from '../Workspace';

const controls: Controls = {
  Button: ({ secondary, onClick, ...props }) => <Button intent={secondary ? 'outline' : 'primary'} onPress={onClick} {...props} />,
  Input: props => <TextField id={props.id} aria-label={props['aria-label']} aria-labelledby={props['aria-label'] ? undefined : `${props.id}-label`} isRequired={props.required} className="demo-aria-field"><Input {...props} /></TextField>,
  Badge: ({ children, status }) => <Badge intent={status ? 'success' : 'secondary'}>{children}</Badge>,
};

export default function IntentDemo() {
  return <Workspace controls={controls} />;
}
