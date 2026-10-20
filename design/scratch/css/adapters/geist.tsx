import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import Workspace from '../Workspace';
import { nativeControls } from './native-controls';

export default function GeistReferenceDemo() {
  return <Workspace controls={nativeControls} />;
}
