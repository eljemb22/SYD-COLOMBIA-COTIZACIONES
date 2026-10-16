/**
 * cloudLinkUtils.ts
 * Utilities for detecting, formatting and embedding cloud links (Google Drive, Dropbox, OneDrive, Direct URLs)
 * Used when documents are too large for browser storage or stored externally in Google Drive.
 */

export type CloudProviderType = 'google_drive' | 'dropbox' | 'onedrive' | 'direct_link' | 'other';

export interface CloudLinkInfo {
  provider: CloudProviderType;
  providerLabel: string;
  isCloud: boolean;
  isFolder?: boolean;
  fileId?: string;
  folderId?: string;
  previewUrl: string;
  downloadUrl?: string;
  embedUrl?: string;
}

/**
 * Check if a given string represents a valid HTTP(S) URL
 */
export function isHttpUrl(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return s.startsWith('http://') || s.startsWith('https://');
}

/**
 * Check if file data or url is stored as an external cloud link
 */
export function isCloudDocument(doc?: { fileData?: string; dataUrl?: string; fileUrl?: string; isCloudLink?: boolean }): boolean {
  if (!doc) return false;
  if (doc.isCloudLink) return true;
  if (isHttpUrl(doc.fileUrl)) return true;
  if (isHttpUrl(doc.fileData)) return true;
  if (isHttpUrl(doc.dataUrl)) return true;
  return false;
}

/**
 * Extracts a Google Drive File or Folder ID:
 * - https://drive.google.com/drive/folders/1A2B3C... (folder)
 * - https://drive.google.com/file/d/1A2B3C.../view (file)
 * - https://drive.google.com/open?id=1A2B3C...
 * - https://docs.google.com/document/d/1A2B3C.../edit
 * - https://docs.google.com/spreadsheets/d/1A2B3C.../edit
 */
export function extractGoogleDriveInfo(url: string): { id: string; isFolder: boolean } | null {
  if (!url) return null;

  // Folder URL format
  const matchFolder = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (matchFolder && matchFolder[1]) return { id: matchFolder[1], isFolder: true };

  // File URL formats
  const matchFile = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile && matchFile[1]) return { id: matchFile[1], isFolder: false };

  const matchParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchParam && matchParam[1]) return { id: matchParam[1], isFolder: false };

  return null;
}

export function extractGoogleDriveId(url: string): string | null {
  const info = extractGoogleDriveInfo(url);
  return info ? info.id : null;
}

/**
 * Parse any cloud link and return provider info, preview and download URLs
 */
export function analyzeCloudUrl(rawUrl: string): CloudLinkInfo {
  const url = (rawUrl || '').trim();

  if (!isHttpUrl(url)) {
    return {
      provider: 'other',
      providerLabel: 'Local / Archivo Interno',
      isCloud: false,
      previewUrl: url,
    };
  }

  // 1. Google Drive / Docs / Sheets / Folders
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const driveInfo = extractGoogleDriveInfo(url);
    const isFolder = Boolean(driveInfo?.isFolder);
    const id = driveInfo?.id;

    if (isFolder && id) {
      return {
        provider: 'google_drive',
        providerLabel: 'Carpeta en Google Drive',
        isCloud: true,
        isFolder: true,
        folderId: id,
        fileId: id,
        previewUrl: `https://drive.google.com/drive/folders/${id}`,
        downloadUrl: `https://drive.google.com/drive/folders/${id}`,
        embedUrl: `https://drive.google.com/drive/folders/${id}`,
      };
    }

    const embedUrl = id ? `https://drive.google.com/file/d/${id}/preview` : url;
    const downloadUrl = id ? `https://drive.google.com/uc?export=download&id=${id}` : url;

    return {
      provider: 'google_drive',
      providerLabel: 'Google Drive',
      isCloud: true,
      isFolder: false,
      fileId: id || undefined,
      previewUrl: url,
      downloadUrl,
      embedUrl,
    };
  }

  // 2. Dropbox
  if (url.includes('dropbox.com')) {
    // Replace dl=0 with dl=1 for direct download
    let direct = url;
    if (direct.includes('dl=0')) {
      direct = direct.replace('dl=0', 'dl=1');
    } else if (!direct.includes('dl=1')) {
      direct = direct + (direct.includes('?') ? '&dl=1' : '?dl=1');
    }
    return {
      provider: 'dropbox',
      providerLabel: 'Dropbox',
      isCloud: true,
      previewUrl: url,
      downloadUrl: direct,
    };
  }

  // 3. OneDrive / SharePoint
  if (url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms')) {
    return {
      provider: 'onedrive',
      providerLabel: 'Microsoft OneDrive / SharePoint',
      isCloud: true,
      previewUrl: url,
      downloadUrl: url,
    };
  }

  // 4. Other direct links
  return {
    provider: 'direct_link',
    providerLabel: 'Enlace Web / Nube',
    isCloud: true,
    previewUrl: url,
    downloadUrl: url,
  };
}

/**
 * Helper to safely trigger opening or downloading a cloud/local document
 */
export function openOrDownloadDocument(doc: {
  fileName?: string;
  fileData?: string;
  dataUrl?: string;
  fileUrl?: string;
  title?: string;
}) {
  const effectiveUrl = doc.fileUrl || doc.fileData || doc.dataUrl;
  if (!effectiveUrl) return;

  if (isHttpUrl(effectiveUrl)) {
    const info = analyzeCloudUrl(effectiveUrl);
    // Open the cloud viewer in a new tab
    window.open(info.previewUrl, '_blank', 'noopener,noreferrer');
  } else if (effectiveUrl.startsWith('data:')) {
    // Trigger download for base64
    const link = document.createElement('a');
    link.href = effectiveUrl;
    link.download = doc.fileName || `${doc.title || 'documento'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
