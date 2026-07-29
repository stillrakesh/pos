import React, { useState, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { vibrateDevice, playReadySound } from '../utils/sounds';

interface SwipeItemProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  disabled?: boolean;
}

export const SwipeItem: React.FC<SwipeItemProps> = ({
  children,
  onSwipeRight,
  disabled = false
}) => {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swiped, setSwiped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || swiped) return;
    e.stopPropagation(); // Stop propagation so parent SwipeCard doesn't hear this touch
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || disabled || swiped) return;
    e.stopPropagation();
    const deltaX = e.touches[0].clientX - startX;
    if (deltaX > 0) {
      setCurrentX(Math.min(deltaX, containerRef.current?.offsetWidth || 300));
    } else {
      setCurrentX(0);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping || disabled || swiped) return;
    e.stopPropagation();
    setIsSwiping(false);
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const threshold = containerWidth * 0.35;

    if (currentX > threshold) {
      setSwiped(true);
      setCurrentX(containerWidth);
      vibrateDevice(30);
      playReadySound();
      setTimeout(() => onSwipeRight(), 200);
    } else {
      setCurrentX(0);
    }
  };

  // Mouse support for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || swiped) return;
    e.stopPropagation();
    setStartX(e.clientX);
    setIsSwiping(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSwiping || disabled || swiped) return;
    e.stopPropagation();
    const deltaX = e.clientX - startX;
    if (deltaX > 0) {
      setCurrentX(Math.min(deltaX, containerRef.current?.offsetWidth || 300));
    } else {
      setCurrentX(0);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isSwiping || disabled || swiped) return;
    e.stopPropagation();
    setIsSwiping(false);
    const containerWidth = containerRef.current?.offsetWidth || 300;
    const threshold = containerWidth * 0.35;
    if (currentX > threshold) {
      setSwiped(true);
      setCurrentX(containerWidth);
      vibrateDevice(30);
      playReadySound();
      setTimeout(() => onSwipeRight(), 200);
    } else {
      setCurrentX(0);
    }
  };

  const containerWidth = containerRef.current?.offsetWidth || 300;
  const swipePercent = Math.min(currentX / containerWidth, 1);
  const revealOpacity = Math.min(swipePercent * 2, 1);

  return (
    <div
      ref={containerRef}
      className="swipe-item-container"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        background: 'linear-gradient(90deg, #16a34a, #22c55e)',
        width: '100%',
        touchAction: 'pan-y',
      }}
    >
      {/* Green reveal background */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(90deg, #16a34a, #22c55e)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '18px',
          gap: '8px',
          opacity: revealOpacity,
          transition: isSwiping ? 'none' : 'opacity 0.2s ease',
          pointerEvents: 'none',
        }}
      >
        <CheckCircle2 size={20} color="#fff" style={{
          transform: `scale(${0.5 + swipePercent * 0.5})`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
        }} />
        <span style={{
          color: '#fff',
          fontSize: '13px',
          fontWeight: '600',
          letterSpacing: '1.5px',
          textTransform: 'uppercase' as const,
        }}>ITEM READY ✓</span>
      </div>

      {/* Foreground content */}
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
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.15)',
          background: '#fff',
          width: '100%',
          position: 'relative',
          zIndex: 2,
          cursor: disabled ? 'default' : 'grab',
          userSelect: 'none',
          borderRadius: '16px',
        }}
      >
        {children}
      </div>
    </div>
  );
};
