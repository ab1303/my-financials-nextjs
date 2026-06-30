import Panel from './panel';

const meta = {
  title: 'UI/Panel',
  component: Panel,
};

export default meta;

export const Default = () => (
  <Panel title='Wireframe Panel'>
    <p className='text-sm text-slate-600'>
      This is a simple panel for wireframing layouts.
    </p>
  </Panel>
);
