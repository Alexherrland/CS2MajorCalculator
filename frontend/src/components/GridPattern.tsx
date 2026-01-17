import React from 'react';
import backgroundImage from '../assets/blurry-gradient-haikei.svg';

const GridPattern: React.FC = () => (
  <div
    className="absolute inset-0 -z-10 h-full w-full"
    style={{
      backgroundImage: `url(${backgroundImage})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    }}
  >
    <div className="absolute left-0 right-0 top-0 -z-10 h-16 bg-gradient-to-b from-black to-transparent"></div>
  </div>
);

export default GridPattern; 