import React from 'react';

interface Props {
  value?: string | null;
  alt: string;
  className?: string;
}

const isImageSource = (value: string) => /^(https?:\/\/|data:image\/|blob:|\/)/i.test(value);

export const UserProvidedVisual: React.FC<Props> = ({ value, alt, className = '' }) => {
  if (!value?.trim()) return null;

  if (isImageSource(value)) {
    return (
      <img
        src={value}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span className={className} role="img" aria-label={alt}>
      {value}
    </span>
  );
};
