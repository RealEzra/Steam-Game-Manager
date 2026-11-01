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
  version_name: string;
  build_id: string;
  depot_id: string;
  manifest_id: string;
  vault_path: string;
  is_active: boolean;
  created_at: number;
  size_bytes: number;
}

