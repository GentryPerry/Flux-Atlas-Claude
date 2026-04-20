/**
 * Pre-renders Phosphor icons to HTMLImageElement for use in Konva canvas.
 * Uses renderToStaticMarkup to produce SVG data URLs, then caches Image objects.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { resolveIcon } from './iconRegistry';

const imageCache = new Map();

function createSvgDataUrl(iconName, color, size) {
  try {
    const IconComponent = resolveIcon(iconName);
    const svgStr = renderToStaticMarkup(
      createElement(IconComponent, { size, weight: 'fill', color })
    );
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  } catch {
    return null;
  }
}

/**
 * Returns an HTMLImageElement for the given icon, color, and size.
 * The image may not be loaded yet on first call — subscribe to onload if needed.
 * Subsequent calls with the same key return the cached (possibly already loaded) image.
 */
export function getIconImage(iconName, color = '#ffffff', size = 16) {
  const key = `${iconName}|${color}|${size}`;
  if (imageCache.has(key)) return imageCache.get(key);

  const dataUrl = createSvgDataUrl(iconName, color, size);
  if (!dataUrl) {
    imageCache.set(key, null);
    return null;
  }

  const img = new window.Image(size, size);
  img.src = dataUrl;
  imageCache.set(key, img);
  return img;
}

/**
 * Preload icon images for a list of icon names. Returns a Promise that
 * resolves once all images have loaded (or errored).
 */
export function preloadIcons(iconNames, color = '#ffffff', size = 16) {
  const unique = [...new Set(iconNames)];
  const images = unique.map(n => getIconImage(n, color, size)).filter(Boolean);
  const unloaded = images.filter(img => !img.complete);

  if (!unloaded.length) return Promise.resolve();

  return Promise.all(
    unloaded.map(
      img =>
        new Promise(resolve => {
          img.addEventListener('load',  resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        })
    )
  );
}
