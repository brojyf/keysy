import '../styles/open-props.css';
import Workspace from '../Workspace';
import { nativeControls } from './native-controls';

export default function OpenPropsDemo() {
  return <Workspace controls={nativeControls} />;
}
