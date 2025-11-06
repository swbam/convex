import React, { useMemo } from 'react';

type MarqueeRowsProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  rows?: number;
  baseDurationSec?: number; // duration for middle row; others vary slightly
  className?: string;
};

export function MarqueeRows<T>({
  items,
  renderItem,
  rows = 3,
  baseDurationSec = 60,
  className,
}: MarqueeRowsProps<T>) {
  const splitRows = useMemo(() => {
    const result: T[][] = Array.from({ length: rows }, () => []);
    items.forEach((item, idx) => {
      result[idx % rows].push(item);
    });
    return result;
  }, [items, rows]);

  return (
    <div className={`marquee marquee-fade ${className ?? ''}`}>
      <div className="space-y-4">
        {splitRows.map((rowItems, rowIdx) => {
          // Vary duration per row (slower/faster) and alternate direction
          const duration = baseDurationSec + (rowIdx - Math.floor(rows / 2)) * 8;
          const reverse = rowIdx % 2 === 1; // alternate directions
          // Duplicate items for seamless loop
          const loopItems = [...rowItems, ...rowItems];
          return (
            <div key={rowIdx} className={`marquee-row ${reverse ? 'reverse' : ''}`} style={{ ['--marquee-duration' as any]: `${duration}s` }}>
              <div className="marquee-track">
                {loopItems.map((item, idx) => (
                  <div key={idx} className="flex-shrink-0">
                    {renderItem(item, idx % rowItems.length)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MarqueeRows;

