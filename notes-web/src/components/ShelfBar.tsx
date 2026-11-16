import React from 'react';

export interface ShelfBarProps {
  children?: React.ReactNode;
  emptyText?: string;
  className?: string;
}

export const ShelfBar: React.FC<ShelfBarProps> = ({
  children,
  emptyText,
  className = '',
}) => {
  const hasChildren = React.Children.count(children) > 0;

  return (
    <section className={`relative ${className}`}>
      {/* Horizontally scrolling notebooks matching Paper & Ink Reader shelf */}
      {hasChildren ? (
        <div className="pi-shelf-scroll relative z-0 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pt-2 pb-1 sm:gap-6 sm:px-6">
          {children}
        </div>
      ) : (
        <div className="relative z-0 flex h-[212px] items-center justify-center px-6 sm:h-[242px]">
          <p className="text-sm text-[var(--text-secondary)]">
            {emptyText || 'No notebooks on this shelf yet.'}
          </p>
        </div>
      )}

      {/* Translucent Note-app green acrylic shelf bar overlapping lower third of covers */}
      <div
        aria-hidden="true"
        className="pi-notes-acrylic-shelf pointer-events-none absolute right-0 bottom-2 left-0 z-10 h-[58px] rounded-[14px] sm:h-[66px]"
      >
        {/* Left slotted screw dot */}
        <span className="pi-notes-screw-dot absolute top-1/2 left-3.5 flex h-2.5 w-2.5 -translate-y-1/2 items-center justify-center rounded-full">
          <span className="h-[1px] w-1.5 rotate-45 bg-black/35" />
        </span>

        {/* Right slotted screw dot */}
        <span className="pi-notes-screw-dot absolute top-1/2 right-3.5 flex h-2.5 w-2.5 -translate-y-1/2 items-center justify-center rounded-full">
          <span className="h-[1px] w-1.5 -rotate-12 bg-black/35" />
        </span>
      </div>
    </section>
  );
};
