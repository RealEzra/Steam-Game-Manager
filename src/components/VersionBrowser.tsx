import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import {
  LuBookOpen,
  LuCheck,
  LuChevronLeft,
  LuChevronRight,
  LuClipboardPaste,
  LuCloudDownload,
  LuExternalLink,
  LuGlobe,
  LuLayers,
  LuPlus,
  LuRotateCcw,
  LuSearch,
  LuSparkles,
  LuTag,
  LuTrash2,
} from 'react-icons/lu';
import { BuildVersion, SteamGame, SteamPatchNote } from '@/types';
import {
  clearCustomVersions,
  deleteCustomVersion,
  getAllVersionsForDepot,
  getDepotLabel,
  getUserLanguage,
  isPatchNoteInLanguage,
  matchManifestsToPatchNotes,
  parseSteamDbManifests,
  saveCustomVersion,
  saveMultipleCustomVersions,
  setUserLanguage,
} from '@/utils/knownVersions';
import { formatDate } from '@/utils/format';
import { invoke } from '@tauri-apps/api/core';
import { toaster } from '@/components/ui/toaster';
import { AppSelect } from '@/components/ui/AppSelect';
import { useAppAccent } from '@/utils/theme';

interface VersionBrowserProps {
  game: SteamGame;
  activeDepot: string;
  onSelectDepot: (depot: string) => void;
  selectedManifestId: string;
  onSelectVersion: (version: BuildVersion) => void;
}

export function VersionBrowser({
  game,
  activeDepot,
  onSelectDepot,
  selectedManifestId,
  onSelectVersion,
}: VersionBrowserProps) {
  const depotKeys = Object.keys(game.mounted_depots);
  const currentManifest = game.mounted_depots[activeDepot] || 'unknown';
  const { palette, colorHex } = useAppAccent();

  const [versions, setVersions] = useState<BuildVersion[]>([]);
  const [patchNotes, setPatchNotes] = useState<SteamPatchNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);

  // New version form state
  const [newVersionName, setNewVersionName] = useState('');
  const [newManifestId, setNewManifestId] = useState('');
  const [newBuildId, setNewBuildId] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // SteamDB Importer Textarea
  const [importText, setImportText] = useState('');

  // Patch notes preferred language
  const [patchNoteLang, setPatchNoteLang] = useState<string>(getUserLanguage());

  // Automatically detected manifests on clipboard when user focuses the window
  const [pendingClipboardManifests, setPendingClipboardManifests] = useState<BuildVersion[]>([]);

  // Search filter and pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Background fetch patch notes to match against manifests
  useEffect(() => {
    let cancelled = false;
    invoke<SteamPatchNote[]>('get_steam_patch_notes', {
      appid: game.appid,
      language: patchNoteLang,
    })
      .then((notes) => {
        if (!cancelled && notes && notes.length > 0) {
          setPatchNotes(notes);
        }
      })
      .catch((err) => {
        console.warn('Could not auto-fetch patch notes for date matching:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [game.appid, patchNoteLang]);

  const [versionMutationTrigger, setVersionMutationTrigger] = useState(0);

  const rawVersions = useMemo(() => {
    return getAllVersionsForDepot(
      game.appid,
      activeDepot,
      currentManifest,
      game.build_id
    );
  }, [game.appid, activeDepot, currentManifest, game.build_id, versionMutationTrigger]);

  const refreshVersions = () => {
    setVersionMutationTrigger((c) => c + 1);
  };

  useEffect(() => {
    const enriched = matchManifestsToPatchNotes(rawVersions, patchNotes, patchNoteLang);
    setVersions(enriched);
  }, [rawVersions, patchNotes, patchNoteLang]);

  // Reset page when switching depot or searching
  useEffect(() => {
    setPage(1);
  }, [activeDepot, searchQuery]);

  const filteredVersions = useMemo(() => {
    if (!searchQuery.trim()) return versions;
    const q = searchQuery.toLowerCase();
    return versions.filter(
      (v) =>
        v.versionName.toLowerCase().includes(q) ||
        v.manifestId.toLowerCase().includes(q) ||
        (v.buildId && v.buildId.toLowerCase().includes(q)) ||
        (v.releaseDate && v.releaseDate.toLowerCase().includes(q)) ||
        (v.description && v.description.toLowerCase().includes(q))
    );
  }, [versions, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredVersions.length / pageSize));
  const paginatedVersions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVersions.slice(start, start + pageSize);
  }, [filteredVersions, page, pageSize]);

  // Check clipboard on window focus for SteamDB manifest data
  useEffect(() => {
    const checkClipboardOnFocus = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const parsed = parseSteamDbManifests(text, activeDepot);
          if (parsed.length > 0) {
            // Only suggest if not already in version list
            const currentIds = new Set(versions.map((v) => v.manifestId));
            const newOnly = parsed.filter((p) => !currentIds.has(p.manifestId));
            if (newOnly.length > 0) {
              setPendingClipboardManifests(newOnly);
            }
          }
        }
      } catch {
        // Silently ignore clipboard permissions errors on passive focus
      }
    };

    window.addEventListener('focus', checkClipboardOnFocus);
    return () => window.removeEventListener('focus', checkClipboardOnFocus);
  }, [activeDepot, versions]);

  const detectedManifests = useMemo(() => {
    if (!importText.trim()) return [];
    return parseSteamDbManifests(importText, activeDepot);
  }, [importText, activeDepot]);

  const visiblePatchNotes = useMemo(() => {
    return patchNotes.filter((n) => isPatchNoteInLanguage(n.title, patchNoteLang));
  }, [patchNotes, patchNoteLang]);

  const loadPatchNotes = async () => {
    setIsLoadingNotes(true);
    try {
      const notes = await invoke<SteamPatchNote[]>('get_steam_patch_notes', {
        appid: game.appid,
        language: patchNoteLang,
      });
      setPatchNotes(notes);
      setShowPatchNotes(true);
    } catch (err) {
      console.error('Failed to load patch notes:', err);
      toaster.create({
        title: 'Could not fetch Steam announcements',
        description: String(err),
        type: 'warning',
      });
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // 1-Click Clipboard Parser (Read from user clipboard)
  const handleQuickClipboardImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toaster.create({
          title: 'Clipboard Empty',
          description: 'Copy text from SteamDB, then click here to auto-import.',
          type: 'warning',
        });
        return;
      }

      const parsed = parseSteamDbManifests(text, activeDepot);
      if (parsed.length === 0) {
        toaster.create({
          title: 'No Manifest IDs Found',
          description: 'Could not detect 64-bit manifest numbers on your clipboard.',
          type: 'warning',
        });
        return;
      }

      const added = saveMultipleCustomVersions(game.appid, activeDepot, parsed);
      refreshVersions();
      setPendingClipboardManifests([]);

      if (!selectedManifestId) {
        onSelectVersion(parsed[0]);
      }

      toaster.create({
        title: 'Clipboard Imported!',
        description: `Imported ${parsed.length} manifests from clipboard (${added} new). Zero typing needed!`,
        type: 'success',
      });
    } catch (err) {
      console.error('Clipboard read failed:', err);
      setShowImportModal(true);
      toaster.create({
        title: 'Clipboard Access Notice',
        description: 'Please paste into the box below.',
        type: 'info',
      });
    }
  };

  const applyPendingClipboardManifests = () => {
    if (pendingClipboardManifests.length === 0) return;
    const added = saveMultipleCustomVersions(game.appid, activeDepot, pendingClipboardManifests);
    refreshVersions();

    if (!selectedManifestId) {
      onSelectVersion(pendingClipboardManifests[0]);
    }

    toaster.create({
      title: 'Manifests Imported!',
      description: `Added ${pendingClipboardManifests.length} manifests (${added} new) from your clipboard.`,
      type: 'success',
    });
    setPendingClipboardManifests([]);
  };

  // Sync SteamCMD branches & local disk depotcache (fast and non-blocking)
  const handleSyncOnline = async () => {
    setIsSyncing(true);
    try {
      const fetched = await invoke<BuildVersion[]>('fetch_depot_manifests', {
        appid: game.appid,
        depotId: activeDepot,
      });

      if (fetched && fetched.length > 0) {
        const added = saveMultipleCustomVersions(game.appid, activeDepot, fetched);
        refreshVersions();
        toaster.create({
          title: 'Manifests Synced',
          description: `Discovered ${fetched.length} manifests (${added} new) from local cache & Steam network.`,
          type: 'success',
        });
      } else {
        toaster.create({
          title: 'Local & Network Sync Complete',
          description:
            'No additional branch manifests found. Click "Open on SteamDB" to browse all historical versions.',
          type: 'info',
        });
      }
    } catch (err) {
      console.error('Failed to sync manifests:', err);
      toaster.create({
        title: 'Sync Notice',
        description: String(err),
        type: 'warning',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportPastedTable = () => {
    if (detectedManifests.length === 0) {
      toaster.create({
        title: 'No Manifests Detected',
        description:
          'Could not find any 64-bit manifest numbers in the pasted text. Check your copied table.',
        type: 'warning',
      });
      return;
    }

    const added = saveMultipleCustomVersions(game.appid, activeDepot, detectedManifests);
    refreshVersions();
    setImportText('');
    setShowImportModal(false);

    if (detectedManifests.length > 0 && !selectedManifestId) {
      onSelectVersion(detectedManifests[0]);
    }

    toaster.create({
      title: 'Import Successful',
      description: `Imported ${detectedManifests.length} manifests from SteamDB (${added} newly added).`,
      type: 'success',
    });
  };

  const handlePrefillFromPatchNote = (note: SteamPatchNote) => {
    const versionLabel = note.version_tag ? `${note.version_tag}` : note.title;
    setNewVersionName(versionLabel);
    setNewDescription(`Official Steam announcement: ${note.title}`);
    setShowAddForm(true);
    toaster.create({
      title: 'Patch Details Prefilled',
      description: `Enter the matching Manifest ID from SteamDB for "${versionLabel}".`,
      type: 'info',
    });
  };

  const handleSaveCustom = () => {
    if (!newVersionName.trim() || !newManifestId.trim()) {
      toaster.create({
        title: 'Missing information',
        description: 'Please provide both a Version Name and Manifest ID.',
        type: 'warning',
      });
      return;
    }

    const customVer: BuildVersion = {
      id: `custom_${Date.now()}`,
      versionName: newVersionName.trim(),
      manifestId: newManifestId.trim(),
      buildId: newBuildId.trim() || undefined,
      description: newDescription.trim() || undefined,
      isCanonical: false,
    };

    saveCustomVersion(game.appid, activeDepot, customVer);
    refreshVersions();
    onSelectVersion(customVer);
    setNewVersionName('');
    setNewManifestId('');
    setNewBuildId('');
    setNewDescription('');
    setShowAddForm(false);
    toaster.create({
      title: 'Version Saved & Selected',
      description: `Added "${customVer.versionName}" to your version browser.`,
      type: 'success',
    });
  };

  const handleDeleteCustom = (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomVersion(game.appid, activeDepot, versionId);
    refreshVersions();
    toaster.create({
      title: 'Version Removed',
      type: 'info',
    });
  };

  const handleClearAllCustom = () => {
    clearCustomVersions(game.appid, activeDepot);
    refreshVersions();
    toaster.create({
      title: 'Imported Versions Cleared',
      description: `Reset Depot ${activeDepot} to default presets.`,
      type: 'info',
    });
  };

  const steamDbManifestsUrl = `https://steamdb.info/depot/${activeDepot}/manifests/`;
  const steamDbPatchesUrl = `https://steamdb.info/app/${game.appid}/patchnotes/`;

  const hasImportedVersions = versions.some(
    (v) => v.id.startsWith('steamdb_') || v.id.startsWith('custom_') || v.id.startsWith('local_') || v.id.startsWith('log_')
  );

  return (
    <VStack gap={5} align="stretch">
      {/* Installed Build Status Card */}
      <Box
        p={4}
        rounded="xl"
        bg="bg.muted"
        borderWidth="1px"
        borderColor="border.subtle"
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          gap={3}
        >
          <Box>
            <HStack gap={2} mb={1}>
              <Badge colorPalette="green" variant="solid" size="sm">
                Active Local Build
              </Badge>
              <Text fontSize="sm" fontWeight="bold">
                Build ID: {game.build_id}
              </Text>
            </HStack>
            <Text fontSize="xs" color="fg.muted">
              Installed Manifest for Depot {activeDepot}:{' '}
              <Code fontSize="xs">{currentManifest}</Code>
            </Text>
          </Box>

          <HStack gap={2}>
            <Button
              size="xs"
              variant="outline"
              colorPalette={palette}
              asChild
            >
              <a
                href={steamDbPatchesUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LuExternalLink /> SteamDB Builds
              </a>
            </Button>
            <Button
              size="xs"
              variant="outline"
              colorPalette="purple"
              asChild
            >
              <a
                href={steamDbManifestsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LuExternalLink /> Depot Manifests
              </a>
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* Depot Switcher */}
      <Box>
        <Flex justify="space-between" align="center" mb={2}>
          <HStack gap={1.5}>
            <LuLayers />
            <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
              Installed Depots (Switch Depot)
            </Text>
          </HStack>
          <Text fontSize="xs" color="fg.muted">
            {depotKeys.length} {depotKeys.length === 1 ? 'depot' : 'depots'} detected
          </Text>
        </Flex>

        <Flex gap={2} wrap="wrap">
          {depotKeys.map((depotId) => {
            const isSelected = activeDepot === depotId;
            const label = getDepotLabel(game.appid, depotId);
            const manifest = game.mounted_depots[depotId];

            return (
              <Button
                key={depotId}
                size="sm"
                variant={isSelected ? 'solid' : 'subtle'}
                colorPalette={isSelected ? palette : 'gray'}
                onClick={() => onSelectDepot(depotId)}
                textAlign="left"
              >
                <Box>
                  <Text fontWeight="semibold">{label}</Text>
                  <Text fontSize="2xs" opacity={0.8}>
                    Manifest: {manifest?.slice(0, 12)}...
                  </Text>
                </Box>
              </Button>
            );
          })}
        </Flex>
      </Box>

      {/* Version Browser Section */}
      <Box>
        {/* Automatic Clipboard Detection Banner */}
        {pendingClipboardManifests.length > 0 && (
          <Box
            p={3.5}
            rounded="xl"
            bg="cyan.500/10"
            borderWidth="1px"
            borderColor="cyan.500"
            mb={4}
          >
            <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
              <HStack gap={2}>
                <LuClipboardPaste color="var(--chakra-colors-cyan-400)" size={18} />
                <Box>
                  <Text fontSize="xs" fontWeight="bold">
                    Detected {pendingClipboardManifests.length} SteamDB manifests on your clipboard!
                  </Text>
                  <Text fontSize="2xs" color="fg.muted">
                    Copied from SteamDB: ready to import directly into Depot {activeDepot}.
                  </Text>
                </Box>
              </HStack>
              <HStack gap={2}>
                <Button
                  size="2xs"
                  variant="ghost"
                  onClick={() => setPendingClipboardManifests([])}
                >
                  Dismiss
                </Button>
                <Button
                  size="xs"
                  colorPalette="cyan"
                  onClick={applyPendingClipboardManifests}
                >
                  <LuCheck /> Import {pendingClipboardManifests.length} Manifests
                </Button>
              </HStack>
            </Flex>
          </Box>
        )}

        <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
          <Box>
            <Heading size="sm">Available Builds & Versions</Heading>
            <Text fontSize="xs" color="fg.muted">
              Select a version below to install or switch Depot {activeDepot}.
            </Text>
          </Box>

          <HStack gap={2} wrap="wrap">
            {/* Quick 1-click clipboard paste: Zero typing! */}
            <Button
              size="xs"
              variant="solid"
              colorPalette="cyan"
              onClick={handleQuickClipboardImport}
              title="Reads manifests directly from clipboard (Copy on SteamDB -> Click here)"
            >
              <LuClipboardPaste /> Quick Paste from Clipboard
            </Button>

            {/* Direct browser link */}
            <Button
              size="xs"
              variant="outline"
              colorPalette="purple"
              asChild
            >
              <a
                href={steamDbManifestsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LuExternalLink /> Open on SteamDB
              </a>
            </Button>

            {/* Sync local disk depotcache and Steam public branch */}
            <Button
              size="xs"
              variant="subtle"
              colorPalette={palette}
              loading={isSyncing}
              onClick={handleSyncOnline}
              title="Search local depotcache on disk, past logs, and Steam network"
            >
              <LuCloudDownload /> Sync Local / Steam
            </Button>

            <Button
              size="xs"
              variant="subtle"
              colorPalette="purple"
              loading={isLoadingNotes}
              onClick={() => {
                if (showPatchNotes) {
                  setShowPatchNotes(false);
                } else if (patchNotes.length === 0) {
                  loadPatchNotes();
                } else {
                  setShowPatchNotes(true);
                }
              }}
            >
              <LuBookOpen />
              {showPatchNotes ? 'Hide Steam Patches' : 'Steam Patch Notes'}
            </Button>

            <Button
              size="xs"
              variant="ghost"
              colorPalette="gray"
              onClick={() => setShowImportModal(!showImportModal)}
            >
              {showImportModal ? 'Close Box' : 'Manual Paste'}
            </Button>

            <Button
              size="xs"
              variant="outline"
              colorPalette={palette}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <LuPlus />
              {showAddForm ? 'Cancel' : 'Add Single'}
            </Button>
          </HStack>
        </Flex>

        {/* 1-Click SteamDB Table Importer Panel */}
        {showImportModal && (
          <Box
            p={4}
            rounded="xl"
            bg="bg.muted"
            borderWidth="1px"
            borderColor="cyan.500"
            mb={4}
          >
            <Flex justify="space-between" align="center" mb={2}>
              <HStack gap={2}>
                <LuSparkles color="var(--chakra-colors-cyan-400)" />
                <Heading size="xs">Import Manifests from SteamDB</Heading>
              </HStack>
              <Button
                size="xs"
                variant="outline"
                colorPalette="cyan"
                asChild
              >
                <a
                  href={steamDbManifestsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LuExternalLink /> Open SteamDB Manifests
                </a>
              </Button>
            </Flex>

            <Text fontSize="xs" color="fg.muted" mb={3}>
              <strong>Fastest way:</strong> Click <strong>"Open SteamDB Manifests"</strong>, press{' '}
              <strong>Ctrl+A &amp; Ctrl+C</strong> on that page, then click{' '}
              <strong>"Quick Paste from Clipboard"</strong> above. Or paste the table text below:
            </Text>

            <Textarea
              rows={4}
              fontSize="xs"
              placeholder="Paste copied SteamDB table rows, HTML, or manifest lines here..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              mb={3}
            />

            <Flex justify="space-between" align="center">
              <HStack gap={2}>
                {detectedManifests.length > 0 ? (
                  <Badge colorPalette="green" variant="solid" size="sm">
                    {detectedManifests.length} manifests detected ready to import
                  </Badge>
                ) : (
                  <Text fontSize="xs" color="fg.muted">
                    Paste text above to detect manifests
                  </Text>
                )}
              </HStack>

              <HStack gap={2}>
                <Button size="xs" variant="ghost" onClick={() => setShowImportModal(false)}>
                  Cancel
                </Button>
                <Button
                  size="xs"
                  colorPalette="cyan"
                  disabled={detectedManifests.length === 0}
                  onClick={handleImportPastedTable}
                >
                  <LuClipboardPaste /> Import {detectedManifests.length} Manifests
                </Button>
              </HStack>
            </Flex>
          </Box>
        )}

        {/* Add Custom Version Form */}
        {showAddForm && (
          <Box
            p={4}
            rounded="xl"
            bg="bg.muted"
            borderWidth="1px"
            borderColor={colorHex}
            mb={4}
          >
            <Heading size="xs" mb={2}>
              Add Custom Version for Depot {activeDepot}
            </Heading>
            <Text fontSize="xs" color="fg.muted" mb={3}>
              You can find any historical Manifest ID on{' '}
              <a
                href={steamDbManifestsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: colorHex, textDecoration: 'underline' }}
              >
                SteamDB for Depot {activeDepot}
              </a>
              .
            </Text>

            <Stack gap={3} direction={{ base: 'column', md: 'row' }} mb={3}>
              <Box flex="1.5">
                <Text fontSize="xs" fontWeight="semibold" mb={1}>
                  Version Name *
                </Text>
                <Input
                  placeholder="e.g. Patch 1.04 or Update 2.1"
                  size="sm"
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                />
              </Box>

              <Box flex="2">
                <Text fontSize="xs" fontWeight="semibold" mb={1}>
                  Manifest ID *
                </Text>
                <Input
                  placeholder="Paste 64-bit Manifest ID from SteamDB..."
                  size="sm"
                  value={newManifestId}
                  onChange={(e) => setNewManifestId(e.target.value)}
                />
              </Box>

              <Box flex="1">
                <Text fontSize="xs" fontWeight="semibold" mb={1}>
                  Build ID (Optional)
                </Text>
                <Input
                  placeholder="e.g. 14210450"
                  size="sm"
                  value={newBuildId}
                  onChange={(e) => setNewBuildId(e.target.value)}
                />
              </Box>
            </Stack>

            <Box mb={3}>
              <Text fontSize="xs" fontWeight="semibold" mb={1}>
                Modding Note / Description (Optional)
              </Text>
              <Input
                placeholder="e.g. Recommended version for script mods and F4SE"
                size="sm"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </Box>

            <Flex justify="flex-end" gap={2}>
              <Button size="xs" variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button size="xs" colorPalette={palette} onClick={handleSaveCustom}>
                Save & Select Version
              </Button>
            </Flex>
          </Box>
        )}

        {/* Live Steam Patch Notes Explorer */}
        {showPatchNotes && patchNotes.length > 0 && (
          <Box
            p={4}
            rounded="xl"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="purple.500"
            mb={4}
            maxH="280px"
            overflowY="auto"
          >
            <HStack justify="space-between" mb={2} wrap="wrap" gap={2}>
              <HStack gap={1.5}>
                <LuTag color="var(--chakra-colors-purple-500)" />
                <Heading size="xs">Official Steam Announcements & Patches</Heading>
              </HStack>

              <HStack gap={2}>
                <HStack gap={1} fontSize="2xs" color="fg.muted">
                  <LuGlobe size={11} />
                  <span>Language:</span>
                </HStack>
                <AppSelect
                  value={patchNoteLang}
                  onChange={(val) => {
                    setPatchNoteLang(val);
                    setUserLanguage(val);
                  }}
                  size="xs"
                  minWidth="130px"
                  options={[
                    { value: 'auto', label: 'Auto (System)' },
                    { value: 'en', label: 'English' },
                    { value: 'es', label: 'Español' },
                    { value: 'de', label: 'Deutsch' },
                    { value: 'fr', label: 'Français' },
                    { value: 'ru', label: 'Русский' },
                    { value: 'zh', label: 'Chinese (中文)' },
                    { value: 'ja', label: 'Japanese (日本語)' },
                    { value: 'ko', label: 'Korean (한국어)' },
                    { value: 'all', label: 'All Languages' },
                  ]}
                />
                <Text fontSize="2xs" color="fg.muted">
                  ({visiblePatchNotes.length} of {patchNotes.length})
                </Text>
              </HStack>
            </HStack>

            <VStack gap={2} align="stretch">
              {visiblePatchNotes.length === 0 ? (
                <Box
                  p={3}
                  rounded="lg"
                  bg="bg.muted"
                  textAlign="center"
                  fontSize="xs"
                  color="fg.muted"
                >
                  No patch notes found matching language filter "{patchNoteLang}". Select "All Languages" or switch language above to view others.
                </Box>
              ) : (
                visiblePatchNotes.map((note) => (
                  <Flex
                    key={note.gid}
                    p={2.5}
                    rounded="lg"
                    bg="bg.muted"
                    justify="space-between"
                    align="center"
                    fontSize="xs"
                    gap={3}
                  >
                    <Box minW={0} flex="1">
                      <HStack gap={2} mb={0.5} wrap="wrap">
                        {note.version_tag && (
                          <Badge size="xs" colorPalette="purple" variant="solid">
                            {note.version_tag}
                          </Badge>
                        )}
                        <Text fontWeight="semibold" truncate title={note.title}>
                          {note.title}
                        </Text>
                      </HStack>
                      <Text fontSize="2xs" color="fg.muted">
                        {formatDate(note.date)}
                      </Text>
                    </Box>

                    <HStack gap={2} flexShrink={0}>
                      <Button
                        size="2xs"
                        variant="subtle"
                        colorPalette={palette}
                        onClick={() => handlePrefillFromPatchNote(note)}
                      >
                        <LuPlus size={11} /> Add as Version
                      </Button>
                      <Button
                        size="2xs"
                        variant="ghost"
                        asChild
                      >
                        <a
                          href={note.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Notes <LuExternalLink size={10} />
                        </a>
                      </Button>
                    </HStack>
                  </Flex>
                ))
              )}
            </VStack>
          </Box>
        )}

        {/* Search & Filter Bar if multiple versions */}
        {versions.length > 5 && (
          <Box mb={3}>
            <Flex gap={2} align="center">
              <Box position="relative" flex="1">
                <Input
                  size="sm"
                  placeholder={`Search ${versions.length} versions by name, manifest ID, build, or date...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  pl={8}
                />
                <Box position="absolute" left={2.5} top="50%" transform="translateY(-50%)" color="fg.muted" pointerEvents="none">
                  <LuSearch size={14} />
                </Box>
              </Box>
              {searchQuery && (
                <Button size="xs" variant="ghost" onClick={() => setSearchQuery('')}>
                  Clear
                </Button>
              )}
            </Flex>
          </Box>
        )}

        {/* Versions Table / List */}
        <VStack gap={2.5} align="stretch">
          {versions.length === 0 ? (
            <Box
              p={6}
              rounded="xl"
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="border.subtle"
              textAlign="center"
              color="fg.muted"
            >
              <Text fontSize="sm" mb={1}>
                No versions stored for Depot {activeDepot} yet.
              </Text>
              <Text fontSize="xs" mb={4}>
                Click <strong>"Open on SteamDB"</strong>, copy the manifests table, and click{' '}
                <strong>"Quick Paste from Clipboard"</strong> to populate all past manifests
                instantly.
              </Text>
              <HStack justify="center" gap={3}>
                <Button
                  size="sm"
                  colorPalette="cyan"
                  onClick={handleQuickClipboardImport}
                >
                  <LuClipboardPaste /> Quick Paste from Clipboard
                </Button>
                <Button
                  size="sm"
                  colorPalette="purple"
                  variant="subtle"
                  asChild
                >
                  <a
                    href={steamDbManifestsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <LuExternalLink /> Open on SteamDB
                  </a>
                </Button>
              </HStack>
            </Box>
          ) : filteredVersions.length === 0 ? (
            <Box
              p={6}
              rounded="xl"
              borderWidth="1px"
              borderColor="border.subtle"
              textAlign="center"
              color="fg.muted"
            >
              <Text fontSize="sm" mb={1}>
                No versions match "{searchQuery}".
              </Text>
              <Button size="xs" variant="subtle" mt={2} onClick={() => setSearchQuery('')}>
                Clear Search Filter
              </Button>
            </Box>
          ) : (
            paginatedVersions.map((ver) => {
              const isCurrent = ver.manifestId === currentManifest;
              const isSelected = selectedManifestId === ver.manifestId;
              const isImported = ver.id.startsWith('steamdb_') || ver.id.startsWith('steamcmd_');
              const isLocal = ver.id.startsWith('local_') || ver.id.startsWith('log_');
              const isCustom = ver.id.startsWith('custom_');

              return (
                <Flex
                  key={ver.id}
                  p={3.5}
                  rounded="xl"
                  borderWidth="1px"
                  borderColor={
                    isSelected
                      ? colorHex
                      : isCurrent
                      ? 'green.500'
                      : 'border.subtle'
                  }
                  bg={
                    isSelected
                      ? `${palette}.500/10`
                      : isCurrent
                      ? 'green.500/10'
                      : 'bg.panel'
                  }
                  transition="all 0.2s ease"
                  cursor="pointer"
                  onClick={() => onSelectVersion(ver)}
                  justify="space-between"
                  align="center"
                  gap={4}
                  _hover={{
                    borderColor: colorHex,
                  }}
                >
                  <Box minW={0} flex="1">
                    <HStack gap={2} mb={1} wrap="wrap">
                      <Heading size="xs" fontWeight="bold">
                        {ver.versionName}
                      </Heading>
                      {isCurrent && (
                        <Badge size="xs" colorPalette="green" variant="solid">
                          Currently Installed
                        </Badge>
                      )}
                      {isSelected && !isCurrent && (
                        <Badge size="xs" colorPalette={palette} variant="solid">
                          Target Version
                        </Badge>
                      )}
                      {ver.isCanonical && !isImported && !isLocal && (
                        <Badge size="xs" colorPalette="purple" variant="subtle">
                          Preset Version
                        </Badge>
                      )}
                      {isImported && (
                        <Badge size="xs" colorPalette="cyan" variant="subtle">
                          SteamDB / Synced
                        </Badge>
                      )}
                      {isLocal && (
                        <Badge size="xs" colorPalette="teal" variant="subtle">
                          Local Depotcache
                        </Badge>
                      )}
                      {isCustom && (
                        <Badge size="xs" colorPalette="orange" variant="subtle">
                          Custom
                        </Badge>
                      )}
                      {ver.description?.includes('Matched with Steam update') && (
                        <Badge size="xs" colorPalette="green" variant="subtle">
                          Matched Patch
                        </Badge>
                      )}
                      {ver.description?.includes('Estimated') && (
                        <Badge size="xs" colorPalette="purple" variant="subtle">
                          Estimated Rev
                        </Badge>
                      )}
                      {ver.buildId && (
                        <Badge size="xs" colorPalette="gray" variant="subtle">
                          Build {ver.buildId}
                        </Badge>
                      )}
                      {ver.releaseDate && (
                        <Text fontSize="2xs" color="fg.muted">
                          • Released {ver.releaseDate}
                        </Text>
                      )}
                    </HStack>

                    <HStack gap={2} fontSize="xs" color="fg.muted" mb={ver.description ? 1 : 0}>
                      <Text>Manifest ID:</Text>
                      <Code fontSize="xs" colorPalette="purple">
                        {ver.manifestId}
                      </Code>
                    </HStack>

                    {ver.description && (
                      <Text fontSize="xs" color="fg.muted">
                        {ver.description}
                      </Text>
                    )}
                  </Box>

                  <HStack gap={2} flexShrink={0}>
                    {!ver.isCanonical && (
                      <IconButton
                        size="xs"
                        variant="ghost"
                        colorPalette="red"
                        aria-label="Delete saved version"
                        onClick={(e) => handleDeleteCustom(ver.id, e)}
                      >
                        <LuTrash2 size={13} />
                      </IconButton>
                    )}

                    <Button
                      size="sm"
                      variant={isSelected ? 'solid' : 'subtle'}
                      colorPalette={isSelected ? palette : 'gray'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVersion(ver);
                      }}
                    >
                      {isSelected ? <LuCheck /> : <LuRotateCcw />}
                      {isSelected ? 'Selected' : 'Pick Version'}
                    </Button>
                  </HStack>
                </Flex>
              );
            })
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Flex justify="space-between" align="center" pt={3} pb={1} px={1} wrap="wrap" gap={2}>
              <Text fontSize="xs" color="fg.muted">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredVersions.length)} of {filteredVersions.length} versions
              </Text>
              <HStack gap={2}>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <LuChevronLeft /> Previous
                </Button>
                <Text fontSize="xs" fontWeight="semibold" px={1}>
                  Page {page} of {totalPages}
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <LuChevronRight />
                </Button>
              </HStack>
            </Flex>
          )}

          {hasImportedVersions && (
            <Flex justify="flex-end" pt={2}>
              <Button
                size="2xs"
                variant="ghost"
                colorPalette="red"
                onClick={handleClearAllCustom}
              >
                <LuTrash2 size={12} /> Clear Imported Versions for Depot {activeDepot}
              </Button>
            </Flex>
          )}
        </VStack>
      </Box>
    </VStack>
  );
}
