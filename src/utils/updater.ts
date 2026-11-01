import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toaster } from '@/components/ui/toaster';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  newVersion?: string;
  releaseNotes?: string;
  downloadProgress: number; // 0 to 100
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
}

let activeUpdate: Update | null = null;

export async function checkUpdate(
  onStateChange?: (state: Partial<UpdateState>) => void,
  manual = false
): Promise<Update | null> {
  onStateChange?.({ status: 'checking', error: undefined });
  try {
    const update = await check();
    if (!update) {
      activeUpdate = null;
      onStateChange?.({ status: 'up-to-date' });
      if (manual) {
        toaster.create({
          title: 'Up to Date',
          description: 'You are running the latest version of Steam Game Manager.',
          type: 'info',
        });
      }
      return null;
    }

    activeUpdate = update;
    onStateChange?.({
      status: 'available',
      newVersion: update.version,
      releaseNotes: update.body || undefined,
    });

    toaster.create({
      title: `Update v${update.version} Available`,
      description: 'A new release is ready. Open Settings to update.',
      type: 'info',
    });

    return update;
  } catch (err) {
    const msg = String(err);
    console.warn('Update check failed:', err);
    onStateChange?.({ status: 'error', error: msg });
    if (manual) {
      toaster.create({
        title: 'Check Failed',
        description: msg,
        type: 'warning',
      });
    }
    return null;
  }
}

export async function downloadAndApplyUpdate(
  onStateChange?: (state: Partial<UpdateState>) => void
): Promise<void> {
  if (!activeUpdate) {
    throw new Error('No active update to download.');
  }

  onStateChange?.({ status: 'downloading', downloadProgress: 0, downloadedBytes: 0, totalBytes: 0 });

  let downloaded = 0;
  let total = 0;

  try {
    await activeUpdate.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength || 0;
          onStateChange?.({ totalBytes: total });
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          const progress = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
          onStateChange?.({
            downloadedBytes: downloaded,
            downloadProgress: progress,
          });
          break;
        case 'Finished':
          onStateChange?.({ status: 'ready', downloadProgress: 100 });
          break;
      }
    });

    onStateChange?.({ status: 'ready', downloadProgress: 100 });
    toaster.create({
      title: 'Update Downloaded',
      description: 'Restarting Steam Game Manager to apply update...',
      type: 'success',
    });

    // Relaunch app with new version
    await relaunch();
  } catch (err) {
    const msg = String(err);
    console.error('Failed to download update:', err);
    onStateChange?.({ status: 'error', error: msg });
    toaster.create({
      title: 'Update Installation Failed',
      description: msg,
      type: 'error',
    });
  }
}

