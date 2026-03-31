import React from 'react';

import TFootTH from './TFootTH';
import TFootTR from './TFootTR';

type CommonComponents = {
  TH: typeof TFootTH;
  TR: typeof TFootTR;
};

const TFoot: React.FC<{ children?: React.ReactNode }> & CommonComponents = ({
  children,
}) => <tfoot className='bg-muted/50'>{children}</tfoot>;

TFoot.TH = TFootTH;
TFoot.TR = TFootTR;

export default TFoot;
