import React, { useState } from 'react';

export function LastContact({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // Simple check for excessive length
  const isTooLong = text.length > 150;

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(!expanded);
      }} 
      className="cursor-pointer group"
    >
      <p className="mt-4 text-[11px] text-subtitle-grey font-medium italic leading-relaxed transition-all duration-200">
        <span className="font-bold">Last Contact:</span> {expanded ? text : (isTooLong ? `${text.substring(0, 150)}...` : text)}
        {isTooLong && (
          <span className="text-primary font-bold ml-1 hover:underline">
            {expanded ? "(Read less)" : "(Read more)"}
          </span>
        )}
      </p>
    </div>
  );
}
