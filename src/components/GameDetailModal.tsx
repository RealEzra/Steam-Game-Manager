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
  LuCopy,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFolder,
  LuFolderOpen,
  LuFolderSync,
  LuInfo,
  LuPlay,
  LuPlus,
  LuRefreshCw,
  LuRotateCcw,
  LuTrash2,
  LuZap,
} from 'react-icons/lu';
import { BackupEntry, BuildVersion, SteamGame, SteamLibrary } from '@/types';
import { copyToClipboard, formatBytes, formatDate } from '@/utils/format';
import { invoke } from '@tauri-apps/api/core';
import { VersionBrowser } from './VersionBrowser';
import { VaultBrowser } from './VaultBrowser';
import { getDepotLabel } from '@/utils/knownVersions';

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
  const [username, setUsername] = useState('');
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
    try {
      const path = await invoke<string>('check_depot_downloader', {
        customPath: null,
      });
      setDepotDownloaderStatus(`Found: ${path}`);
      toaster.create({
        title: 'DepotDownloader Ready',
        description: `Executable located at: ${path}`,
        type: 'success',
      });
    } catch (err) {
      setDepotDownloaderStatus('Not found in PATH');
      toaster.create({
        title: 'DepotDownloader Not Detected',
        description: 'Make sure DepotDownloader is installed or in your system PATH.',
        type: 'warning',
      });
    }
  };

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
        title: 'Downgrade Applied Successfully!',
        description: msg,
        type: 'success',
      });
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
                <Badge colorPalette="blue" variant="solid" size="sm">
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
                colorPalette="blue"
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
                Builds & Downgrade
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
                Files & Depots
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
                          <select
                            value={targetLibrary}
                            onChange={(e) => setTargetLibrary(e.target.value)}
                            style={{
                              height: '32px',
                              fontSize: '12px',
                              borderRadius: '8px',
                              padding: '0 8px',
                              background: 'var(--chakra-colors-bg-panel)',
                              color: 'var(--chakra-colors-fg)',
                              border: '1px solid var(--chakra-colors-border-subtle)',
                              outline: 'none',
                            }}
                          >
                            {libraries.map((lib) => (
                              <option key={lib.path} value={lib.path}>
                                {lib.label}
                              </option>
                            ))}
                          </select>
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
                  borderColor={manifestId ? 'blue.500' : 'border.subtle'}
                  bg="bg.panel"
                >
                  <Flex justify="space-between" align="center" mb={2}>
                    <HStack gap={2}>
                      <Badge colorPalette="blue" size="md">
                        Step 2
                      </Badge>
                      <Heading size="sm">
                        Execute Downgrade for {getDepotLabel(game.appid, activeDepot)}
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
                      : 'Choose a version above from the browser or enter a custom Manifest ID below to generate downgrade commands.'}
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
                            color: 'var(--chakra-colors-blue-500)',
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
                    {/* Method 1: Official Steam Client Console */}
                    <Box
                      p={3.5}
                      rounded="lg"
                      bg="bg.muted"
                      borderWidth="1px"
                      borderColor="border.subtle"
                    >
                      <Flex justify="space-between" align="center" mb={2}>
                        <HStack gap={2}>
                          <Badge colorPalette="blue" variant="solid" size="xs">
                            Method 1
                          </Badge>
                          <Text fontSize="xs" fontWeight="bold">
                            Official Steam Console (Recommended)
                          </Text>
                        </HStack>
                        <Button
                          size="2xs"
                          colorPalette="blue"
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
                          colorPalette="blue"
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

                    {/* Method 2: DepotDownloader CLI */}
                    <Box
                      p={3.5}
                      rounded="lg"
                      bg="bg.muted"
                      borderWidth="1px"
                      borderColor="border.subtle"
                    >
                      <Flex justify="space-between" align="center" mb={2}>
                        <HStack gap={2}>
                          <Badge colorPalette="purple" variant="solid" size="xs">
                            Method 2
                          </Badge>
                          <Text fontSize="xs" fontWeight="bold">
                            DepotDownloader CLI
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
                onProfileSwitched={onRefreshGame}
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
                    Create a safety snapshot before overwriting files with an older build.
                  </Text>

                  <Flex gap={2.5} mb={4} wrap="wrap">
                    <Button
                      size="sm"
                      variant={backupType === 'saves' ? 'solid' : 'outline'}
                      colorPalette={backupType === 'saves' ? 'blue' : 'gray'}
                      onClick={() => setBackupType('saves')}
                    >
                      Save Data & Configs (Recommended)
                    </Button>
                    <Button
                      size="sm"
                      variant={backupType === 'full' ? 'solid' : 'outline'}
                      colorPalette={backupType === 'full' ? 'blue' : 'gray'}
                      onClick={() => setBackupType('full')}
                    >
                      Full Game Directory Snapshot
                    </Button>
                    <Button
                      size="sm"
                      variant={backupType === 'custom' ? 'solid' : 'outline'}
                      colorPalette={backupType === 'custom' ? 'blue' : 'gray'}
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
                      colorPalette="blue"
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
                    Detected Depots & Installed Manifests
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
                          <Badge colorPalette="blue" size="xs" flexShrink={0}>
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
                              color: 'var(--chakra-colors-blue-500)',
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
