/**
 * URL utility helpers for consistent image and media URL handling
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:8000"

/**
 * Convert a relative media URL to an absolute URL
 * Ensures images display correctly regardless of frontend origin
 * 
 * @param {string} url - Relative URL like "/media/2026/10/15/image.jpg" or absolute URL
 * @returns {string} Absolute URL like "http://localhost:8000/media/2026/10/15/image.jpg"
 */
export function getAbsoluteMediaUrl(url) {
  if (!url) return null
  
  // Already absolute (starts with http), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // Relative path, prepend API base URL (without /api suffix)
  if (url.startsWith('/')) {
    return `${API_BASE_URL}${url}`
  }
  
  // Fallback: assume it's a relative path
  return `${API_BASE_URL}/${url}`
}

/**
 * Fallback handler for broken image URLs
 * Attempts to repair relative URLs or provide fallback
 * 
 * @param {Event} event - onError event from img element
 */
export function handleImageError(event) {
  const img = event.target
  const src = img.getAttribute('src')
  
  // If it's a relative URL and we haven't already tried fixing it
  if (src && src.startsWith('/') && !src.includes(API_BASE_URL)) {
    img.src = getAbsoluteMediaUrl(src)
  }
}

export default {
  getAbsoluteMediaUrl,
  handleImageError,
}
