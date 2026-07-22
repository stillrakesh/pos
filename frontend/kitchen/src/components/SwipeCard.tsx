import React, { useState, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { vibrateDevice, playReadySound } from '../utils/sounds';

interface SwipeCardProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  swipeText?: string;
  swipeColor?: string;
  disabled?: boolean;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  children,
  onSwipeRight,
  swipeText = 'MARK ALL READY',
  swipeColor = '#16a34a',
  disabled = false
}) => {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swiped, setSwiped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isInsideItem = (target: EventTarget | null) => {
    if (!target) return false;
    return !!(target as HTMLElement).closest('.swipe-item-container');
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || swiped) return;
    if (isInsideItem(e.target)) return; // Ignore touch if started on an individual item card
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || disabled || swiped) return;
    const deltaX = e.touches[0].clientX - startX;
    if (deltaX > 0) {
      setCurrentX(Math.min(deltaX, containerRef.current?.offsetWidth || 400));
    } else {
      setCurrentX(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping || disabled || swiped) return;
    setIsSwiping(false);
    const containerWidth = containerRef.current?.offsetWidth || 400;
    const threshold = containerWidth * 0.38; // 38% threshold

    if (currentX > threshold) {
      setSwiped(true);
      setCurrentX(containerWidth);
      vibrateDevice([30, 50, 30]);
      playReadySound();
      setTimeout(() => onSwipeRight(), 250);
    } else {
      setCurrentX(0);
    }
  };

  // Mouse support for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || swiped) return;
    if (isInsideItem(e.target)) return; // Ignore mouse down if started on an item
    setStartX(e.clientX);
    setIsSwiping(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSwiping || disabled || swiped) return;
    const deltaX = e.clientX - startX;
    if (deltaX > 0) {
      setCurrentX(Math.min(deltaX, containerRef.current?.offsetWidth || 400));
    } else {
      setCurrentX(0);
    }
  };

  const handleMouseUp = () => {
    if (!isSwiping || disabled || swiped) return;
    setIsSwiping(false);
    const containerWidth = containerRef.current?.offsetWidth || 400;
    const threshold = containerWidth * 0.38;
    if (currentX > threshold) {
      setSwiped(true);
      setCurrentX(containerWidth);
      vibrateDevice([30, 50, 30]);
      playReadySound();
      setTimeout(() => onSwipeRight(), 250);
    } else {
      setCurrentX(0);
    }
  };

  const containerWidth = containerRef.current?.offsetWidth || 400;
  const swipePercent = Math.min(currentX / containerWidth, 1);
  const revealOpacity = Math.min(swipePercent * 1.8, 1);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        borderRadius: '20px',
        overflow: 'hidden',
        width: '100%',
        touchAction: 'pan-y',
      }}
    >
      {/* Green reveal background */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: `linear-gradient(135deg, ${swipeColor}, ${swipeColor}dd)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: '28px',
          gap: '12px',
          opacity: revealOpacity,
          transition: isSwiping ? 'none' : 'opacity 0.25s ease',
          pointerEvents: 'none',
        }}
      >
        <CheckCircle2
          size={28}
          color="#fff"
          style={{
            transform: `scale(${0.5 + swipePercent * 0.5}) rotate(${swipePercent * 360}deg)`,
            transition: isSwiping ? 'none' : 'transform 0.25s ease',
          }}
        />
        <span style={{
          color: '#fff',
          fontSize: '16px',
          fontWeight: 900,
          letterSpacing: '2px',
          textTransform: 'uppercase' as const,
          transform: `translateX(${Math.max(-10 + swipePercent * 10, 0)}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s ease',
        }}>
          {swipeText}
        </span>
      </div>

      {/* Foreground card content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (isSwiping) { setIsSwiping(false); setCurrentX(0); } }}
        style={{
          transform: `translateX(${currentX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15)',
          background: '#fff',
          width: '100%',
          position: 'relative',
          zIndex: 2,
          cursor: disabled ? 'default' : 'grab',
          userSelect: 'none',
          borderRadius: '20px',
        }}
      >
        {children}
      </div>
    </div>
  );
};
