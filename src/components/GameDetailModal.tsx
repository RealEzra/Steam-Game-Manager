import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Heading,
  Input,
  Stack,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogRoot,
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import {
  LuArchive,
  LuCheck,
  LuChevronDown,
  LuChevronUp,
  LuCopy,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFolder,
  LuFolderOpen,
  LuFolderSync,
  LuInfo,
  LuKey,
  LuPlay,
  LuPlus,
  LuRefreshCw,
  LuRotateCcw,
  LuShieldCheck,
  LuSparkles,
  LuTerminal,
  LuTrash2,
  LuX,
  LuZap,
} from 'react-icons/lu';
import { downloadTracker } from '@/utils/downloadTracker';
import {
  BackupEntry,
  BuildVersion,
  DepotDownloaderStatus,
  DepotDownloadProgressEvent,
  SteamGame,
  SteamLibrary,
} from '@/types';
import { copyToClipboard, formatBytes, formatDate } from '@/utils/format';
import { invoke } from '@tauri-apps/api/core';
import { VersionBrowser } from './VersionBrowser';
import { VaultBrowser } from './VaultBrowser';
import { getDepotLabel, useGameManifestStats } from '@/utils/knownVersions';
import { AppSelect } from '@/components/ui/AppSelect';
import { useAppAccent } from '@/utils/theme';

interface GameDetailModalProps {
  game: SteamGame | null;
  isOpen: boolean;
  onClose: () => void;
  steamPath: string | null;
  isHidden: boolean;
  onToggleHide: (appid: number) => void;
  initialTab?: string;
  onRefreshGame?: () => void;
  libraries?: SteamLibrary[];
}

export function GameDetailModal({
  game,
  isOpen,
  onClose,
  steamPath,
  isHidden,
  onToggleHide,
  initialTab = 'downgrade',
  onRefreshGame,
  libraries = [],
}: GameDetailModalProps) {
  if (!game) return null;

  const { palette, colorHex } = useAppAccent();
  const { depotCount, manifestCount } = useGameManifestStats(game);
  const depotKeys = Object.keys(game.mounted_depots);
  const defaultDepot = depotKeys.length > 0 ? depotKeys[0] : String(game.appid);

  // Tab State
  const [currentTab, setCurrentTab] = useState(initialTab);

  // Target Library for uninstalled games
  const [targetLibrary, setTargetLibrary] = useState(
    game.library_path || (libraries.length > 0 ? libraries[0].path : 'SteamLibrary')
  );

  // Downgrade State
  const [activeDepot, setActiveDepot] = useState(defaultDepot);
  const [manifestId, setManifestId] = useState('');
  const [selectedVersionName, setSelectedVersionName] = useState('');
  const [selectedBuildId, setSelectedBuildId] = useState(game.build_id || '');
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('steam_game_manager_steam_user') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [autoApply, setAutoApply] = useState(true);
  const [autoLock, setAutoLock] = useState(true);
  const [customToolPath, setCustomToolPath] = useState('');
  const [toolStatus, setToolStatus] = useState<DepotDownloaderStatus | null>(null);
  const [isCheckingTool, setIsCheckingTool] = useState(false);
  const [isInstallingTool, setIsInstallingTool] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [activeDowngrade, setActiveDowngrade] = useState<DepotDownloadProgressEvent | null>(null);
  const [sessionLogs, setSessionLogs] = useState<string[]>([]);
  const [showFullLogs, setShowFullLogs] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSubmitting2fa, setIsSubmitting2fa] = useState(false);
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);
  const [depotDownloaderStatus, setDepotDownloaderStatus] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [isApplyingDepot, setIsApplyingDepot] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Backups State
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupType, setBackupType] = useState<'saves' | 'full' | 'custom'>('saves');
  const [customBackupPath, setCustomBackupPath] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);

  // Load backups for this game
  const loadBackups = async () => {
    try {
      const result = await invoke<BackupEntry[]>('list_backups', {
        appid: game.appid,
      });
      setBackups(result);
    } catch (err) {
      console.error('Failed to load backups:', err);
    }
  };

  useEffect(() => {
    if (isOpen && game) {
      const initialDepot = depotKeys.length > 0 ? depotKeys[0] : String(game.appid);
      setActiveDepot(initialDepot);
      setManifestId('');
      setSelectedVersionName('');
      setSelectedBuildId(game.build_id || '');
      setTargetLibrary(game.library_path || (libraries.length > 0 ? libraries[0].path : 'SteamLibrary'));
      setCurrentTab(initialTab);
      loadBackups();
    }
  }, [isOpen, game?.appid, initialTab]);

  const handleSelectVersion = (ver: BuildVersion) => {
    setManifestId(ver.manifestId);
    setSelectedVersionName(ver.versionName);
    if (ver.buildId) {
      setSelectedBuildId(ver.buildId);
    }
    toaster.create({
      title: 'Target Version Selected',
      description: `${ver.versionName} (Manifest ${ver.manifestId})`,
      type: 'info',
    });
  };

  const effectiveGamePath = !game.is_installed && targetLibrary
    ? targetLibrary.endsWith('steamapps')
      ? `${targetLibrary}/common/${game.install_dir}`
      : `${targetLibrary}/steamapps/common/${game.install_dir}`
    : game.full_path;

  // Downgrade Commands
  const effectiveSteamCmd = manifestId
    ? `download_depot ${game.appid} ${activeDepot} ${manifestId}`
    : `download_depot ${game.appid} ${activeDepot} <MANIFEST_ID>`;

  const userFlag = username.trim() ? ` -username ${username.trim()} -remember-password` : '';
  const effectiveDepotDownloaderCmd = manifestId
    ? `DepotDownloader -app ${game.appid} -depot ${activeDepot} -manifest ${manifestId}${userFlag} -dir "${effectiveGamePath}" -validate`
    : `DepotDownloader -app ${game.appid} -depot ${activeDepot} -manifest <MANIFEST_ID>${userFlag} -dir "${effectiveGamePath}" -validate`;

  const steamDbManifestsUrl = `https://steamdb.info/depot/${activeDepot}/manifests/`;

  const handleCopy = async (text: string, type: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedCmd(type);
      toaster.create({
        title: 'Copied command to clipboard',
        description: text,
        type: 'success',
      });
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  const handleOpenSteamConsole = async () => {
    try {
      await invoke('open_steam_console');
      toaster.create({
        title: 'Launched Steam Console',
        description: 'Steam console opened via steam://open/console',
        type: 'info',
      });
    } catch (err) {
      toaster.create({
        title: 'Could not open Steam Console',
        description: String(err),
        type: 'error',
      });
    }
  };

  const handleCheckDepotDownloader = async () => {
    await checkToolStatus();
    if (toolStatus?.is_installed) {
      toaster.create({
        title: 'DepotDownloader Ready',
        description: `Executable located at: ${toolStatus.executable_path}`,
        type: 'success',
      });
    } else {
      toaster.create({
        title: 'DepotDownloader Not Detected',
        description: 'Click "Install Helper" or install DepotDownloader in your system PATH.',
        type: 'warning',
      });
    }
  };

  const checkToolStatus = async (overridePath?: string) => {
    setIsCheckingTool(true);
    try {
      const res = await invoke<DepotDownloaderStatus>('get_depot_downloader_status', {
        customPath: (overridePath !== undefined ? overridePath : customToolPath).trim() || null,
      });
      setToolStatus(res);
      setDepotDownloaderStatus(res.is_installed ? `Installed: ${res.version_info || 'Ready'}` : 'Not found');
    } catch (e) {
      console.error('Failed to check tool status:', e);
    } finally {
      setIsCheckingTool(false);
    }
  };

  const handleInstallHelper = async () => {
    setIsInstallingTool(true);
    try {
      const path = await invoke<string>('install_depot_downloader_tool');
      toaster.create({
        title: 'DepotDownloader Helper Ready',
        description: `Helper installed at: ${path}`,
        type: 'success',
      });
      await checkToolStatus();
    } catch (err: any) {
      toaster.create({
        title: 'Installation Failed',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsInstallingTool(false);
    }
  };

  const handleStartAutomatedDowngrade = async () => {
    if (!manifestId.trim()) {
      toaster.create({
        title: 'Manifest ID Required',
        description: 'Please select a version from the browser or enter a Manifest ID.',
        type: 'warning',
      });
      return;
    }

    if (username.trim()) {
      try {
        localStorage.setItem('steam_game_manager_steam_user', username.trim());
      } catch {}
    }

    const initialProgress: DepotDownloadProgressEvent = {
      appid: game.appid,
      depot_id: activeDepot,
      manifest_id: manifestId.trim(),
      step: 'starting',
      percent: 5,
      message: 'Preparing automated version change...',
      speed_mb_s: null,
      bytes_downloaded: null,
      total_bytes: null,
    };

    setIsDowngrading(true);
    setActiveDowngrade(initialProgress);
    downloadTracker.startDownload(game.appid, initialProgress);

    try {
      await invoke('start_automated_downgrade', {
        options: {
          appid: game.appid,
          depot_id: activeDepot,
          manifest_id: manifestId.trim(),
          current_manifest_id: game.mounted_depots[activeDepot] || null,
          current_build_id: game.build_id || null,
          game_path: effectiveGamePath,
          steam_path: steamPath,
          library_path: targetLibrary || game.library_path,
          game_name: game.name,
          username: username.trim() || null,
          password: password.trim() || null,
          remember_password: rememberPassword,
          auto_backup: autoBackup,
          auto_apply: autoApply,
          auto_lock: autoLock,
          custom_tool_path: customToolPath.trim() || null,
        },
      });
    } catch (err: any) {
      setIsDowngrading(false);
      setActiveDowngrade(null);
      toaster.create({
        title: 'Failed to start version change',
        description: String(err),
        type: 'error',
      });
    }
  };

  const handleSubmit2fa = async () => {
    if (!twoFactorCode.trim()) return;
    setIsSubmitting2fa(true);
    try {
      await invoke('submit_depot_downloader_2fa', { code: twoFactorCode.trim() });
      toaster.create({
        title: 'Submitted Steam Guard Code',
        description: 'Authenticating with Steam...',
        type: 'info',
      });
      setTwoFactorCode('');
    } catch (err: any) {
      toaster.create({
        title: 'Failed to submit 2FA',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsSubmitting2fa(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) return;
    setIsSubmitting2fa(true);
    try {
      await invoke('submit_depot_downloader_2fa', { code: password });
      toaster.create({
        title: 'Submitted Password',
        description: 'Logging into Steam...',
        type: 'info',
      });
    } catch (err: any) {
      toaster.create({
        title: 'Failed to submit password',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsSubmitting2fa(false);
    }
  };

  const handleCancelDowngrade = async () => {
    try {
      await invoke('cancel_automated_downgrade');
      setIsDowngrading(false);
      setActiveDowngrade(null);
      toaster.create({
        title: 'Version Switch Cancelled',
        type: 'info',
      });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkToolStatus();
    }
  }, [isOpen]);

  // Synchronize state with downloadTracker so downloads persist across closing/reopening dialog
  useEffect(() => {
    if (!game) return;

    const syncFromTracker = () => {
      const state = downloadTracker.getState(game.appid);
      setIsDowngrading(state.isDowngrading);
      setActiveDowngrade(state.activeDowngrade);
      setSessionLogs(state.logs);
    };

    // Initial sync
    syncFromTracker();

    // Subscribe to ongoing updates
    const unsubscribe = downloadTracker.subscribe(() => {
      syncFromTracker();
    });

    return () => {
      unsubscribe();
    };
  }, [game?.appid]);

  const handleApplyDownloadedDepot = async () => {
    if (!steamPath) {
      toaster.create({
        title: 'Steam Path Not Configured',
        description: 'Please set your Steam path in Settings to locate downloaded depot content.',
        type: 'error',
      });
      return;
    }

    setIsApplyingDepot(true);
    try {
      const msg = await invoke<string>('apply_downloaded_depot', {
        steamPath,
        appid: game.appid,
        depotId: activeDepot,
        gamePath: effectiveGamePath,
      });

      // If game was uninstalled, register manifest automatically
      if (!game.is_installed) {
        try {
          await invoke('register_installed_game', {
            libraryPath: targetLibrary,
            appid: game.appid,
            gameName: game.name,
            installDir: game.install_dir,
            buildId: selectedBuildId || 'installed',
            depotId: activeDepot,
            manifestId: manifestId || 'installed',
          });
          onRefreshGame?.();
        } catch {
          // ignore manifest error if files applied
        }
      }

      toaster.create({
        title: 'Version Applied Successfully!',
        description: msg,
        type: 'success',
      });
      loadBackups();
      onRefreshGame?.();
    } catch (err) {
      toaster.create({
        title: 'Could not apply depot files',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsApplyingDepot(false);
    }
  };

  const handleLaunchGame = async () => {
    try {
      await invoke('launch_steam_game', { appid: game.appid });
      toaster.create({
        title: 'Launching Game',
        description: `Triggered Steam launch for ${game.name} (AppID ${game.appid})`,
        type: 'success',
      });
    } catch (err) {
      toaster.create({
        title: 'Could not launch game',
        description: String(err),
        type: 'error',
      });
    }
  };

  const handleRegisterInstalledGame = async () => {
    setIsRegistering(true);
    try {
      const msg = await invoke<string>('register_installed_game', {
        libraryPath: targetLibrary,
        appid: game.appid,
        gameName: game.name,
        installDir: game.install_dir,
        buildId: selectedBuildId || 'installed',
        depotId: activeDepot,
        manifestId: manifestId || 'installed',
      });
      toaster.create({
        title: 'Game Registered with Steam!',
        description: msg,
        type: 'success',
      });
      onRefreshGame?.();
    } catch (err) {
      toaster.create({
        title: 'Registration Failed',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = await invoke<BackupEntry>('create_backup', {
        appid: game.appid,
        gameName: game.name,
        gamePath: game.full_path,
        backupType,
        customPath: backupType === 'custom' ? customBackupPath : null,
        steamPath,
      });
      toaster.create({
        title: 'Backup Created',
        description: `Saved ${backup.files_count} files (${formatBytes(backup.size_bytes)})`,
        type: 'success',
      });
      await loadBackups();
    } catch (err) {
      toaster.create({
        title: 'Backup Failed',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    setIsRestoringId(backupId);
    try {
      const msg = await invoke<string>('restore_backup', {
        backupId,
        appid: game.appid,
      });
      toaster.create({
        title: 'Backup Restored',
        description: msg,
        type: 'success',
      });
    } catch (err) {
      toaster.create({
        title: 'Restore Failed',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsRestoringId(null);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    try {
      await invoke('delete_backup', { backupId, appid: game.appid });
      toaster.create({
        title: 'Backup Deleted',
        type: 'info',
      });
      await loadBackups();
    } catch (err) {
      toaster.create({
        title: 'Failed to delete backup',
        description: String(err),
        type: 'error',
      });
    }
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await invoke('open_folder', { path });
    } catch (err) {
      toaster.create({
        title: 'Could not open folder',
        description: String(err),
        type: 'error',
      });
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="xl"
      scrollBehavior="inside"
    >
      <DialogContent
        maxW="980px"
        w="95vw"
        maxH="88vh"
        h="88vh"
        rounded="2xl"
        overflow="hidden"
        p={0}
        display="flex"
        flexDirection="column"
      >
        {/* Hero Header with Artwork */}
        <Box position="relative" height="180px" minH="180px" flexShrink={0} overflow="hidden" bg="gray.950">
          <img
            src={game.hero_image || game.header_image}
            alt={game.name}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              const bgUrl = `https://store.akamai.steamstatic.com/images/storepagebackground/app/${game.appid}`;
              if (target.src !== game.header_image && game.header_image) {
                target.src = game.header_image;
              } else if (target.src !== bgUrl) {
                target.src = bgUrl;
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(0.4) blur(1px)',
            }}
          />

          <Box
            position="absolute"
            inset={0}
            bgGradient="to-t"
            gradientFrom="bg.panel"
            gradientTo="transparent"
          />

          <Flex
            position="absolute"
            bottom={4}
            left={6}
            right={6}
            justify="space-between"
            align="flex-end"
          >
            <Box>
              <HStack gap={2} mb={1}>
                <Badge colorPalette={palette} variant="solid" size="sm">
                  AppID: {game.appid}
                </Badge>
                {!game.is_installed ? (
                  <Badge colorPalette="orange" variant="solid" size="sm">
                    Uninstalled
                  </Badge>
                ) : (
                  <Badge colorPalette="purple" variant="solid" size="sm">
                    Build: {game.build_id}
                  </Badge>
                )}
                {game.is_installed && (
                  <Badge colorPalette="gray" variant="subtle" size="sm">
                    {formatBytes(game.size_on_disk)}
                  </Badge>
                )}
                {(depotCount > 0 || manifestCount > 0) && (
                  <>
                    <Badge colorPalette="cyan" variant="subtle" size="sm">
                      {depotCount} {depotCount === 1 ? 'Depot' : 'Depots'}
                    </Badge>
                    <Badge colorPalette="teal" variant="subtle" size="sm">
                      {manifestCount} {manifestCount === 1 ? 'Manifest' : 'Manifests'}
                    </Badge>
                  </>
                )}
                {isHidden && (
                  <Badge colorPalette="orange" variant="solid" size="sm">
                    Hidden
                  </Badge>
                )}
              </HStack>
              <Heading size="2xl" color="white" textShadow="0 2px 4px rgba(0,0,0,0.8)">
                {game.name}
              </Heading>
            </Box>

            <HStack gap={2}>
              {game.is_installed && (
                <Button
                  size="sm"
                  variant="solid"
                  colorPalette="green"
                  onClick={handleLaunchGame}
                  title="Launch game through Steam"
                >
                  <LuPlay /> Launch Game
                </Button>
              )}
              <Button
                size="sm"
                variant="subtle"
                colorPalette={isHidden ? 'orange' : 'gray'}
                onClick={() => onToggleHide(game.appid)}
              >
                {isHidden ? <LuEye /> : <LuEyeOff />}
                {isHidden ? 'Unhide Game' : 'Hide Game'}
              </Button>
              <Button
                size="sm"
                variant="subtle"
                colorPalette={palette}
                asChild
              >
                <a
                  href={game.steamdb_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LuExternalLink /> SteamDB
                </a>
              </Button>
            </HStack>
          </Flex>

          <DialogCloseTrigger top={4} insetEnd={4} color="white" />
        </Box>

        {/* Dialog Body with Tabs */}
        <DialogBody p={6} flex="1" minH="0" overflowY="auto" display="flex" flexDirection="column">
          <Tabs.Root
            value={currentTab}
            onValueChange={(e) => setCurrentTab(e.value)}
            lazyMount
            unmountOnExit
            variant="line"
            display="flex"
            flexDirection="column"
            flex="1"
            minH="0"
          >
            <Tabs.List
              mb={5}
              gap={2}
              flexWrap="nowrap"
              overflowX="auto"
              overflowY="hidden"
              whiteSpace="nowrap"
              borderBottomWidth="1px"
              borderColor="border.subtle"
              pb="2px"
              flexShrink={0}
            >
              <Tabs.Trigger
                value="downgrade"
                whiteSpace="nowrap"
                flexShrink={0}
                px={3.5}
                py={2}
                fontSize="sm"
              >
                <LuDownload />
                Versions & Switcher
              </Tabs.Trigger>
              <Tabs.Trigger
                value="vault"
                whiteSpace="nowrap"
                flexShrink={0}
                px={3.5}
                py={2}
                fontSize="sm"
              >
                <LuZap />
                Version Vault
              </Tabs.Trigger>
              <Tabs.Trigger
                value="backups"
                whiteSpace="nowrap"
                flexShrink={0}
                px={3.5}
                py={2}
                fontSize="sm"
              >
                <LuArchive />
                Backups ({backups.length})
              </Tabs.Trigger>
              <Tabs.Trigger
                value="info"
                whiteSpace="nowrap"
                flexShrink={0}
                px={3.5}
                py={2}
                fontSize="sm"
              >
                <LuInfo />
                Files & Depots ({depotKeys.length})
              </Tabs.Trigger>
            </Tabs.List>

            {/* TAB 1: BUILD BROWSER & DOWNGRADE */}
            <Tabs.Content value="downgrade">
              <VStack gap={6} align="stretch">
                {/* Uninstalled Game Notice & Target Library Selection */}
                {!game.is_installed && (
                  <Box
                    p={4}
                    rounded="xl"
                    bg="purple.500/10"
                    borderWidth="1px"
                    borderColor="purple.500/30"
                  >
                    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={3} wrap="wrap">
                      <Box minW={0} flex="1">
                        <HStack gap={2} mb={1}>
                          <Badge colorPalette="purple" size="xs">
                            Not Installed
                          </Badge>
                          <Text fontSize="xs" fontWeight="bold">
                            Install Game at Specific Version
                          </Text>
                        </HStack>
                        <Text fontSize="2xs" color="fg.muted">
                          Select your destination Steam library drive below. Once files are downloaded via DepotDownloader
                          or Steam Console, click "Register as Installed Build in Steam" below to create the Steam manifest
                          and play without auto-updates.
                        </Text>
                      </Box>

                      {libraries.length > 0 && (
                        <HStack gap={2}>
                          <Text fontSize="xs" fontWeight="semibold" whiteSpace="nowrap">
                            Destination Drive:
                          </Text>
                          <AppSelect
                            value={targetLibrary}
                            onChange={(val) => setTargetLibrary(val)}
                            options={libraries.map((lib) => ({
                              value: lib.path,
                              label: lib.label,
                            }))}
                            size="sm"
                            minWidth="140px"
                          />
                        </HStack>
                      )}
                    </Flex>
                  </Box>
                )}

                {/* 1. BUILD & VERSION BROWSER */}
                <VersionBrowser
                  game={game}
                  activeDepot={activeDepot}
                  onSelectDepot={(depot) => {
                    setActiveDepot(depot);
                    setManifestId('');
                    setSelectedVersionName('');
                  }}
                  selectedManifestId={manifestId}
                  onSelectVersion={handleSelectVersion}
                />

                {/* 2. DOWNGRADE EXECUTION PLAN */}
                <Box
                  p={5}
                  rounded="xl"
                  borderWidth="1px"
                  borderColor={manifestId ? colorHex : 'border.subtle'}
                  bg="bg.panel"
                >
                  <Flex justify="space-between" align="center" mb={2}>
                    <HStack gap={2}>
                      <Badge colorPalette={palette} size="md">
                        Step 2
                      </Badge>
                      <Heading size="sm">
                        Install & Switch Version for {getDepotLabel(game.appid, activeDepot)}
                      </Heading>
                    </HStack>

                    {selectedVersionName && (
                      <Badge colorPalette="green" variant="solid" size="sm">
                        Selected: {selectedVersionName}
                      </Badge>
                    )}
                  </Flex>

                  <Text fontSize="xs" color="fg.muted" mb={4}>
                    {manifestId
                      ? `Ready to download and apply Depot ${activeDepot} with Manifest ${manifestId}.`
                      : 'Choose a version above from the browser or enter a custom Manifest ID below to generate installation and switcher commands.'}
                  </Text>

                  {/* Manual Manifest input if user wants to override */}
                  <Stack gap={3} direction={{ base: 'column', md: 'row' }} mb={4}>
                    <Box flex="2">
                      <Flex justify="space-between" mb={1}>
                        <Text fontSize="xs" fontWeight="semibold">
                          Target Manifest ID
                        </Text>
                        <a
                          href={steamDbManifestsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '11px',
                            color: colorHex,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Find Manifest on SteamDB <LuExternalLink size={11} />
                        </a>
                      </Flex>
                      <Input
                        placeholder="Select version above or paste 64-bit Manifest ID..."
                        size="sm"
                        rounded="lg"
                        value={manifestId}
                        onChange={(e) => {
                          setManifestId(e.target.value);
                          setSelectedVersionName('');
                        }}
                      />
                    </Box>

                    <Box flex="1">
                      <Text fontSize="xs" fontWeight="semibold" mb={1}>
                        Steam Username (Optional)
                      </Text>
                      <Input
                        placeholder="Steam Username"
                        size="sm"
                        rounded="lg"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </Box>
                  </Stack>

                  <VStack gap={4} align="stretch">
                    {/* Method 1: Automated 1-Click Downgrade (Managed DepotDownloader) */}
                    <Box
                      p={4}
                      rounded="xl"
                      bg="bg.muted"
                      borderWidth="2px"
                      borderColor={colorHex}
                      position="relative"
                    >
                      <Flex justify="space-between" align="center" mb={2} wrap="wrap" gap={2}>
                        <HStack gap={2}>
                          <Badge colorPalette={palette} variant="solid" size="xs">
                            Method 1
                          </Badge>
                          <Text fontSize="xs" fontWeight="bold">
                            ⚡ Automated 1-Click Version Switch (Recommended)
                          </Text>
                          <Badge colorPalette={toolStatus?.is_installed ? 'green' : 'orange'} size="xs">
                            {toolStatus?.is_installed ? 'Helper Ready' : 'Helper Tool Needed'}
                          </Badge>
                        </HStack>

                        <HStack gap={2}>
                          {toolStatus?.is_installed ? (
                            <Text fontSize="2xs" color="fg.muted" truncate maxW="200px" title={toolStatus.executable_path || ''}>
                              {toolStatus.version_info || 'DepotDownloader Ready'}
                            </Text>
                          ) : (
                            <Button
                              size="2xs"
                              colorPalette={palette}
                              variant="solid"
                              loading={isInstallingTool}
                              onClick={handleInstallHelper}
                            >
                              <LuSparkles /> 1-Click Install Helper Tool
                            </Button>
                          )}
                          <Button
                            size="2xs"
                            variant="ghost"
                            onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
                          >
                            {showAdvancedAuth ? 'Hide Options' : 'Auth & Options'}
                          </Button>
                        </HStack>
                      </Flex>

                      <Text fontSize="2xs" color="fg.muted" mb={3}>
                        Automatically backs up game configs and saves, creates a pre-switch Vault snapshot, downloads depot chunks, applies files to your game folder, saves the new build into Version Vault, and locks the Steam manifest.
                      </Text>

                      {/* Download Live Status Card & Persistent Logs */}
                      {activeDowngrade && (
                        <Box
                          p={3.5}
                          mb={3}
                          rounded="lg"
                          bg="bg.panel"
                          borderWidth="1px"
                          borderColor={
                            activeDowngrade.step === 'error'
                              ? 'red.500'
                              : activeDowngrade.step === 'finished'
                              ? 'green.500'
                              : colorHex
                          }
                          animation="scale-fade-in 0.15s ease-out"
                        >
                          <Flex justify="space-between" align="center" mb={2}>
                            <HStack gap={2}>
                              <Badge
                                colorPalette={
                                  activeDowngrade.step === 'error'
                                    ? 'red'
                                    : activeDowngrade.step === 'finished'
                                    ? 'green'
                                    : palette
                                }
                                size="xs"
                                variant="solid"
                              >
                                {activeDowngrade.step.toUpperCase()}
                              </Badge>
                              <Text fontSize="xs" fontWeight="semibold">
                                {activeDowngrade.step === 'backup' && 'Creating Pre-Switch Safety Snapshot...'}
                                {activeDowngrade.step === 'connecting' && 'Connecting to Steam CDN...'}
                                {activeDowngrade.step === 'downloading' && 'Downloading & Validating Depot...'}
                                {activeDowngrade.step === 'needs_2fa' && 'Steam Guard 2FA Required'}
                                {activeDowngrade.step === 'needs_password' && 'Steam Password Required'}
                                {activeDowngrade.step === 'applying' && 'Applying Files to Game Directory...'}
                                {activeDowngrade.step === 'locking' && 'Locking Steam Manifest...'}
                                {activeDowngrade.step === 'finished' && 'Version Switch Complete!'}
                                {activeDowngrade.step === 'error' && 'Error Occurred'}
                                {activeDowngrade.step === 'cancelled' && 'Version Switch Cancelled'}
                              </Text>
                            </HStack>

                            <HStack gap={3}>
                              {activeDowngrade.speed_mb_s && isDowngrading && (
                                <Text fontSize="xs" fontWeight="bold" color={colorHex}>
                                  {activeDowngrade.speed_mb_s.toFixed(1)} MB/s
                                </Text>
                              )}
                              <Text fontSize="xs" fontWeight="bold">
                                {Math.round(activeDowngrade.percent)}%
                              </Text>
                            </HStack>
                          </Flex>

                          {/* Progress Bar */}
                          <Box w="100%" h="7px" bg="bg.muted" rounded="full" overflow="hidden" mb={2}>
                            <Box
                              h="100%"
                              bg={
                                activeDowngrade.step === 'error'
                                  ? 'red.500'
                                  : activeDowngrade.step === 'finished'
                                  ? 'green.500'
                                  : colorHex
                              }
                              rounded="full"
                              transition="width 0.25s ease"
                              style={{ width: `${Math.min(100, Math.max(0, activeDowngrade.percent))}%` }}
                            />
                          </Box>

                          {/* Most recent log line */}
                          <Flex justify="space-between" align="center" gap={2} mb={2}>
                            <Text fontSize="2xs" color="fg.muted" truncate flex="1" title={activeDowngrade.message}>
                              {activeDowngrade.message || 'Waiting for output...'}
                            </Text>

                            <Button
                              size="2xs"
                              variant="ghost"
                              onClick={() => setShowFullLogs(!showFullLogs)}
                            >
                              <LuTerminal size={12} />
                              {showFullLogs ? 'Hide Full Log' : `Expand Full Log (${sessionLogs.length})`}
                              {showFullLogs ? <LuChevronUp size={12} /> : <LuChevronDown size={12} />}
                            </Button>
                          </Flex>

                          {/* Expandable Full Logs Box */}
                          {showFullLogs && (
                            <Box
                              maxH="220px"
                              overflowY="auto"
                              bg="blackAlpha.700"
                              p={2.5}
                              rounded="md"
                              fontFamily="mono"
                              fontSize="2xs"
                              whiteSpace="pre-wrap"
                              color="green.300"
                              borderWidth="1px"
                              borderColor="border.subtle"
                              mb={2}
                            >
                              {sessionLogs.length > 0 ? (
                                sessionLogs.join('\n')
                              ) : (
                                <Text color="fg.muted">No log lines recorded yet.</Text>
                              )}
                            </Box>
                          )}

                          {/* Password Input Prompt */}
                          {activeDowngrade.step === 'needs_password' && (
                            <Box p={3} my={2} rounded="md" bg={`${palette}.500/10`} borderWidth="1px" borderColor={`${palette}.500/30`}>
                              <HStack gap={2} mb={1.5}>
                                <LuKey color={colorHex} />
                                <Text fontSize="xs" fontWeight="bold">
                                  Steam Account Password Required
                                </Text>
                              </HStack>
                              <Text fontSize="2xs" color="fg.muted" mb={2}>
                                Enter your Steam password to log into your Steam account:
                              </Text>
                              <HStack gap={2}>
                                <Input
                                  type="password"
                                  placeholder="Enter Steam password..."
                                  size="sm"
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handlePasswordSubmit();
                                  }}
                                />
                                <Button
                                  size="sm"
                                  colorPalette={palette}
                                  loading={isSubmitting2fa}
                                  onClick={handlePasswordSubmit}
                                >
                                  Submit Password
                                </Button>
                              </HStack>
                            </Box>
                          )}

                          {/* 2FA Input Prompt */}
                          {activeDowngrade.step === 'needs_2fa' && (
                            <Box p={3} my={2} rounded="md" bg={`${palette}.500/10`} borderWidth="1px" borderColor={`${palette}.500/30`}>
                              <HStack gap={2} mb={1.5}>
                                <LuKey color={colorHex} />
                                <Text fontSize="xs" fontWeight="bold">
                                  Steam Guard Code Required
                                </Text>
                              </HStack>
                              <Text fontSize="2xs" color="fg.muted" mb={2}>
                                Enter the 5-character code from your Steam Mobile Authenticator app or email address:
                              </Text>
                              <HStack gap={2}>
                                <Input
                                  placeholder="e.g. R4K2M"
                                  size="sm"
                                  maxW="140px"
                                  value={twoFactorCode}
                                  onChange={(e) => setTwoFactorCode(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmit2fa();
                                  }}
                                />
                                <Button
                                  size="sm"
                                  colorPalette={palette}
                                  loading={isSubmitting2fa}
                                  onClick={handleSubmit2fa}
                                >
                                  Submit Code
                                </Button>
                              </HStack>
                            </Box>
                          )}

                          <Flex justify="flex-end" gap={2} mt={2}>
                            {isDowngrading ? (
                              <Button
                                size="xs"
                                variant="outline"
                                colorPalette="red"
                                onClick={handleCancelDowngrade}
                              >
                                <LuX /> Cancel Download
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => downloadTracker.clearSession(game.appid)}
                              >
                                Dismiss Status
                              </Button>
                            )}
                          </Flex>
                        </Box>
                      )}

                      {/* Credentials & Automation Options Drawer */}
                      {showAdvancedAuth && (
                        <Box p={3} mb={3} rounded="lg" bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
                          <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" color="fg.muted" mb={2}>
                            Authentication & Switcher Options
                          </Text>
                          <Stack direction={{ base: 'column', md: 'row' }} gap={2.5} mb={2.5}>
                            <Box flex="1">
                              <Text fontSize="2xs" fontWeight="semibold" mb={1}>
                                Steam Username:
                              </Text>
                              <Input
                                size="sm"
                                placeholder="Steam account username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                              />
                            </Box>
                            <Box flex="1">
                              <Text fontSize="2xs" fontWeight="semibold" mb={1}>
                                Steam Password (Optional):
                              </Text>
                              <Input
                                size="sm"
                                type="password"
                                placeholder="Leave blank if token cached"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                              />
                            </Box>
                          </Stack>

                          <HStack gap={4} wrap="wrap" fontSize="xs">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={rememberPassword}
                                onChange={(e) => setRememberPassword(e.target.checked)}
                              />
                              <Text fontSize="xs">Remember credentials</Text>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={autoBackup}
                                onChange={(e) => setAutoBackup(e.target.checked)}
                              />
                              <Text fontSize="xs">Auto-backup configs & saves, and snapshot build in Vault</Text>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={autoApply}
                                onChange={(e) => setAutoApply(e.target.checked)}
                              />
                              <Text fontSize="xs">Auto-apply files to game folder</Text>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={autoLock}
                                onChange={(e) => setAutoLock(e.target.checked)}
                              />
                              <Text fontSize="xs">Auto-lock Steam manifest</Text>
                            </label>
                          </HStack>

                          {/* Custom Path Override */}
                          <Box mt={2.5}>
                            <Text fontSize="2xs" color="fg.muted" mb={1}>
                              Custom DepotDownloader Path (Optional):
                            </Text>
                            <Input
                              size="xs"
                              placeholder="e.g. /usr/bin/DepotDownloader or C:\tools\DepotDownloader.exe"
                              value={customToolPath}
                              onChange={(e) => {
                                setCustomToolPath(e.target.value);
                                checkToolStatus(e.target.value);
                              }}
                            />
                          </Box>
                        </Box>
                      )}

                      {/* Action Bar */}
                      <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                        <HStack gap={2} fontSize="2xs" color="fg.muted">
                          <LuShieldCheck color={colorHex} size={14} />
                          <Text>
                            {autoBackup ? 'Pre-change snapshot & saves backup enabled' : 'Snapshots & backups disabled'}
                            {' • '}
                            {autoApply ? 'Instant file copy enabled' : 'Manual copy'}
                          </Text>
                        </HStack>

                        <HStack gap={2}>
                          {!toolStatus?.is_installed && (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={isInstallingTool}
                              onClick={handleInstallHelper}
                            >
                              <LuDownload /> Install Helper
                            </Button>
                          )}
                          <Button
                            size="sm"
                            colorPalette={palette}
                            variant="solid"
                            disabled={!manifestId || isDowngrading}
                            loading={isDowngrading}
                            onClick={handleStartAutomatedDowngrade}
                          >
                            <LuSparkles />
                            {isDowngrading ? 'Switching Version...' : 'Start 1-Click Version Switch'}
                          </Button>
                        </HStack>
                      </Flex>
                    </Box>

                    {/* Method 2: Official Steam Client Console */}
                    <Box
                      p={3.5}
                      rounded="lg"
                      bg="bg.muted"
                      borderWidth="1px"
                      borderColor="border.subtle"
                    >
                      <Flex justify="space-between" align="center" mb={2}>
                        <HStack gap={2}>
                          <Badge colorPalette="gray" variant="solid" size="xs">
                            Method 2
                          </Badge>
                          <Text fontSize="xs" fontWeight="bold">
                            Official Steam Console (Manual / External)
                          </Text>
                        </HStack>
                        <Button
                          size="2xs"
                          colorPalette={palette}
                          variant="outline"
                          onClick={handleOpenSteamConsole}
                        >
                          <LuPlay /> Launch Steam Console
                        </Button>
                      </Flex>

                      <Text fontSize="2xs" color="fg.muted" mb={2}>
                        Paste this command into the Steam console window. Steam will download the files
                        in the background into your Steam content directory.
                      </Text>

                      <Flex
                        p={2}
                        rounded="md"
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        justify="space-between"
                        align="center"
                        mb={3}
                      >
                        <Code fontSize="xs" bg="transparent" wordBreak="break-all">
                          {effectiveSteamCmd}
                        </Code>
                        <Button
                          size="2xs"
                          variant="ghost"
                          onClick={() => handleCopy(effectiveSteamCmd, 'steam')}
                        >
                          {copiedCmd === 'steam' ? <LuCheck color="green" /> : <LuCopy />}
                          Copy
                        </Button>
                      </Flex>

                      <Flex justify="flex-end" gap={2} wrap="wrap">
                        {!game.is_installed && (
                          <Button
                            size="sm"
                            colorPalette="purple"
                            variant="outline"
                            loading={isRegistering}
                            onClick={handleRegisterInstalledGame}
                          >
                            <LuPlus />
                            Register as Installed in Steam
                          </Button>
                        )}
                        <Button
                          size="sm"
                          colorPalette={palette}
                          variant="subtle"
                          onClick={() => setCurrentTab('vault')}
                        >
                          <LuZap />
                          Manage in Version Vault
                        </Button>
                        <Button
                          size="sm"
                          colorPalette="green"
                          variant="solid"
                          loading={isApplyingDepot}
                          onClick={handleApplyDownloadedDepot}
                        >
                          <LuFolderSync />
                          Apply Downloaded Depot Files to Game
                        </Button>
                      </Flex>
                    </Box>

                    {/* Method 3: DepotDownloader CLI */}
                    <Box
                      p={3.5}
                      rounded="lg"
                      bg="bg.muted"
                      borderWidth="1px"
                      borderColor="border.subtle"
                    >
                      <Flex justify="space-between" align="center" mb={2}>
                        <HStack gap={2}>
                          <Badge colorPalette="gray" variant="solid" size="xs">
                            Method 3
                          </Badge>
                          <Text fontSize="xs" fontWeight="bold">
                            Manual DepotDownloader CLI Command
                          </Text>
                        </HStack>
                        <HStack gap={2}>
                          {depotDownloaderStatus && (
                            <Text fontSize="2xs" color="fg.muted">
                              {depotDownloaderStatus}
                            </Text>
                          )}
                          <Button
                            size="2xs"
                            variant="subtle"
                            loading={isCheckingTool}
                            onClick={handleCheckDepotDownloader}
                          >
                            Check CLI Status
                          </Button>
                        </HStack>
                      </Flex>

                      <Text fontSize="2xs" color="fg.muted" mb={2}>
                        Run this in your terminal to download and validate game files directly into your
                        game folder:
                      </Text>

                      <Flex
                        p={2}
                        rounded="md"
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        justify="space-between"
                        align="center"
                      >
                        <Code fontSize="xs" bg="transparent" wordBreak="break-all">
                          {effectiveDepotDownloaderCmd}
                        </Code>
                        <Button
                          size="2xs"
                          variant="ghost"
                          onClick={() => handleCopy(effectiveDepotDownloaderCmd, 'depot')}
                        >
                          {copiedCmd === 'depot' ? <LuCheck color="green" /> : <LuCopy />}
                          Copy
                        </Button>
                      </Flex>
                    </Box>
                  </VStack>
                </Box>
              </VStack>
            </Tabs.Content>

            {/* TAB 2: VERSION VAULT & QUICK SWITCH */}
            <Tabs.Content value="vault">
              <VaultBrowser
                game={game}
                steamPath={steamPath}
                activeDepot={activeDepot}
                selectedManifestId={manifestId}
                selectedVersionName={selectedVersionName}
                onProfileSwitched={() => {
                  loadBackups();
                  onRefreshGame?.();
                }}
              />
            </Tabs.Content>

            {/* TAB 3: BACKUPS */}
            <Tabs.Content value="backups">
              <VStack gap={5} align="stretch">
                {/* Create Backup Card */}
                <Box
                  p={4}
                  rounded="xl"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  bg="bg.muted"
                >
                  <Heading size="sm" mb={2}>
                    Backup Game Files & Save Data
                  </Heading>
                  <Text fontSize="xs" color="fg.muted" mb={4}>
                    Create a standalone backup before switching game versions or testing mods.
                  </Text>

                  <Flex gap={2.5} mb={4} wrap="wrap">
                    <Button
                      size="sm"
                      variant={backupType === 'saves' ? 'solid' : 'outline'}
                      colorPalette={backupType === 'saves' ? palette : 'gray'}
                      onClick={() => setBackupType('saves')}
                    >
                      Save Data & Configs (Recommended)
                    </Button>
                    <Button
                      size="sm"
                      variant={backupType === 'full' ? 'solid' : 'outline'}
                      colorPalette={backupType === 'full' ? palette : 'gray'}
                      onClick={() => setBackupType('full')}
                    >
                      Full Game Directory Archive
                    </Button>
                    <Button
                      size="sm"
                      variant={backupType === 'custom' ? 'solid' : 'outline'}
                      colorPalette={backupType === 'custom' ? palette : 'gray'}
                      onClick={() => setBackupType('custom')}
                    >
                      Custom Path
                    </Button>
                  </Flex>

                  {backupType === 'custom' && (
                    <Box mb={4}>
                      <Input
                        placeholder="Full path to custom folder to backup..."
                        size="sm"
                        value={customBackupPath}
                        onChange={(e) => setCustomBackupPath(e.target.value)}
                      />
                    </Box>
                  )}

                  <Flex justify="flex-end">
                    <Button
                      size="sm"
                      colorPalette={palette}
                      loading={isBackingUp}
                      onClick={handleCreateBackup}
                    >
                      <LuArchive />
                      Create Backup Now
                    </Button>
                  </Flex>
                </Box>

                {/* Backups List */}
                <Box>
                  <Flex justify="space-between" align="center" mb={3}>
                    <Heading size="sm">Existing Backups ({backups.length})</Heading>
                    <Button size="xs" variant="ghost" onClick={loadBackups}>
                      <LuRefreshCw /> Refresh
                    </Button>
                  </Flex>

                  {backups.length === 0 ? (
                    <Box
                      p={6}
                      rounded="xl"
                      borderWidth="1px"
                      borderStyle="dashed"
                      borderColor="border.subtle"
                      textAlign="center"
                      color="fg.muted"
                    >
                      <Text fontSize="sm">No backups found for {game.name}.</Text>
                      <Text fontSize="xs" mt={1}>
                        Create one above before downgrading to keep your saves safe.
                      </Text>
                    </Box>
                  ) : (
                    <VStack gap={2.5} align="stretch">
                      {backups.map((b) => (
                        <Box
                          key={b.id}
                          p={3.5}
                          rounded="xl"
                          borderWidth="1px"
                          borderColor="border.subtle"
                          bg="bg.panel"
                        >
                          <Flex
                            justify="space-between"
                            align="center"
                            gap={3}
                          >
                            <Box minW={0} flex="1">
                              <HStack gap={2} mb={1} wrap="wrap">
                                <Badge
                                  size="xs"
                                  colorPalette={b.backup_type === 'saves' ? 'green' : 'purple'}
                                  variant="subtle"
                                >
                                  {b.backup_type === 'saves' ? 'Save Data' : 'Full Snapshot'}
                                </Badge>
                                <Text fontSize="xs" fontWeight="semibold">
                                  {formatDate(b.created_at)}
                                </Text>
                                <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
                                  • {b.files_count} files • {formatBytes(b.size_bytes)}
                                </Text>
                              </HStack>
                              <Text fontSize="xs" color="fg.muted" truncate title={b.backup_path}>
                                {b.backup_path}
                              </Text>
                            </Box>

                            <HStack gap={2} flexShrink={0}>
                              <Button
                                size="sm"
                                variant="subtle"
                                colorPalette="green"
                                loading={isRestoringId === b.id}
                                onClick={() => handleRestoreBackup(b.id)}
                              >
                                <LuRotateCcw />
                                Restore
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Open Backup Folder"
                                onClick={() => handleOpenFolder(b.backup_path)}
                              >
                                <LuFolderOpen />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                colorPalette="red"
                                title="Delete Backup"
                                onClick={() => handleDeleteBackup(b.id)}
                              >
                                <LuTrash2 />
                              </Button>
                            </HStack>
                          </Flex>
                        </Box>
                      ))}
                    </VStack>
                  )}
                </Box>
              </VStack>
            </Tabs.Content>

            {/* TAB 3: GAME FILES & DEPOTS */}
            <Tabs.Content value="info">
              <VStack gap={4} align="stretch">
                <Box
                  p={4}
                  rounded="xl"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  bg="bg.panel"
                >
                  <Heading size="sm" mb={3}>
                    Game Directories
                  </Heading>

                  <VStack gap={3} align="stretch" fontSize="xs">
                    <Box>
                      <Text fontWeight="semibold" color="fg.muted" mb={1}>
                        Installation Folder
                      </Text>
                      <Flex
                        p={2.5}
                        rounded="lg"
                        bg="bg.muted"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        justify="space-between"
                        align="center"
                        gap={3}
                      >
                        <Box minW={0} flex="1">
                          <Code fontSize="xs" bg="transparent" truncate display="block">
                            {game.full_path}
                          </Code>
                        </Box>
                        <Button
                          size="xs"
                          variant="ghost"
                          flexShrink={0}
                          onClick={() => handleOpenFolder(game.full_path)}
                        >
                          <LuFolder /> Open
                        </Button>
                      </Flex>
                    </Box>

                    <Box>
                      <Text fontWeight="semibold" color="fg.muted" mb={1}>
                        Steam Library Root
                      </Text>
                      <Flex
                        p={2.5}
                        rounded="lg"
                        bg="bg.muted"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        justify="space-between"
                        align="center"
                        gap={3}
                      >
                        <Box minW={0} flex="1">
                          <Code fontSize="xs" bg="transparent" truncate display="block">
                            {game.library_path}
                          </Code>
                        </Box>
                        <Button
                          size="xs"
                          variant="ghost"
                          flexShrink={0}
                          onClick={() => handleOpenFolder(game.library_path)}
                        >
                          <LuFolder /> Open
                        </Button>
                      </Flex>
                    </Box>
                  </VStack>
                </Box>

                <Box
                  p={4}
                  rounded="xl"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  bg="bg.panel"
                >
                  <Heading size="sm" mb={3}>
                    Detected Depots ({depotCount}) & Available Manifests ({manifestCount})
                  </Heading>

                  <VStack gap={2} align="stretch">
                    {depotKeys.map((depotId) => (
                      <Flex
                        key={depotId}
                        p={2.5}
                        rounded="lg"
                        bg="bg.muted"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        justify="space-between"
                        align="center"
                        gap={3}
                      >
                        <HStack gap={3} minW={0} flex="1" wrap="wrap">
                          <Badge colorPalette={palette} size="xs" flexShrink={0}>
                            Depot {depotId}
                          </Badge>
                          <Text fontSize="xs" fontWeight="medium" truncate>
                            {getDepotLabel(game.appid, depotId)}
                          </Text>
                          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                            Manifest: {game.mounted_depots[depotId]}
                          </Text>
                        </HStack>

                        <Box flexShrink={0}>
                          <a
                            href={`https://steamdb.info/depot/${depotId}/manifests/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '11px',
                              color: colorHex,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            View on SteamDB <LuExternalLink size={12} />
                          </a>
                        </Box>
                      </Flex>
                    ))}
                  </VStack>
                </Box>
              </VStack>
            </Tabs.Content>
          </Tabs.Root>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
