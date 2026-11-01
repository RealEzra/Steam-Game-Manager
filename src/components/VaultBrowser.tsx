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
  Text,
  VStack,
} from '@chakra-ui/react';
import { toaster } from '@/components/ui/toaster';
import {
  LuCamera,
  LuCheck,
  LuFolderOpen,
  LuHardDrive,
  LuInfo,
  LuLayers,
  LuPlus,
  LuRefreshCw,
  LuShieldCheck,
  LuTrash2,
  LuZap,
} from 'react-icons/lu';
import { SteamGame, VaultProfile } from '@/types';
import { formatBytes, formatDate } from '@/utils/format';
import { invoke } from '@tauri-apps/api/core';

interface VaultBrowserProps {
  game: SteamGame;
  steamPath: string | null;
  activeDepot: string;
  selectedManifestId?: string;
  selectedVersionName?: string;
  onProfileSwitched?: () => void;
}

export function VaultBrowser({
  game,
  steamPath,
  activeDepot,
  selectedManifestId,
  selectedVersionName,
  onProfileSwitched,
}: VaultBrowserProps) {
  const [profiles, setProfiles] = useState<VaultProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitchingId, setIsSwitchingId] = useState<string | null>(null);

  // Snapshot form state
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  // Import form state
  const [showImportForm, setShowImportForm] = useState(false);
  const [importDir, setImportDir] = useState('');
  const [importName, setImportName] = useState('');
  const [importBuildId, setImportBuildId] = useState('');
  const [importManifestId, setImportManifestId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [detectedDepotPath, setDetectedDepotPath] = useState<string | null>(null);

  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const list = await invoke<VaultProfile[]>('list_vault_profiles', {
        libraryPath: game.library_path,
        appid: game.appid,
      });
      setProfiles(list);
    } catch (err) {
      console.error('Failed to load vault profiles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkSteamContentDir = async () => {
    if (!steamPath) return;
    try {
      const path = await invoke<string | null>('get_downloaded_depot_path', {
        steamPath,
        appid: game.appid,
        depotId: activeDepot,
      });
      setDetectedDepotPath(path);
      if (path && !importDir) {
        setImportDir(path);
      }
    } catch (err) {
      console.error('Failed to check downloaded depot:', err);
    }
  };

  useEffect(() => {
    loadProfiles();
    checkSteamContentDir();
  }, [game.appid, game.library_path, activeDepot]);

  // Set default snapshot name based on current build or known version
  useEffect(() => {
    if (!snapshotName) {
      const defaultName = selectedVersionName
        ? `${selectedVersionName} (Build ${game.build_id})`
        : `Build ${game.build_id}`;
      setSnapshotName(defaultName);
    }
  }, [game.build_id, selectedVersionName]);

  const activeProfile = profiles.find((p) => p.is_active);

  const handleSnapshotCurrent = async () => {
    if (!snapshotName.trim()) {
      toaster.create({
        title: 'Version Name Required',
        description: 'Please give this snapshot a descriptive name (e.g., 1.5.97 or Vanilla).',
        type: 'warning',
      });
      return;
    }

    setIsSnapshotting(true);
    try {
      const currentManifest = game.mounted_depots[activeDepot] || selectedManifestId || 'current';
      const profile = await invoke<VaultProfile>('snapshot_current_build', {
        libraryPath: game.library_path,
        appid: game.appid,
        gamePath: game.full_path,
        versionName: snapshotName.trim(),
        buildId: game.build_id,
        depotId: activeDepot,
        manifestId: currentManifest,
      });

      toaster.create({
        title: 'Snapshot Cached to Vault',
        description: `Successfully stored ${profile.version_name} (${formatBytes(profile.size_bytes)}) via zero-duplication hardlink.`,
        type: 'success',
      });

      setShowSnapshotForm(false);
      await loadProfiles();
      onProfileSwitched?.();
    } catch (err) {
      toaster.create({
        title: 'Snapshot Failed',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsSnapshotting(false);
    }
  };

  const handleSwitchProfile = async (profile: VaultProfile) => {
    setIsSwitchingId(profile.id);
    try {
      const updated = await invoke<VaultProfile>('switch_build_profile', {
        libraryPath: game.library_path,
        appid: game.appid,
        gamePath: game.full_path,
        targetProfileId: profile.id,
      });

      toaster.create({
        title: 'Build Switched in ~100ms!',
        description: `Active build is now ${updated.version_name} (Build ${updated.build_id}). Steam auto-update locked.`,
        type: 'success',
      });

      await loadProfiles();
      onProfileSwitched?.();
    } catch (err) {
      toaster.create({
        title: 'Failed to Switch Build',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsSwitchingId(null);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      await invoke('delete_vault_profile', {
        libraryPath: game.library_path,
        appid: game.appid,
        profileId,
      });
      toaster.create({
        title: 'Profile Removed from Vault',
        type: 'info',
      });
      await loadProfiles();
    } catch (err) {
      toaster.create({
        title: 'Failed to Delete Profile',
        description: String(err),
        type: 'error',
      });
    }
  };

  const handleImportDownloaded = async () => {
    if (!importDir.trim()) {
      toaster.create({
        title: 'Folder Path Required',
        description: 'Please specify the downloaded depot content directory.',
        type: 'warning',
      });
      return;
    }

    setIsImporting(true);
    try {
      const profile = await invoke<VaultProfile>('import_downloaded_to_vault', {
        libraryPath: game.library_path,
        contentDirPath: importDir.trim(),
        appid: game.appid,
        versionName: importName.trim() || selectedVersionName || `Depot ${activeDepot} Build`,
        buildId: importBuildId.trim() || 'imported',
        depotId: activeDepot,
        manifestId: importManifestId.trim() || selectedManifestId || 'unknown',
      });

      toaster.create({
        title: 'Imported to Vault',
        description: `Stored as ${profile.version_name} (${formatBytes(profile.size_bytes)}). Ready for instant switching!`,
        type: 'success',
      });

      setShowImportForm(false);
      setImportDir('');
      await loadProfiles();
    } catch (err) {
      toaster.create({
        title: 'Import Failed',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsImporting(false);
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
    <VStack gap={5} align="stretch">
      {/* Current Active Status Card */}
      <Box
        p={4}
        rounded="xl"
        borderWidth="1px"
        borderColor="border.subtle"
        bg="bg.muted"
      >
        <Flex justify="space-between" align="center" gap={4} flexWrap={{ base: 'wrap', md: 'nowrap' }}>
          <Box minW={0} flex="1">
            <HStack gap={2} mb={1} wrap="wrap">
              <Badge colorPalette="blue" size="sm" variant="solid">
                <LuHardDrive /> Currently Installed
              </Badge>
              <Badge colorPalette="purple" size="sm">
                Build: {game.build_id}
              </Badge>
              {activeProfile ? (
                <Badge colorPalette="green" size="sm" variant="subtle">
                  <LuShieldCheck /> Profile: {activeProfile.version_name}
                </Badge>
              ) : (
                <Badge colorPalette="gray" size="sm" variant="subtle">
                  Uncached / Live Game State
                </Badge>
              )}
            </HStack>
            <Text fontSize="xs" color="fg.muted" truncate title={game.full_path}>
              Folder: {game.full_path}
            </Text>
          </Box>

          <HStack gap={2} flexShrink={0}>
            <Button
              size="sm"
              colorPalette="blue"
              variant={showSnapshotForm ? 'subtle' : 'solid'}
              onClick={() => setShowSnapshotForm(!showSnapshotForm)}
            >
              <LuCamera />
              {showSnapshotForm ? 'Cancel Snapshot' : 'Snapshot Current Build'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImportForm(!showImportForm)}
            >
              <LuPlus />
              {showImportForm ? 'Cancel Import' : 'Import Downloaded Depot'}
            </Button>
          </HStack>
        </Flex>

        {/* Snapshot Current Form */}
        {showSnapshotForm && (
          <Box
            mt={4}
            p={4}
            rounded="lg"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="blue.500"
            animation="scale-fade-in 0.15s ease-out"
          >
            <Heading size="xs" mb={1} color="blue.500">
              📸 Snapshot Current Live Build to Vault
            </Heading>
            <Text fontSize="2xs" color="fg.muted" mb={3}>
              This captures the currently installed game folder into your library vault using fast
              hardlinks. It takes less than a second, takes 0 extra disk space, and lets you switch
              back to this build whenever you want!
            </Text>

            <Stack direction={{ base: 'column', md: 'row' }} gap={3} align="flex-end">
              <Box flex="1">
                <Text fontSize="2xs" fontWeight="semibold" mb={1}>
                  Profile / Version Label:
                </Text>
                <Input
                  size="sm"
                  placeholder="e.g. Skyrim SE 1.5.97, Vanilla, or Modded 1.6.640"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                />
              </Box>
              <Button
                size="sm"
                colorPalette="blue"
                loading={isSnapshotting}
                onClick={handleSnapshotCurrent}
              >
                <LuCamera />
                Save Snapshot to Vault
              </Button>
            </Stack>
          </Box>
        )}

        {/* Import Downloaded Content Form */}
        {showImportForm && (
          <Box
            mt={4}
            p={4}
            rounded="lg"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="purple.500"
            animation="scale-fade-in 0.15s ease-out"
          >
            <Heading size="xs" mb={1} color="purple.500">
              📥 Import Downloaded Content into Vault
            </Heading>
            <Text fontSize="2xs" color="fg.muted" mb={3}>
              Import files downloaded via Steam Console or DepotDownloader directly into the Vault
              for instant switching without modifying your game yet.
            </Text>

            {detectedDepotPath && (
              <Box
                p={2.5}
                rounded="md"
                bg="purple.500/10"
                borderWidth="1px"
                borderColor="purple.500/20"
                mb={3}
              >
                <Flex justify="space-between" align="center">
                  <Box minW={0} flex="1">
                    <Text fontSize="2xs" fontWeight="bold" color="purple.400">
                      Steam Console Download Detected:
                    </Text>
                    <Code fontSize="2xs" truncate display="block">
                      {detectedDepotPath}
                    </Code>
                  </Box>
                  <Button
                    size="2xs"
                    colorPalette="purple"
                    variant="solid"
                    onClick={() => {
                      setImportDir(detectedDepotPath);
                      if (selectedVersionName) setImportName(selectedVersionName);
                    }}
                  >
                    Use this path
                  </Button>
                </Flex>
              </Box>
            )}

            <VStack gap={2.5} align="stretch">
              <Box>
                <Text fontSize="2xs" fontWeight="semibold" mb={1}>
                  Downloaded Content Directory:
                </Text>
                <Input
                  size="sm"
                  placeholder="/path/to/steamapps/content/app_.../depot_..."
                  value={importDir}
                  onChange={(e) => setImportDir(e.target.value)}
                />
              </Box>

              <Stack direction={{ base: 'column', md: 'row' }} gap={2.5}>
                <Box flex="2">
                  <Text fontSize="2xs" fontWeight="semibold" mb={1}>
                    Version / Profile Name:
                  </Text>
                  <Input
                    size="sm"
                    placeholder={selectedVersionName || 'e.g. Patch 1.5.97'}
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                  />
                </Box>
                <Box flex="1">
                  <Text fontSize="2xs" fontWeight="semibold" mb={1}>
                    Build ID:
                  </Text>
                  <Input
                    size="sm"
                    placeholder="e.g. 324125"
                    value={importBuildId}
                    onChange={(e) => setImportBuildId(e.target.value)}
                  />
                </Box>
                <Box flex="1">
                  <Text fontSize="2xs" fontWeight="semibold" mb={1}>
                    Manifest ID:
                  </Text>
                  <Input
                    size="sm"
                    placeholder={selectedManifestId || 'Manifest ID'}
                    value={importManifestId}
                    onChange={(e) => setImportManifestId(e.target.value)}
                  />
                </Box>
              </Stack>

              <Flex justify="flex-end" mt={1}>
                <Button
                  size="sm"
                  colorPalette="purple"
                  loading={isImporting}
                  onClick={handleImportDownloaded}
                >
                  <LuPlus />
                  Import to Vault
                </Button>
              </Flex>
            </VStack>
          </Box>
        )}
      </Box>

      {/* Vault Profiles Section */}
      <Box>
        <Flex justify="space-between" align="center" mb={3}>
          <HStack gap={2}>
            <Heading size="sm">Cached Build Profiles ({profiles.length})</Heading>
            <Badge colorPalette="blue" size="xs">
              Instant 1-Click Swap
            </Badge>
          </HStack>
          <Button size="xs" variant="ghost" onClick={loadProfiles} loading={isLoading}>
            <LuRefreshCw /> Refresh
          </Button>
        </Flex>

        {profiles.length === 0 ? (
          <Box
            p={8}
            rounded="xl"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border.subtle"
            textAlign="center"
          >
            <Box fontSize="36px" color="fg.muted" mb={2}>
              <LuLayers style={{ margin: '0 auto' }} />
            </Box>
            <Text fontSize="sm" fontWeight="semibold" color="fg">
              No Version Vault Profiles for {game.name}
            </Text>
            <Text fontSize="xs" color="fg.muted" maxW="450px" mx="auto" mt={1}>
              Create a snapshot of your current build above, or import a downloaded depot.
              Once in the vault, you can switch between game versions in milliseconds with zero
              re-downloading!
            </Text>
            <Button
              size="sm"
              colorPalette="blue"
              variant="subtle"
              mt={4}
              onClick={() => setShowSnapshotForm(true)}
            >
              <LuCamera />
              Snapshot Current Build Now
            </Button>
          </Box>
        ) : (
          <VStack gap={3} align="stretch">
            {profiles.map((profile) => (
              <Box
                key={profile.id}
                p={4}
                rounded="xl"
                borderWidth="1px"
                borderColor={profile.is_active ? 'green.500' : 'border.subtle'}
                bg={profile.is_active ? 'green.500/5' : 'bg.panel'}
                transition="all 0.15s ease"
              >
                <Flex
                  justify="space-between"
                  align="center"
                  gap={4}
                >
                  <Box minW={0} flex="1">
                    <HStack gap={2} mb={1} wrap="wrap">
                      <Text fontSize="sm" fontWeight="bold" truncate>
                        {profile.version_name}
                      </Text>
                      {profile.is_active ? (
                        <Badge colorPalette="green" variant="solid" size="xs">
                          <LuCheck /> Active Build
                        </Badge>
                      ) : (
                        <Badge colorPalette="gray" variant="subtle" size="xs">
                          Vault Cached
                        </Badge>
                      )}
                      <Badge colorPalette="purple" size="xs">
                        Build: {profile.build_id}
                      </Badge>
                    </HStack>

                    <HStack gap={3} fontSize="xs" color="fg.muted" wrap="wrap">
                      <Text whiteSpace="nowrap">
                        Depot: <b>{profile.depot_id}</b>
                      </Text>
                      <Text whiteSpace="nowrap">
                        Manifest: <b>{profile.manifest_id}</b>
                      </Text>
                      <Text whiteSpace="nowrap">Size: {formatBytes(profile.size_bytes)}</Text>
                      <Text whiteSpace="nowrap">Saved: {formatDate(profile.created_at)}</Text>
                    </HStack>
                  </Box>

                  <HStack gap={2} flexShrink={0}>
                    {profile.is_active ? (
                      <Button size="sm" colorPalette="green" variant="subtle" disabled>
                        <LuCheck />
                        Active in Steam
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        colorPalette="blue"
                        variant="solid"
                        loading={isSwitchingId === profile.id}
                        onClick={() => handleSwitchProfile(profile)}
                      >
                        <LuZap />
                        Switch to this Build
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      title="Open Vault Folder"
                      onClick={() => handleOpenFolder(profile.vault_path)}
                    >
                      <LuFolderOpen />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      colorPalette="red"
                      title="Delete Profile from Vault"
                      onClick={() => handleDeleteProfile(profile.id)}
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

      {/* How it works info box */}
      <Box p={3.5} rounded="lg" bg="bg.muted" borderWidth="1px" borderColor="border.subtle">
        <HStack gap={2} mb={1}>
          <LuInfo size={14} color="var(--chakra-colors-blue-500)" />
          <Text fontSize="xs" fontWeight="semibold">
            How Quick Build Switching Works
          </Text>
        </HStack>
        <Text fontSize="2xs" color="fg.muted" lineHeight="tall">
          The Vault keeps versions inside your Steam library folder (<Code fontSize="2xs">steamapps/version_vault/</Code>).
          Because files reside on the same drive partition, switching uses filesystem hardlinks,
          instantaneously populating the game folder in under 200ms without duplicating disk space.
          The game manifest (<Code fontSize="2xs">appmanifest_{game.appid}.acf</Code>) is simultaneously
          synchronized and set to update-lock mode, keeping Steam from overwriting your chosen build.
        </Text>
      </Box>
    </VStack>
  );
}
