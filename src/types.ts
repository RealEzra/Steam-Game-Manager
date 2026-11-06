export interface SteamGame {
  appid: u32;
  name: string;
  install_dir: string;
  full_path: string;
  library_path: string;
  size_on_disk: number;
  build_id: string;
  last_updated: number;
  mounted_depots: Record<string, string>;
  cover_image: string;
  header_image: string;
  hero_image: string;
  steamdb_url: string;
  is_installed: boolean;
}

export type u32 = number;

export interface SteamLibrary {
  path: string;
  label: string;
  total_games: number;
}

export interface ScanResult {
  libraries: SteamLibrary[];
  games: SteamGame[];
  steam_path: string | null;
}

export interface BackupEntry {
  id: string;
  appid: number;
  game_name: string;
  backup_type: 'saves' | 'full' | 'custom' | string;
  original_path: string;
  backup_path: string;
  size_bytes: number;
  created_at: string;
  files_count: number;
  backed_up_sources?: string[];
}

export interface DowngradePlan {
  appid: number;
  depot_id: string;
  manifest_id: string;
  steam_console_command: string;
  depot_downloader_command: string;
  content_depot_path: string | null;
  game_path: string;
}

export interface BuildVersion {
  id: string;
  versionName: string;
  buildId?: string;
  manifestId: string;
  releaseDate?: string;
  description?: string;
  isCanonical?: boolean;
}

export interface SteamPatchNote {
  gid: string;
  title: string;
  url: string;
  date: number;
  version_tag: string | null;
}

export interface SteamAppMetadata {
  appid: number;
  name: string;
  header_image?: string;
}

export interface DirectoryItem {
  name: string;
  path: string;
  is_dir: boolean;
  is_steam_library: boolean;
}

export interface DirectoryListing {
  current_path: string;
  parent_path: string | null;
  items: DirectoryItem[];
  drives: DirectoryItem[];
}

export interface VaultProfile {
  id: string;
  appid: number;
  game_name?: string;
  version_name: string;
  build_id: string;
  depot_id: string;
  manifest_id: string;
  vault_path: string;
  is_active: boolean;
  created_at: number;
  size_bytes: number;
  library_path?: string;
}

export interface DepotDownloaderStatus {
  is_installed: boolean;
  executable_path: string | null;
  version_info: string | null;
}

export interface AutomatedDowngradeOptions {
  appid: number;
  depot_id: string;
  manifest_id: string;
  game_path: string;
  steam_path?: string | null;
  library_path?: string | null;
  game_name?: string | null;
  username?: string | null;
  password?: string | null;
  remember_password?: boolean;
  auto_backup?: boolean;
  auto_apply?: boolean;
  auto_lock?: boolean;
  custom_tool_path?: string | null;
}

export interface DepotDownloadProgressEvent {
  appid: number;
  depot_id: string;
  manifest_id: string;
  step: 'idle' | 'backup' | 'starting' | 'connecting' | 'needs_2fa' | 'needs_password' | 'downloading' | 'applying' | 'locking' | 'finished' | 'error' | 'cancelled';
  percent: number;
  message: string;
  speed_mb_s?: number | null;
  bytes_downloaded?: number | null;
  total_bytes?: number | null;
}

export interface VaultProgressEvent {
  appid: number;
  step: 'snapshotting' | 'switching' | 'done';
  count: number;
  total_bytes: number;
  current_file: string;
}


