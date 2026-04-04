import React, { useEffect, useRef } from 'react';

interface GameLogProps {
  entries: string[];
}

export default function GameLog({ entries }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [entries]);

  return (
    <div
      ref={containerRef}
      className="bg-spooky-card border border-spooky-purple rounded-xl overflow-y-auto scroll-smooth momentum-scroll"
      style={{ maxHeight: '180px', WebkitOverflowScrolling: 'touch' }}
    >
      <div className="p-3 flex flex-col gap-2">
        {entries.map((entry, i) => (
          <p
            key={i}
            className={`font-game text-sm md:text-base leading-relaxed ${
              i === entries.length - 1
                ? 'text-spooky-text typewriter'
                : 'text-gray-400'
            }`}
          >
            {entry}
          </p>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
