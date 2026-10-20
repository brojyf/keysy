import { Badge, Button, TextField, Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import Workspace, { type Controls, type DemoProps } from '../Workspace';
import { themeVariables } from '../theme';

const controls: Controls = {
  Button: ({ secondary, ...props }) => <Button variant={secondary ? 'outline' : 'solid'} {...props} />,
  Input: props => <TextField.Root {...props} />,
  Badge: ({ children, status }) => <Badge color={status ? 'green' : 'gray'} variant="soft">{children}</Badge>,
};

export default function RadixThemesDemo({ selection, colors }: DemoProps) {
  return <Theme appearance={selection.mode} accentColor="indigo" grayColor="gray" radius="medium" style={themeVariables(colors, selection.library, selection.mode, selection.palette)}>
    <Workspace controls={controls} />
  </Theme>;
}
