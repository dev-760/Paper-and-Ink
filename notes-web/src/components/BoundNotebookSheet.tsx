import React from 'react';
import { COVER_PALETTE, type CoverColor } from '../types/notebook';

export interface BoundNotebookSheetProps {
  coverColor: CoverColor;
  pageKey?: string;
  children: React.ReactNode;
}

/**
 * Physical hardcover notebook wrapper: displays the colored hardcover spine edge,
 * stitched binding crease, notched ribbon bookmark, layered paper stack, and
 * full-sheet ruled margins so pages feel like an open physical notebook.
 */
export const BoundNotebookSheet: React.FC<BoundNotebookSheetProps> = ({
  coverColor,
  pageKey,
  children,
}) => {
  const palette = COVER_PALETTE[coverColor];

  return (
    <div
      className="relative rounded-l-[12px] rounded-r-[20px] p-[4px_6px_6px_12px] sm:p-[6px_8px_8px_18px] shadow-[var(--cover-shadow)] transition-colors"
      style={{ backgroundColor: palette.spineVar }}
    >
      {/* Left hardcover cloth binding hinge + subtle stitching dots */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-3 sm:w-[18px] rounded-l-[12px]"
        style={{
          background: `linear-gradient(90deg, rgba(0,0,0,0.22) 0%, ${palette.bgVar} 55%, rgba(0,0,0,0.28) 100%)`,
        }}
      >
        <div
          className="h-full w-full opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 10px, rgba(255,255,255,0.65) 10px, rgba(255,255,255,0.65) 14px, transparent 14px, transparent 24px)',
            backgroundSize: '1.5px 24px',
            backgroundPosition: 'center',
            backgroundRepeat: 'repeat-y',
          }}
        />
      </div>

      {/* Physical cream paper leaf with ruled lines & margin rule */}
      <article
        key={pageKey}
        className="pi-page-turn pi-paper-grain pi-notebook-leaf relative bg-[var(--bg-paper)] rounded-l-[4px] rounded-r-[14px] border border-[var(--border-hairline)] overflow-visible"
      >
        {/* Top-right satin cloth bookmark ribbon */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-1.5 right-6 sm:right-10 z-20 w-4 h-9 shadow-sm"
          style={{
            backgroundColor: 'var(--accent-primary)',
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)',
          }}
        />

        {/* Continuous vertical margin line running top-to-bottom on the sheet */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-9 sm:left-14 w-px bg-[var(--paper-margin-line)] z-10"
        />

        {/* Ruled horizontal lines starting cleanly under the top journal header */}
        <div className="pi-paper-lined rounded-r-[14px] pt-5 pb-6 pl-12 pr-4 sm:pt-7 sm:pb-7 sm:pl-20 sm:pr-10">
          {children}
        </div>
      </article>
    </div>
  );
};
