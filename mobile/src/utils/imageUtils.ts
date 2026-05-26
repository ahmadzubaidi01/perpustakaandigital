import { API_BASE_URL } from '../constants/theme';

/**
 * Resolves a cover_image_url from the database into a full HTTPS URL.
 * 
 * Backend stores images as relative paths like `/uploads/filename.jpg`.
 * This function builds the full URL using the production API base.
 * 
 * @param coverImageUrl - The cover_image_url from the API response (can be relative or absolute)
 * @returns The full URL string, or null if no valid image URL
 */
export function resolveImageUrl(coverImageUrl: string | null | undefined): string | null {
  if (!coverImageUrl) return null;

  // Already a full URL — return as-is
  if (coverImageUrl.startsWith('http://') || coverImageUrl.startsWith('https://')) {
    return coverImageUrl;
  }

  // Already a local file URI — return as-is
  if (coverImageUrl.startsWith('file://')) {
    return coverImageUrl;
  }

  // Relative path from backend (e.g., /uploads/image.jpg)
  // API_BASE_URL = 'https://api.perpustakaanahmad.my.id/api'
  // We need:     'https://api.perpustakaanahmad.my.id/uploads/image.jpg'
  const baseOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${baseOrigin}${coverImageUrl}`;
}
