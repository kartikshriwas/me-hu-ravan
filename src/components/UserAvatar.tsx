'use client';

import React, { useState, useEffect } from 'react';

interface UserAvatarProps {
  name?: string;
  email?: string;
  image?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isPremium?: boolean;
}

// In-memory cache to store canvas detection results so image check runs only once per avatar URL
const avatarDetectionCache = new Map<string, boolean>();

export function UserAvatar({
  name = 'User',
  email = '',
  image,
  size = 'md',
  className = '',
  isPremium = false,
}: UserAvatarProps) {
  const [isDefaultLetter, setIsDefaultLetter] = useState<boolean>(() => {
    if (!image || image.trim().length === 0) return true;
    return avatarDetectionCache.get(image) ?? false;
  });
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!image || image.trim().length === 0 || avatarDetectionCache.has(image)) {
      if (image && avatarDetectionCache.has(image)) {
        setIsDefaultLetter(avatarDetectionCache.get(image) || false);
      }
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = image;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);

        const data = ctx.getImageData(0, 0, 32, 32).data;
        const counts: Record<string, number> = {};
        let total = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 50) continue; // Skip transparent pixels

          // Quantize color into buckets to group subtle color variations
          const r = Math.floor(data[i] / 16);
          const g = Math.floor(data[i + 1] / 16);
          const b = Math.floor(data[i + 2] / 16);
          const key = `${r},${g},${b}`;

          counts[key] = (counts[key] || 0) + 1;
          total++;
        }

        let maxCount = 0;
        for (const k in counts) {
          if (counts[k] > maxCount) {
            maxCount = counts[k];
          }
        }

        // Google default initial letter avatars consist of a flat, solid background color taking >= 50% of total pixels
        const isLetterAvatar = total > 0 && maxCount / total >= 0.50;
        avatarDetectionCache.set(image, isLetterAvatar);

        if (isMounted && isLetterAvatar) {
          setIsDefaultLetter(true);
        }
      } catch {
        // If canvas is tainted or errors out, treat as real image
        avatarDetectionCache.set(image, false);
      }
    };

    img.onerror = () => {
      avatarDetectionCache.set(image, false);
    };

    return () => {
      isMounted = false;
    };
  }, [image]);

  const sizeClasses = {
    xs: 'w-6 h-6 rounded-lg',
    sm: 'w-7 h-7 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-16 h-16 rounded-2xl',
    xl: 'w-20 h-20 rounded-2xl',
  }[size];

  const seed = email || name || 'PrepTeaCandidate';
  const dicebearBottts = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
  
  const showDicebear = isDefaultLetter || imgError || !image || image.trim().length === 0;
  const finalSrc = showDicebear ? dicebearBottts : image;

  const borderStyle = isPremium
    ? 'border-2 border-primary-500 dark:border-primary-400 ring-2 ring-primary-500/30 dark:ring-primary-400/30 shadow-md shadow-primary-500/20 transition-all duration-300'
    : 'border border-card-border';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={finalSrc}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`${sizeClasses} aspect-square object-cover shrink-0 bg-slate-800 transition-all ${borderStyle} ${className}`}
    />
  );
}
