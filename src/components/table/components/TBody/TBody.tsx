import React from 'react';

import TBodyTD from './TBodyTD';
import TBodyTR from './TBodyTR';

type CommonComponents = {
  TD: typeof TBodyTD;
  TR: typeof TBodyTR;
};

const TBody: React.FC<{ children?: React.ReactNode }> & CommonComponents = ({
  children,
}) => <tbody className='bg-white divide-y divide-gray-200'>{children}</tbody>;

TBody.TD = TBodyTD;
TBody.TR = TBodyTR;

export default TBody;
