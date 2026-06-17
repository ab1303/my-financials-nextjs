import React from 'react';
import FiltersPanel from '../ui/filters';
import mockGroups from '../../lib/mockFilterData';

export default {
  title: 'Components/FiltersPanel',
  component: FiltersPanel,
};

export const Default = () => <FiltersPanel initialGroups={mockGroups} />;
