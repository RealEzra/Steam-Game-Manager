import { DepotDownloadProgressEvent } from '@/types';

export interface DownloadSessionState {
  isDowngrading: boolean;
  activeDowngrade: DepotDownloadProgressEvent | null;
  logs: string[];
}

type Listener = (state: DownloadSessionState) => void;

class DownloadTracker {
  private sessions = new Map<number, DownloadSessionState>();
  private listeners = new Set<Listener>();

  getState(appid: number): DownloadSessionState {
    const existing = this.sessions.get(appid);
    if (existing) return existing;
    return {
      isDowngrading: false,
      activeDowngrade: null,
      logs: [],
    };
  }

  startDownload(appid: number, initialProgress: DepotDownloadProgressEvent) {
    const session: DownloadSessionState = {
      isDowngrading: true,
      activeDowngrade: initialProgress,
      logs: initialProgress.message ? [initialProgress.message] : [],
    };
    this.sessions.set(appid, session);
    this.notify();
  }

  updateProgress(p: DepotDownloadProgressEvent) {
    const prev = this.getState(p.appid);
    const isFinished = p.step === 'finished' || p.step === 'error' || p.step === 'cancelled';
    const isRunning = !isFinished;

    const newLogs = [...prev.logs];
    if (p.message && p.message.trim()) {
      const trimmed = p.message.trim();
      // Avoid duplicate consecutive identical log entries
      if (newLogs.length === 0 || newLogs[newLogs.length - 1] !== trimmed) {
        newLogs.push(trimmed);
        // Keep up to 1000 lines in memory
        if (newLogs.length > 1000) {
          newLogs.splice(0, newLogs.length - 1000);
        }
      }
    }

    const updated: DownloadSessionState = {
      isDowngrading: isRunning,
      activeDowngrade: p,
      logs: newLogs,
    };
    this.sessions.set(p.appid, updated);
    this.notify();
  }

  clearSession(appid: number) {
    this.sessions.delete(appid);
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      // Notify with a dummy state; listeners re-read for their specific appid
      listener({ isDowngrading: false, activeDowngrade: null, logs: [] });
    }
  }
}

export const downloadTracker = new DownloadTracker();

