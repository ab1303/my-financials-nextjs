import React from 'react';
import Panel from './panel';

export default {
  title: 'UI/Panel',
  component: Panel,
};

export const Default = () => (
  <Panel title="Wireframe Panel">
    <p className="text-sm text-slate-600">This is a simple panel for wireframing layouts.</p>
  </Panel>
);
