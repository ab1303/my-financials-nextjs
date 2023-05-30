'use client';

import ReactDOM from 'react-dom';

export function PreloadResources() {
  ReactDOM.preload('/fonts/inter-var-latin.woff2', {
    as: 'font',
    crossOrigin: 'anonymous',
  });

  return null;
}
