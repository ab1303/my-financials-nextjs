import React from 'react';

import CardHeaderText from './CardHeaderText';
import CardHeaderTitle from './CardHeaderTitle';

type CommonComponents = {
  Text: typeof CardHeaderText;
  Title: typeof CardHeaderTitle;
};

const CardHeader: React.FC<{ children?: React.ReactNode }> & CommonComponents = (props) => (
  <div className='py-4 px-4' {...props}></div>
);

CardHeader.Text = CardHeaderText;
CardHeader.Title = CardHeaderTitle;

export default CardHeader;
