import type { Page } from '@playwright/test';
import fs from 'fs';

/**
 * Drop a file onto a react-dropzone element.
 *
 * react-dropzone listens for 'drop' events (not 'change' events on the file input).
 * Playwright's `setInputFiles()` only dispatches a `change` event, which react-dropzone
 * ignores. This helper dispatches a real DragEvent with the file data embedded.
 *
 * @param page - Playwright Page
 * @param testId - data-testid of the dropzone element
 * @param filePath - absolute or relative path to the file on disk
 * @param mimeType - MIME type of the file (default: 'text/csv')
 */
export async function dropFileOnZone(
  page: Page,
  testId: string,
  filePath: string,
  mimeType = 'text/csv',
): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');
  const fileName = filePath.split(/[\\/]/).pop() ?? 'file.csv';

  await page.evaluate(
    ({ base64Content, name, type, dropTestId }) => {
      // Decode base64 → Uint8Array
      const binaryStr = atob(base64Content);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const file = new File([bytes], name, { type });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropzone = document.querySelector(`[data-testid="${dropTestId}"]`);
      if (!dropzone) throw new Error(`Dropzone with data-testid="${dropTestId}" not found`);

      // Fire the events react-dropzone expects: dragenter → dragover → drop
      // NOTE: DragEvent constructor doesn't allow setting dataTransfer in Chrome.
      // Use Object.defineProperty to inject the DataTransfer on a plain Event.
      const makeDropEvent = (dt: DataTransfer) => {
        const ev = new Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'dataTransfer', { value: dt, writable: false });
        return ev;
      };

      dropzone.dispatchEvent(new DragEvent('dragenter', { bubbles: true }));
      dropzone.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
      dropzone.dispatchEvent(makeDropEvent(dataTransfer));
    },
    { base64Content: base64, name: fileName, type: mimeType, dropTestId: testId },
  );
}
