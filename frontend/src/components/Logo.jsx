import React from 'react';

const Logo = ({ variant = 'gold', size = 'md', className = '' }) => {
  const sizes = {
    sm: { icon: 32, text: 16, tagline: 8 },
    md: { icon: 40, text: 24, tagline: 10 },
    lg: { icon: 48, text: 32, tagline: 12 },
    xl: { icon: 60, text: 40, tagline: 14 },
  };

  const colors = {
    gold: {
      icon: '#C7AE6A',
      text: '#C7AE6A',
      tagline: '#C7AE6A',
    },
    black: {
      icon: '#0D0D0D',
      text: '#0D0D0D',
      tagline: '#0D0D0D',
    },
    white: {
      icon: '#FFFFFF',
      text: '#FFFFFF',
      tagline: '#FFFFFF',
    },
  };

  const currentSize = sizes[size];
  const currentColor = colors[variant];

  return (
    <div className={`flex items-center ${className}`}>
      {/* Clock Icon */}
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke={currentColor.icon}
          strokeWidth="3"
          fill="none"
        />
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="25"
          stroke={currentColor.icon}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="50"
          x2="70"
          y2="50"
          stroke={currentColor.icon}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      {/* Text */}
      <div className="ml-3">
        <div
          className="font-heading leading-none"
          style={{
            fontSize: `${currentSize.text}px`,
            color: currentColor.text,
          }}
        >
          Faysha
        </div>
        <div
          className="font-sans uppercase tracking-wider leading-tight"
          style={{
            fontSize: `${currentSize.tagline}px`,
            color: currentColor.tagline,
            letterSpacing: '0.15em',
          }}
        >
          Property by Result
        </div>
      </div>
    </div>
  );
};

export default Logo;
