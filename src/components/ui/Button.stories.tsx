import Button from './button';

const meta = {
  title: 'UI/Button',
  component: Button,
};

export default meta;

export const Primary = () => <Button variant='primary'>Primary</Button>;
export const Secondary = () => <Button variant='secondary'>Secondary</Button>;
