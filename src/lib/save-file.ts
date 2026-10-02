/**
 * Hands a file made in this tab to the browser's own download.
 *
 * One definition for the public pages that make files on the click — the
 * template gallery and the example resumes — so the detail below is decided
 * once.
 */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
