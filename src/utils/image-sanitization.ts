/**
 * Image Sanitization Utility
 * Strips EXIF and metadata from images using Canvas API
 * Prevents sensitive metadata (GPS, timestamps, device info) from being uploaded
 */

/**
 * Sanitize an image file by drawing it to canvas and exporting
 * This removes all EXIF and metadata while preserving image data
 *
 * @param file - The image file to sanitize
 * @returns A new File object with metadata stripped
 */
export async function sanitizeImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // Create an Image element to load the file
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Create an off-screen canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Draw the image to canvas (strips all metadata)
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get 2D context from canvas');
        }

        ctx.drawImage(img, 0, 0);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            // Create a new File from the blob
            const sanitizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });

            // Clean up
            URL.revokeObjectURL(url);

            resolve(sanitizedFile);
          },
          file.type,
          0.95, // Quality 95% for lossless-ish JPEG
        );
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    // Load the image from the file
    img.src = url;
  });
}

/**
 * Sanitize multiple image files
 *
 * @param files - Array of files to sanitize
 * @returns Array of sanitized files
 */
export async function sanitizeImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => sanitizeImage(file)));
}
