import React from 'react';
import Button from './button';

export default {
  title: 'UI/Button',
  component: Button,
};

export const Primary = () => <Button variant="primary">Primary</Button>;
export const Secondary = () => <Button variant="secondary">Secondary</Button>;
