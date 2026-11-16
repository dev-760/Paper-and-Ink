import React from 'react';

export interface HeadlineProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3';
  size?: 'featured' | 'standard';
  className?: string;
}

/**
 * @paper-and-ink/design-system primitive
 * Editorial Zilla Slab headline with signature Paper & Ink underline
 * applied intentionally to the final word only.
 */
export const Headline: React.FC<HeadlineProps> = ({
  text,
  as: Tag = 'h2',
  size = 'standard',
  className = '',
}) => {
  const trimmed = text.trim();
  const lastSpaceIndex = trimmed.lastIndexOf(' ');

  const leading = lastSpaceIndex > 0 ? trimmed.slice(0, lastSpaceIndex + 1) : '';
  const lastWord =
    lastSpaceIndex > 0 ? trimmed.slice(lastSpaceIndex + 1) : trimmed;

  const sizeClass =
    size === 'featured' ? 'pi-headline--featured' : 'pi-headline--standard';

  return (
    <Tag className={`pi-headline ${sizeClass} ${className}`.trim()}>
      {leading}
      <span className="pi-headline-last-word">{lastWord}</span>
    </Tag>
  );
};
