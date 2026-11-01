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
  LuCheck,
  LuCloudDownload,
  LuFolder,
  LuGlobe,
  LuHardDrive,
  LuPlus,
  LuRefreshCw,
  LuSparkles,
  LuTrash2,
} from 'react-icons/lu';
import { FolderBrowserModal } from './FolderBrowserModal';
import { getUserLanguage, setUserLanguage } from '@/utils/knownVersions';
import { checkUpdate, downloadAndApplyUpdate, UpdateState } from '@/utils/updater';
import { formatBytes } from '@/utils/format';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  steamPath: string | null;
  customPaths: string[];
  onAddCustomPath: (path: string) => void;
  onRemoveCustomPath: (path: string) => void;
  onRescan: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  steamPath,
  customPaths,
  onAddCustomPath,
  onRemoveCustomPath,
  onRescan,
}: SettingsModalProps) {
  const [newPath, setNewPath] = useState('');
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState(getUserLanguage());

  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '0.9.0',
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
                <select
                  value={preferredLanguage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPreferredLanguage(val);
                    setUserLanguage(val);
                    toaster.create({
                      title: 'Updated patch notes language preference',
                      description: `Language set to: ${val}`,
                      type: 'info',
                    });
                  }}
                  style={{
                    height: '32px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    padding: '0 10px',
                    background: 'var(--chakra-colors-bg-panel)',
                    color: 'var(--chakra-colors-fg)',
                    border: '1px solid var(--chakra-colors-border-subtle)',
                    outline: 'none',
                    width: '100%',
                    cursor: 'pointer',
                  }}
                >
                  <option value="auto">Auto (System Language)</option>
                  <option value="en">English</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="fr">Français (French)</option>
                  <option value="ru">Русский (Russian)</option>
                  <option value="zh">简体中文 (Chinese)</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="ko">한국어 (Korean)</option>
                  <option value="all">All Languages (No filtering)</option>
                </select>
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
                    colorPalette="blue"
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
                  <Button size="sm" colorPalette="blue" onClick={() => handleAdd()}>
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
                    <LuSparkles color="var(--chakra-colors-blue-500)" />
                    <Text fontSize="xs" fontWeight="semibold">
                      Steam Game Manager Updates
                    </Text>
                  </HStack>
                  <Badge size="xs" colorPalette="blue" variant="subtle">
                    v{updateState.currentVersion}
                  </Badge>
                </Flex>

                <Text fontSize="xs" color="fg.muted" mb={3}>
                  Check for new features, manifest scrapers, and game compatibility updates.
                </Text>

                {updateState.status === 'available' && (
                  <Box
                    p={3}
                    mb={3}
                    rounded="lg"
                    bg="blue.500/10"
                    borderWidth="1px"
                    borderColor="blue.500/30"
                  >
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="xs" fontWeight="bold" color="blue.400">
                        Version {updateState.newVersion} Available!
                      </Text>
                    </HStack>
                    {updateState.releaseNotes && (
                      <Text fontSize="2xs" color="fg.muted" mb={2}>
                        {updateState.releaseNotes}
                      </Text>
                    )}
                    <Button
                      size="xs"
                      colorPalette="blue"
                      onClick={handleInstallUpdate}
                    >
                      <LuCloudDownload /> Install & Restart
                    </Button>
                  </Box>
                )}

                {updateState.status === 'downloading' && (
                  <Box p={3} mb={3} rounded="lg" bg="bg.panel" borderWidth="1px" borderColor="blue.500">
                    <Flex justify="space-between" fontSize="xs" mb={1.5}>
                      <Text fontWeight="medium">Downloading Update...</Text>
                      <Text color="fg.muted">
                        {updateState.downloadProgress}% ({formatBytes(updateState.downloadedBytes)} / {formatBytes(updateState.totalBytes)})
                      </Text>
                    </Flex>
                    <Box w="100%" h="6px" bg="bg.muted" rounded="full" overflow="hidden">
                      <Box
                        h="100%"
                        bg="blue.500"
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

                <Flex justify="flex-end">
                  <Button
                    size="xs"
                    variant="subtle"
                    colorPalette="blue"
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
                  colorPalette="blue"
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
