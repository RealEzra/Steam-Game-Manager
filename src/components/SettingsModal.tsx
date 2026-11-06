import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
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
  LuBookOpen,
  LuCheck,
  LuCloudDownload,
  LuFolder,
  LuGlobe,
  LuHardDrive,
  LuLayoutGrid,
  LuMoon,
  LuPalette,
  LuPlus,
  LuRefreshCw,
  LuSparkles,
  LuSun,
  LuTrash2,
} from 'react-icons/lu';
import { FolderBrowserModal } from './FolderBrowserModal';
import { getUserLanguage, setUserLanguage } from '@/utils/knownVersions';
import { checkUpdate, downloadAndApplyUpdate, UpdateState } from '@/utils/updater';
import { formatBytes } from '@/utils/format';
import { useColorMode } from '@/components/ui/color-mode';
import { useAppAccent } from '@/utils/theme';
import { AppSelect } from '@/components/ui/AppSelect';
import { GridSize } from './FilterBar';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  steamPath: string | null;
  customPaths: string[];
  onAddCustomPath: (path: string) => void;
  onRemoveCustomPath: (path: string) => void;
  onRescan: () => void;
  gridSize?: GridSize;
  onGridSizeChange?: (size: GridSize) => void;
  onOpenChangelog?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  steamPath,
  customPaths,
  onAddCustomPath,
  onRemoveCustomPath,
  onRescan,
  gridSize = 'medium',
  onGridSizeChange,
  onOpenChangelog,
}: SettingsModalProps) {
  const [newPath, setNewPath] = useState('');
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState(getUserLanguage());
  const { colorMode, setColorMode } = useColorMode();
  const { accent, setAccent, themes, palette, colorHex } = useAppAccent();

  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '0.9.5',
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });

  const handleCheckUpdate = async () => {
    await checkUpdate((partial) => {
      setUpdateState((prev) => ({ ...prev, ...partial }));
    }, true);
  };

  const handleInstallUpdate = async () => {
    await downloadAndApplyUpdate((partial) => {
      setUpdateState((prev) => ({ ...prev, ...partial }));
    });
  };

  const handleAdd = (pathToAdd?: string) => {
    const trimmed = (pathToAdd || newPath).trim();
    if (!trimmed) return;
    if (customPaths.includes(trimmed)) {
      toaster.create({
        title: 'Path already added',
        type: 'warning',
      });
      return;
    }
    onAddCustomPath(trimmed);
    setNewPath('');
    toaster.create({
      title: 'Added custom library path',
      description: trimmed,
      type: 'success',
    });
  };

  const handleFolderBrowserSelect = (selectedPath: string) => {
    setNewPath(selectedPath);
    handleAdd(selectedPath);
  };

  return (
    <>
      <DialogRoot
        open={isOpen}
        onOpenChange={(e) => {
          if (!e.open) onClose();
        }}
        size="md"
      >
        <DialogContent rounded="2xl" p={6}>
          <DialogHeader p={0} mb={4}>
            <DialogTitle fontSize="lg" fontWeight="bold">
              Steam & Library Settings
            </DialogTitle>
            <DialogCloseTrigger top={4} insetEnd={4} />
          </DialogHeader>

          <DialogBody p={0}>
            <VStack gap={5} align="stretch">
              {/* Auto-detected Steam Path */}
              <Box
                p={3.5}
                rounded="xl"
                bg="bg.muted"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <HStack gap={2} mb={1}>
                  <LuHardDrive />
                  <Text fontSize="xs" fontWeight="semibold">
                    Detected Steam Installation
                  </Text>
                </HStack>
                <Text fontSize="xs" color="fg.muted" wordBreak="break-all">
                  {steamPath || 'No default Steam installation found automatically.'}
                </Text>
              </Box>

              {/* Appearance & Color Themes */}
              <Box
                p={3.5}
                rounded="xl"
                bg="bg.muted"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <HStack gap={2} mb={1}>
                  <LuPalette />
                  <Text fontSize="xs" fontWeight="semibold">
                    App Theme & Accent Color
                  </Text>
                </HStack>
                <Text fontSize="xs" color="fg.muted" mb={3}>
                  Customize the interface appearance and choose your favorite color scheme.
                </Text>

                {/* Color Mode Toggle */}
                <HStack gap={2} mb={3}>
                  <Button
                    size="xs"
                    variant={colorMode === 'dark' ? 'solid' : 'outline'}
                    colorPalette={colorMode === 'dark' ? palette : 'gray'}
                    onClick={() => setColorMode('dark')}
                  >
                    <LuMoon /> Dark Mode
                  </Button>
                  <Button
                    size="xs"
                    variant={colorMode === 'light' ? 'solid' : 'outline'}
                    colorPalette={colorMode === 'light' ? palette : 'gray'}
                    onClick={() => setColorMode('light')}
                  >
                    <LuSun /> Light Mode
                  </Button>
                </HStack>

                {/* Accent Color Swatches */}
                <Text fontSize="2xs" color="fg.muted" fontWeight="semibold" mb={1.5}>
                  ACCENT COLOR PRESET
                </Text>
                <HStack gap={2} wrap="wrap">
                  {themes.map((th) => {
                    const isSelected = accent === th.id;
                    return (
                      <Flex
                        key={th.id}
                        as="button"
                        align="center"
                        gap={1.5}
                        px={2.5}
                        py={1}
                        rounded="lg"
                        borderWidth="2px"
                        borderColor={isSelected ? th.colorHex : 'transparent'}
                        bg="bg.panel"
                        cursor="pointer"
                        transition="all 0.15s ease"
                        _hover={{ borderColor: th.colorHex }}
                        onClick={() => {
                          setAccent(th.id);
                          toaster.create({
                            title: `Theme accent set to ${th.name}`,
                            type: 'info',
                          });
                        }}
                      >
                        <Box w="12px" h="12px" rounded="full" bg={th.colorHex} />
                        <Text fontSize="xs" fontWeight={isSelected ? 'bold' : 'normal'}>
                          {th.name}
                        </Text>
                        {isSelected && <LuCheck size={12} color={th.colorHex} />}
                      </Flex>
                    );
                  })}
                </HStack>
              </Box>

              {/* Game Grid Layout Size */}
              <Box
                p={3.5}
                rounded="xl"
                bg="bg.muted"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <HStack gap={2} mb={1}>
                  <LuLayoutGrid />
                  <Text fontSize="xs" fontWeight="semibold">
                    Game Library Grid Size
                  </Text>
                </HStack>
                <Text fontSize="xs" color="fg.muted" mb={3}>
                  Adjust the poster dimensions and card density for browsing your game collection.
                </Text>

                <HStack gap={2}>
                  <Button
                    size="xs"
                    variant={gridSize === 'compact' ? 'solid' : 'outline'}
                    colorPalette={gridSize === 'compact' ? palette : 'gray'}
                    onClick={() => onGridSizeChange?.('compact')}
                  >
                    Compact (Small)
                  </Button>
                  <Button
                    size="xs"
                    variant={gridSize === 'medium' ? 'solid' : 'outline'}
                    colorPalette={gridSize === 'medium' ? palette : 'gray'}
                    onClick={() => onGridSizeChange?.('medium')}
                  >
                    Standard (Medium)
                  </Button>
                  <Button
                    size="xs"
                    variant={gridSize === 'large' ? 'solid' : 'outline'}
                    colorPalette={gridSize === 'large' ? palette : 'gray'}
                    onClick={() => onGridSizeChange?.('large')}
                  >
                    Posters (Large)
                  </Button>
                </HStack>
              </Box>

              {/* Patch Notes Language Preference */}
              <Box
                p={3.5}
                rounded="xl"
                bg="bg.muted"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <HStack gap={2} mb={1}>
                  <LuGlobe />
                  <Text fontSize="xs" fontWeight="semibold">
                    Patch Notes & Announcements Language
                  </Text>
                </HStack>
                <Text fontSize="xs" color="fg.muted" mb={2.5}>
                  Filters Steam community announcements and ensures manifests match patch notes in your preferred language.
                </Text>
                <AppSelect
                  value={preferredLanguage}
                  onChange={(val) => {
                    setPreferredLanguage(val);
                    setUserLanguage(val);
                    toaster.create({
                      title: 'Updated patch notes language preference',
                      description: `Language set to: ${val}`,
                      type: 'info',
                    });
                  }}
                  width="100%"
                  options={[
                    { value: 'auto', label: 'Auto (System Language)' },
                    { value: 'en', label: 'English' },
                    { value: 'es', label: 'Español (Spanish)' },
                    { value: 'de', label: 'Deutsch (German)' },
                    { value: 'fr', label: 'Français (French)' },
                    { value: 'ru', label: 'Русский (Russian)' },
                    { value: 'zh', label: 'Chinese (Simplified) - 中文' },
                    { value: 'ja', label: 'Japanese - 日本語' },
                    { value: 'ko', label: 'Korean - 한국어' },
                    { value: 'all', label: 'All Languages (No filtering)' },
                  ]}
                />
              </Box>

              {/* Custom Steam Library Folders */}
              <Box>
                <Flex justify="space-between" align="center" mb={1.5}>
                  <Text fontSize="xs" fontWeight="semibold">
                    Custom Steam Libraries / Drive Folders
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    colorPalette={palette}
                    onClick={() => setIsFolderBrowserOpen(true)}
                  >
                    <LuFolder /> Browse Drives & Folders
                  </Button>
                </Flex>
                <Text fontSize="xs" color="fg.muted" mb={3}>
                  Add extra SteamLibrary folders or drives that were not automatically detected.
                </Text>

                <HStack gap={2} mb={3}>
                  <Input
                    placeholder="Enter path or click Browse..."
                    size="sm"
                    rounded="lg"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAdd();
                    }}
                  />
                  <Button size="sm" colorPalette={palette} onClick={() => handleAdd()}>
                    <LuPlus /> Add
                  </Button>
                </HStack>

                {customPaths.length === 0 ? (
                  <Box
                    p={4}
                    rounded="lg"
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderColor="border.subtle"
                    textAlign="center"
                    color="fg.muted"
                    fontSize="xs"
                  >
                    No custom paths added yet. Click "Browse Drives & Folders" to find library folders.
                  </Box>
                ) : (
                  <VStack gap={2} align="stretch">
                    {customPaths.map((p) => (
                      <Flex
                        key={p}
                        p={2.5}
                        rounded="lg"
                        bg="bg.panel"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        justify="space-between"
                        align="center"
                      >
                        <Text fontSize="xs" truncate title={p}>
                          {p}
                        </Text>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          aria-label="Remove path"
                          onClick={() => onRemoveCustomPath(p)}
                        >
                          <LuTrash2 size={13} />
                        </IconButton>
                      </Flex>
                    ))}
                  </VStack>
                )}
              </Box>

              {/* Application Updates */}
              <Box
                p={3.5}
                rounded="xl"
                bg="bg.muted"
                borderWidth="1px"
                borderColor="border.subtle"
              >
                <Flex justify="space-between" align="center" mb={1}>
                  <HStack gap={2}>
                    <LuSparkles color={colorHex} />
                    <Text fontSize="xs" fontWeight="semibold">
                      Steam Game Manager Updates
                    </Text>
                  </HStack>
                  <Badge size="xs" colorPalette={palette} variant="subtle">
                    v{updateState.currentVersion}
                  </Badge>
                </Flex>

                <Text fontSize="xs" color="fg.muted" mb={3}>
                  Check for new features, manifest scrapers, and game compatibility updates.
                </Text>

                {updateState.status === 'available' && (
                  <Box
                    p={3.5}
                    mb={3}
                    rounded="lg"
                    bg={`${palette}.500/10`}
                    borderWidth="1px"
                    borderColor={`${palette}.500/30`}
                  >
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="xs" fontWeight="bold" color={`${palette}.400`}>
                        Version {updateState.newVersion} Available!
                      </Text>
                      {onOpenChangelog && (
                        <Button
                          size="2xs"
                          variant="ghost"
                          onClick={onOpenChangelog}
                        >
                          <LuBookOpen /> View All Changes
                        </Button>
                      )}
                    </HStack>
                    {updateState.releaseNotes && (
                      <Box
                        maxH="180px"
                        overflowY="auto"
                        bg="bg.panel"
                        p={2.5}
                        rounded="md"
                        fontSize="2xs"
                        whiteSpace="pre-wrap"
                        color="fg"
                        borderWidth="1px"
                        borderColor="border.subtle"
                        mb={3}
                      >
                        {updateState.releaseNotes}
                      </Box>
                    )}
                    <Button
                      size="xs"
                      colorPalette={palette}
                      onClick={handleInstallUpdate}
                    >
                      <LuCloudDownload /> Install & Restart
                    </Button>
                  </Box>
                )}

                {updateState.status === 'downloading' && (
                  <Box p={3} mb={3} rounded="lg" bg="bg.panel" borderWidth="1px" borderColor={`${palette}.500`}>
                    <Flex justify="space-between" fontSize="xs" mb={1.5}>
                      <Text fontWeight="medium">Downloading Update...</Text>
                      <Text color="fg.muted">
                        {updateState.downloadProgress}% ({formatBytes(updateState.downloadedBytes)} / {formatBytes(updateState.totalBytes)})
                      </Text>
                    </Flex>
                    <Box w="100%" h="6px" bg="bg.muted" rounded="full" overflow="hidden">
                      <Box
                        h="100%"
                        bg={colorHex}
                        rounded="full"
                        transition="width 0.2s ease"
                        style={{ width: `${updateState.downloadProgress}%` }}
                      />
                    </Box>
                  </Box>
                )}

                {updateState.status === 'ready' && (
                  <Box p={3} mb={3} rounded="lg" bg="green.500/10" borderWidth="1px" borderColor="green.500/30">
                    <HStack gap={2} color="green.400" fontSize="xs" fontWeight="medium">
                      <LuCheck /> Update ready. Restarting application...
                    </HStack>
                  </Box>
                )}

                {updateState.status === 'up-to-date' && (
                  <HStack gap={2} mb={2} color="green.400" fontSize="xs">
                    <LuCheck /> You are running the latest version.
                  </HStack>
                )}

                <Flex justify="space-between" align="center" mt={1}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      onOpenChangelog?.();
                    }}
                  >
                    <LuBookOpen /> View Full Changelog
                  </Button>

                  <Button
                    size="xs"
                    variant="subtle"
                    colorPalette={palette}
                    loading={updateState.status === 'checking'}
                    onClick={handleCheckUpdate}
                  >
                    <LuRefreshCw /> Check for Updates
                  </Button>
                </Flex>
              </Box>

              <Flex justify="flex-end" gap={2} mt={2}>
                <Button
                  size="sm"
                  variant="solid"
                  colorPalette={palette}
                  onClick={() => {
                    onRescan();
                    onClose();
                  }}
                >
                  Save & Rescan
                </Button>
              </Flex>
            </VStack>
          </DialogBody>
        </DialogContent>
      </DialogRoot>

      {/* Directory Browser Modal */}
      <FolderBrowserModal
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onSelectFolder={handleFolderBrowserSelect}
        initialPath={newPath || steamPath || undefined}
      />
    </>
  );
}
