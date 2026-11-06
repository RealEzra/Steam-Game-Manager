import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Input,
  Spinner,
  Tabs,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import {
  LuArchive,
  LuFolder,
  LuLayers,
  LuRefreshCw,
  LuTrash2,
  LuZap,
} from 'react-icons/lu';
import { BackupEntry, SteamGame, SteamLibrary, VaultProfile } from '@/types';
import { formatBytes, formatDate } from '@/utils/format';
import { invoke } from '@tauri-apps/api/core';
import { useAppAccent } from '@/utils/theme';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: SteamGame[];
  libraries: SteamLibrary[];
  onOpenGame?: (game: SteamGame, tab?: 'downgrade' | 'vault' | 'backups' | 'info') => void;
  onRefreshData?: () => void;
}

export function StorageManagerModal({
  isOpen,
  onClose,
  games,
  libraries,
  onOpenGame,
  onRefreshData,
}: StorageManagerModalProps) {
  const { palette, colorHex } = useAppAccent();
  const [activeTab, setActiveTab] = useState<'vaults' | 'backups'>('vaults');
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Data
  const [vaultProfiles, setVaultProfiles] = useState<VaultProfile[]>([]);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Map appid to game name for instant lookup
  const gameMap = useMemo(() => {
    const map = new Map<number, SteamGame>();
    for (const g of games) {
      map.set(g.appid, g);
    }
    return map;
  }, [games]);

  const loadAllStorage = async () => {
    setIsLoading(true);
    try {
      const libPaths = libraries.map((l) => l.path);
      // Also include any library paths recorded on games
      for (const g of games) {
        if (g.library_path && !libPaths.includes(g.library_path)) {
          libPaths.push(g.library_path);
        }
      }

      const [vaultsList, backupsList] = await Promise.all([
        invoke<VaultProfile[]>('list_all_vault_profiles', { libraries: libPaths }).catch(() => []),
        invoke<BackupEntry[]>('list_backups', { appid: null }).catch(() => []),
      ]);

      setVaultProfiles(vaultsList);
      setBackups(backupsList);
    } catch (err) {
      console.error('Failed to load storage items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllStorage();
    }
  }, [isOpen, libraries, games]);

  const handleDeleteVaultProfile = async (profile: VaultProfile) => {
    setDeletingId(profile.id);
    try {
      const libPath = profile.library_path || gameMap.get(profile.appid)?.library_path;
      if (!libPath) {
        throw new Error('Could not determine library path for this profile');
      }

      await invoke('delete_vault_profile', {
        libraryPath: libPath,
        appid: profile.appid,
        profileId: profile.id,
      });

      toaster.create({
        title: 'Vault Profile Deleted',
        description: `Freed up snapshot storage for AppID ${profile.appid}`,
        type: 'info',
        duration: 5000,
      });

      await loadAllStorage();
      onRefreshData?.();
    } catch (err) {
      toaster.create({
        title: 'Delete Failed',
        description: String(err),
        type: 'error',
        duration: 6000,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteBackup = async (backup: BackupEntry) => {
    setDeletingId(backup.id);
    try {
      await invoke('delete_backup', { backupId: backup.id, appid: backup.appid });
      toaster.create({
        title: 'Backup Archive Deleted',
        description: `Freed ${formatBytes(backup.size_bytes)}`,
        type: 'info',
        duration: 5000,
      });

      await loadAllStorage();
      onRefreshData?.();
    } catch (err) {
      toaster.create({
        title: 'Delete Failed',
        description: String(err),
        type: 'error',
        duration: 6000,
      });
    } finally {
      setDeletingId(null);
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

  // Aggregated totals
  const totalVaultBytes = useMemo(() => {
    return vaultProfiles.reduce((acc, p) => acc + (p.size_bytes || 0), 0);
  }, [vaultProfiles]);

  const totalBackupBytes = useMemo(() => {
    return backups.reduce((acc, b) => acc + (b.size_bytes || 0), 0);
  }, [backups]);

  // Filtered lists
  const filteredVaults = useMemo(() => {
    if (!search.trim()) return vaultProfiles;
    const q = search.toLowerCase();
    return vaultProfiles.filter((p) => {
      const game = gameMap.get(p.appid);
      const name = (game?.name || '').toLowerCase();
      return (
        name.includes(q) ||
        p.appid.toString().includes(q) ||
        p.version_name.toLowerCase().includes(q) ||
        p.build_id.toLowerCase().includes(q)
      );
    });
  }, [vaultProfiles, search, gameMap]);

  const filteredBackups = useMemo(() => {
    if (!search.trim()) return backups;
    const q = search.toLowerCase();
    return backups.filter((b) => {
      const name = (b.game_name || '').toLowerCase();
      return (
        name.includes(q) ||
        b.appid.toString().includes(q) ||
        b.backup_type.toLowerCase().includes(q)
      );
    });
  }, [backups, search]);

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="xl"
    >
      <DialogContent rounded="2xl" maxW="1020px" maxH="86vh" p={6}>
        <DialogHeader p={0} mb={4}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
            <HStack gap={3}>
              <Box p={2.5} rounded="xl" bg={`${palette}.500/15`} color={colorHex}>
                <LuLayers size={22} />
              </Box>
              <Box>
                <DialogTitle fontSize="lg" fontWeight="bold">
                  Storage & Snapshot Manager
                </DialogTitle>
                <Text fontSize="xs" color="fg.muted">
                  View and manage all game backups and Version Vault snapshots across every library drive
                </Text>
              </Box>
            </HStack>

            <HStack gap={2} mr={8}>
              <Button size="xs" variant="ghost" loading={isLoading} onClick={loadAllStorage}>
                <LuRefreshCw /> Refresh
              </Button>
            </HStack>
          </Flex>
          <DialogCloseTrigger top={4} insetEnd={4} />
        </DialogHeader>

        <DialogBody p={0} display="flex" flexDirection="column" gap={4} overflow="hidden">
          {/* Summary Overview Cards */}
          <Flex gap={3} wrap="wrap">
            <Box
              flex="1"
              minW="220px"
              p={3.5}
              rounded="xl"
              bg="bg.muted"
              borderWidth="1px"
              borderColor="border.subtle"
            >
              <Flex justify="space-between" align="center" mb={1}>
                <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                  Version Vault Snapshots
                </Text>
                <Badge colorPalette="purple" size="xs">
                  {vaultProfiles.length} Profiles
                </Badge>
              </Flex>
              <Heading size="lg" fontWeight="bold" color="purple.400">
                {formatBytes(totalVaultBytes)}
              </Heading>
              <Text fontSize="2xs" color="fg.muted" mt={1}>
                Hardlink snapshots across connected Steam libraries
              </Text>
            </Box>

            <Box
              flex="1"
              minW="220px"
              p={3.5}
              rounded="xl"
              bg="bg.muted"
              borderWidth="1px"
              borderColor="border.subtle"
            >
              <Flex justify="space-between" align="center" mb={1}>
                <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
                  Standalone Backups
                </Text>
                <Badge colorPalette="green" size="xs">
                  {backups.length} Backups
                </Badge>
              </Flex>
              <Heading size="lg" fontWeight="bold" color="green.400">
                {formatBytes(totalBackupBytes)}
              </Heading>
              <Text fontSize="2xs" color="fg.muted" mt={1}>
                Saves, configurations & game archives
              </Text>
            </Box>
          </Flex>

          {/* Search Bar */}
          <Box position="relative">
            <Input
              placeholder="Search by game title, AppID, or version name..."
              size="sm"
              rounded="lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Box>

          {/* Tabs for Vault vs Backups */}
          <Tabs.Root
            value={activeTab}
            onValueChange={(e) => setActiveTab(e.value as 'vaults' | 'backups')}
            variant="line"
            display="flex"
            flexDirection="column"
            flex="1"
            minH="0"
          >
            <Tabs.List borderBottomWidth="1px" borderColor="border.subtle" mb={3} gap={4}>
              <Tabs.Trigger value="vaults" px={3} py={2} fontSize="sm">
                <LuZap /> Version Vault Profiles ({filteredVaults.length})
              </Tabs.Trigger>
              <Tabs.Trigger value="backups" px={3} py={2} fontSize="sm">
                <LuArchive /> Game Backups ({filteredBackups.length})
              </Tabs.Trigger>
            </Tabs.List>

            {/* TAB 1: VAULT PROFILES */}
            <Tabs.Content value="vaults" flex="1" minH="0" overflowY="auto" p={1}>
              {isLoading && vaultProfiles.length === 0 ? (
                <Flex justify="center" align="center" minH="220px" direction="column" gap={3}>
                  <Spinner size="lg" color={colorHex} />
                  <Text fontSize="sm" color="fg.muted">Scanning library drives for Version Vault profiles...</Text>
                </Flex>
              ) : filteredVaults.length === 0 ? (
                <Box p={8} textAlign="center" color="fg.muted" borderWidth="1px" borderStyle="dashed" rounded="xl">
                  <Text fontSize="sm">No Version Vault profiles found.</Text>
                  <Text fontSize="xs" mt={1}>Snapshots created in the Version Vault tab will be listed here.</Text>
                </Box>
              ) : (
                <VStack gap={2.5} align="stretch">
                  {filteredVaults.map((p) => {
                    const game = gameMap.get(p.appid);
                    const gameName = game ? game.name : `Steam App ${p.appid}`;

                    return (
                      <Box
                        key={p.id}
                        p={3.5}
                        rounded="xl"
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        _hover={{ borderColor: 'border.emphasized' }}
                        transition="all 0.15s ease"
                      >
                        <Flex justify="space-between" align="center" gap={3}>
                          <Box minW={0} flex="1">
                            <HStack gap={2} mb={1} wrap="wrap">
                              <Badge colorPalette={palette} size="xs" variant="solid">
                                AppID {p.appid}
                              </Badge>
                              <Text fontSize="sm" fontWeight="bold">
                                {gameName}
                              </Text>
                              {p.is_active && (
                                <Badge colorPalette="green" size="xs">
                                  Active Installed
                                </Badge>
                              )}
                              <Badge colorPalette="purple" variant="subtle" size="xs">
                                Build {p.build_id}
                              </Badge>
                              <Text fontSize="2xs" color="fg.muted">
                                • {formatDate(p.created_at)} • {formatBytes(p.size_bytes)}
                              </Text>
                            </HStack>

                            <HStack gap={2} fontSize="xs" color="fg.muted" mb={1}>
                              <Text fontWeight="semibold" color="fg">
                                {p.version_name}
                              </Text>
                              <Text>• Manifest: {p.manifest_id}</Text>
                            </HStack>

                            <Text fontSize="2xs" color="fg.muted" truncate title={p.vault_path}>
                              {p.vault_path}
                            </Text>
                          </Box>

                          <HStack gap={2} flexShrink={0}>
                            {game && onOpenGame && (
                              <Button
                                size="xs"
                                variant="subtle"
                                colorPalette={palette}
                                onClick={() => {
                                  onClose();
                                  onOpenGame(game, 'vault');
                                }}
                              >
                                View in Game
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="ghost"
                              title="Open Vault Folder"
                              onClick={() => handleOpenFolder(p.vault_path)}
                            >
                              <LuFolder />
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorPalette="red"
                              title="Delete Vault Profile"
                              loading={deletingId === p.id}
                              onClick={() => handleDeleteVaultProfile(p)}
                            >
                              <LuTrash2 />
                            </Button>
                          </HStack>
                        </Flex>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </Tabs.Content>

            {/* TAB 2: BACKUPS */}
            <Tabs.Content value="backups" flex="1" minH="0" overflowY="auto" p={1}>
              {isLoading && backups.length === 0 ? (
                <Flex justify="center" align="center" minH="220px" direction="column" gap={3}>
                  <Spinner size="lg" color={colorHex} />
                  <Text fontSize="sm" color="fg.muted">Scanning backups...</Text>
                </Flex>
              ) : filteredBackups.length === 0 ? (
                <Box p={8} textAlign="center" color="fg.muted" borderWidth="1px" borderStyle="dashed" rounded="xl">
                  <Text fontSize="sm">No standalone backups found.</Text>
                  <Text fontSize="xs" mt={1}>Save data and game backups created will appear here.</Text>
                </Box>
              ) : (
                <VStack gap={2.5} align="stretch">
                  {filteredBackups.map((b) => {
                    const game = gameMap.get(b.appid);

                    return (
                      <Box
                        key={b.id}
                        p={3.5}
                        rounded="xl"
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        _hover={{ borderColor: 'border.emphasized' }}
                        transition="all 0.15s ease"
                      >
                        <Flex justify="space-between" align="center" gap={3}>
                          <Box minW={0} flex="1">
                            <HStack gap={2} mb={1} wrap="wrap">
                              <Badge colorPalette={palette} size="xs" variant="solid">
                                AppID {b.appid}
                              </Badge>
                              <Text fontSize="sm" fontWeight="bold">
                                {b.game_name}
                              </Text>
                              <Badge
                                size="xs"
                                colorPalette={b.backup_type === 'saves' ? 'green' : 'purple'}
                                variant="subtle"
                              >
                                {b.backup_type === 'saves' ? 'Save Data' : 'Full Archive'}
                              </Badge>
                              <Text fontSize="2xs" color="fg.muted">
                                • {formatDate(b.created_at)} • {b.files_count} files • {formatBytes(b.size_bytes)}
                              </Text>
                            </HStack>

                            <Text fontSize="2xs" color="fg.muted" truncate title={b.backup_path}>
                              {b.backup_path}
                            </Text>
                          </Box>

                          <HStack gap={2} flexShrink={0}>
                            {game && onOpenGame && (
                              <Button
                                size="xs"
                                variant="subtle"
                                colorPalette={palette}
                                onClick={() => {
                                  onClose();
                                  onOpenGame(game, 'backups');
                                }}
                              >
                                View in Game
                              </Button>
                            )}
                            <Button
                              size="xs"
                              variant="ghost"
                              title="Open Backup Folder"
                              onClick={() => handleOpenFolder(b.backup_path)}
                            >
                              <LuFolder />
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorPalette="red"
                              title="Delete Backup"
                              loading={deletingId === b.id}
                              onClick={() => handleDeleteBackup(b)}
                            >
                              <LuTrash2 />
                            </Button>
                          </HStack>
                        </Flex>
                      </Box>
                    );
                  })}
                </VStack>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
