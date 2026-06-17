import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(tsx|mdx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
  },
  docs: {
    autodocs: true,
  },
};

export default config;
