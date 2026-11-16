import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Bookmark, Clock, Sparkles } from 'lucide-react';
import { TOPICS, WRITING_STYLES, type Story, type WritingStyle } from '../types/news';

interface StoryCardProps {
  story: Story;
  writingStyle: WritingStyle;
  isSaved: boolean;
  featured?: boolean;
  onOpen: (storyId: string) => void;
  onToggleSave: (storyId: string) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({
  story,
  writingStyle,
  isSaved,
  featured = false,
  onOpen,
  onToggleSave,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [story.id, story.imageUrl]);

  const hasImage = Boolean(story.imageUrl && !imageFailed);
  const topicMeta = TOPICS.find((t) => t.id === story.topic);
  const voiceLabel = WRITING_STYLES.find((v) => v.id === writingStyle)?.label || 'Brief';
  const summary = story.summaryByStyle[writingStyle] || story.summaryByStyle.brief;
  const accentColor = topicMeta?.colorToken || 'var(--pi-accent)';
  const isVoiceRewritten = Boolean(
    story.rewrittenVoices?.includes(writingStyle) || story.aiGenerated,
  );

  return (
    <article
      className={`group rounded-[20px] sm:rounded-[24px] border border-[var(--pi-hairline)] bg-[var(--pi-surface)] transition-all duration-200 hover:border-[var(--pi-hairline-strong)] hover:-translate-y-0.5 ${
        featured ? 'p-4 sm:p-7' : 'p-4 sm:p-6 flex flex-col justify-between'
      }`}
      style={{ boxShadow: 'var(--pi-shadow-soft)' }}
    >
      <div className={featured && hasImage ? 'grid gap-6 md:grid-cols-12 md:items-center' : 'space-y-4'}>
        {hasImage && story.imageUrl && (
          <button
            type="button"
            onClick={() => onOpen(story.id)}
            className={`block w-full overflow-hidden rounded-[16px] border border-[var(--pi-hairline)] text-left cursor-pointer ${
              featured ? 'md:col-span-6 aspect-[16/10]' : 'aspect-[16/9]'
            }`}
          >
            <img
              src={story.imageUrl}
              alt={story.imageAlt || story.headline}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              loading="lazy"
            />
          </button>
        )}

        <div className={featured && hasImage ? 'md:col-span-6 space-y-3.5' : 'space-y-3'}>
          {/* Topic accent + AI summary indicator */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
              />
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.1em] truncate"
                style={{ color: accentColor }}
              >
                {story.topic}
              </span>
              <span className="text-xs opacity-35" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-medium text-[var(--pi-text-muted)] truncate">
                {story.source}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(story.id);
              }}
              aria-label={isSaved ? 'Remove story from Saved' : 'Save story for later'}
              aria-pressed={isSaved}
              className="pi-focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[var(--pi-surface-muted)] transition-colors cursor-pointer"
            >
              <Bookmark
                className={`h-4 w-4 ${
                  isSaved ? 'fill-[var(--pi-accent)] text-[var(--pi-accent)]' : 'text-[var(--pi-text-muted)]'
                }`}
              />
            </button>
          </div>

          {/* Headline */}
          <button
            type="button"
            onClick={() => onOpen(story.id)}
            className="block w-full text-left cursor-pointer focus:outline-none"
          >
            <h2
              className={`font-headline font-semibold tracking-tight text-[var(--pi-text)] group-hover:text-[var(--pi-accent)] transition-colors ${
                featured ? 'text-2xl sm:text-3xl leading-[1.15]' : 'text-xl sm:text-[22px] leading-[1.2]'
              }`}
            >
              {story.headline}
            </h2>
          </button>

          {/* Voice-Rewritten Excerpt */}
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pi-surface-muted)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--pi-text-muted)]">
              <Sparkles className="h-2.5 w-2.5 text-[var(--pi-accent)]" />
              {isVoiceRewritten ? `AI · ${voiceLabel} Voice` : `${voiceLabel} Edition`}
            </span>
            <p className="font-reading-serif text-[15px] leading-[1.6] text-[var(--pi-text)]/88 line-clamp-3">
              {summary}
            </p>
          </div>

          {/* Calm Footer Meta & Links */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--pi-hairline)] text-xs text-[var(--pi-text-muted)]">
            <div className="flex items-center gap-3 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {story.readMinutes} min read
              </span>
              <span>{story.publishedAt}</span>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={story.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 font-medium hover:text-[var(--pi-accent)] transition-colors"
              >
                Source
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onOpen(story.id)}
                className="font-semibold text-[var(--pi-accent)] hover:underline cursor-pointer"
              >
                Read briefing
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
