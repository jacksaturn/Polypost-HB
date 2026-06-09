import { useMemo, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

import { searchEmojis } from '../lib/emojiData';

interface EmojiPickerProps {
  disabled?: boolean;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ disabled, onSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchEmojis(query), [query]);

  function toggleMenu() {
    setIsOpen((nextIsOpen) => {
      const opening = !nextIsOpen;

      if (opening) {
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }

      return opening;
    });
  }

  function selectEmoji(emoji: string) {
    onSelect(emoji);
    setQuery('');
    setIsOpen(false);
  }

  return (
    <div className="emoji-menu">
      <button
        type="button"
        className="tool-button emoji-menu-button"
        aria-label="Insert emoji"
        aria-haspopup="dialog"
        disabled={disabled}
        title="Insert emoji"
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggleMenu}
      >
        <Smile aria-hidden="true" size={17} strokeWidth={2.1} />
      </button>
      {isOpen ? (
        <div className="emoji-menu-popover" role="dialog" aria-label="Choose emoji">
          <input
            ref={searchInputRef}
            className="emoji-search"
            type="search"
            value={query}
            placeholder="Search emojis"
            aria-label="Search emojis"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsOpen(false);
              }
            }}
          />
          <div className="emoji-results" role="listbox" aria-label={`${results.length} emoji results`}>
            {results.length ? (
              results.map((option) => (
                <button
                  key={`${option.emoji}-${option.name}`}
                  type="button"
                  className="emoji-button"
                  aria-label={`Insert ${option.emoji} ${option.name}`}
                  role="option"
                  title={option.name}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectEmoji(option.emoji)}
                >
                  {option.emoji}
                </button>
              ))
            ) : (
              <p className="emoji-empty">No matches</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
