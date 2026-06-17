import React from 'react';
import '../src/styles/globals.css';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
};

export const decorators = [Story => <div className="p-4 bg-slate-50 dark:bg-slate-900"><Story/></div>];
