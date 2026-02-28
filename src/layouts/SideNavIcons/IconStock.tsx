import * as React from 'react';
import { GiBull } from 'react-icons/gi';

function IconStock(props: React.SVGProps<SVGSVGElement>) {
  return <GiBull {...(props as any)} />;
}

export default IconStock;
