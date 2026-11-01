import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  LuArrowUp,
  LuFolder,
  LuFolderCheck,
  LuGamepad2,
  LuHardDrive,
} from 'react-icons/lu';
import { DirectoryListing } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { toaster } from '@/components/ui/toaster';
import { useAppAccent } from '@/utils/theme';

interface FolderBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (path: string) => void;
  initialPath?: string;
}

export function FolderBrowserModal({
  isOpen,
  onClose,
  onSelectFolder,
  initialPath,
}: FolderBrowserModalProps) {
  const { palette, colorHex } = useAppAccent();
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customInputPath, setCustomInputPath] = useState('');

  const navigateTo = async (path?: string) => {
    setIsLoading(true);
    try {
      const res = await invoke<DirectoryListing>('browse_directory', {
        path: path || null,
      });
      setListing(res);
      setCustomInputPath(res.current_path);
    } catch (err) {
      console.error('Failed to browse directory:', err);
      toaster.create({
        title: 'Could not access directory',
        description: String(err),
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      navigateTo(initialPath);
    }
  }, [isOpen]);

  const handleSelect = (path: string) => {
    onSelectFolder(path);
    onClose();
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="lg"
    >
      <DialogContent rounded="2xl" maxW="700px" p={5}>
        <DialogHeader p={0} mb={3}>
          <HStack justify="space-between">
            <DialogTitle fontSize="md" fontWeight="bold">
              Browse Drives & Steam Libraries
            </DialogTitle>
          </HStack>
          <DialogCloseTrigger top={4} insetEnd={4} />
        </DialogHeader>

        <DialogBody p={0}>
          <VStack gap={3} align="stretch">
            {/* Quick Drives / Mounts Jump Bar */}
            {listing && listing.drives.length > 0 && (
              <Box>
                <Text fontSize="2xs" fontWeight="bold" textTransform="uppercase" color="fg.muted" mb={1.5}>
                  Drives & Mounted Locations
                </Text>
                <Flex gap={1.5} wrap="wrap">
                  {listing.drives.map((d) => {
                    const isCurrent = listing.current_path.startsWith(d.path);
                    return (
                      <Button
                        key={d.path}
                        size="2xs"
                        variant={isCurrent ? 'solid' : 'subtle'}
                        colorPalette={d.is_steam_library ? 'green' : isCurrent ? palette : 'gray'}
                        onClick={() => navigateTo(d.path)}
                      >
                        <LuHardDrive />
                        {d.name}
                        {d.is_steam_library && (
                          <Badge size="xs" colorPalette="green" ml={1}>
                            Steam
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </Flex>
              </Box>
            )}

            {/* Navigation & Breadcrumbs Bar */}
            <HStack gap={2}>
              <IconButton
                size="sm"
                variant="subtle"
                aria-label="Up one directory"
                disabled={!listing?.parent_path}
                onClick={() => listing?.parent_path && navigateTo(listing.parent_path)}
              >
                <LuArrowUp />
              </IconButton>

              <Input
                size="sm"
                rounded="lg"
                value={customInputPath}
                onChange={(e) => setCustomInputPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigateTo(customInputPath);
                }}
                placeholder="Current folder path..."
              />

              <Button
                size="sm"
                variant="subtle"
                onClick={() => navigateTo(customInputPath)}
              >
                Go
              </Button>
            </HStack>

            {/* Directory Items List */}
            <Box
              minH="260px"
              maxH="340px"
              overflowY="auto"
              rounded="xl"
              borderWidth="1px"
              borderColor="border.subtle"
              bg="bg.muted"
              p={2}
            >
              {isLoading ? (
                <Flex justify="center" align="center" minH="240px">
                  <Spinner size="md" color={colorHex} />
                </Flex>
              ) : !listing || listing.items.length === 0 ? (
                <Flex justify="center" align="center" minH="240px" direction="column" color="fg.muted">
                  <LuFolder size={32} />
                  <Text fontSize="xs" mt={2}>
                    No subdirectories found in this folder.
                  </Text>
                </Flex>
              ) : (
                <VStack gap={1} align="stretch">
                  {listing.items.map((item) => (
                    <Flex
                      key={item.path}
                      p={2}
                      rounded="lg"
                      bg={item.is_steam_library ? 'green.500/10' : 'bg.panel'}
                      borderWidth="1px"
                      borderColor={item.is_steam_library ? 'green.500' : 'border.subtle'}
                      justify="space-between"
                      align="center"
                      cursor="pointer"
                      transition="all 0.15s ease"
                      onClick={() => navigateTo(item.path)}
                      _hover={{
                        borderColor: colorHex,
                        bg: 'bg.muted',
                      }}
                    >
                      <HStack gap={2.5} minW={0} flex="1">
                        {item.is_steam_library ? (
                          <LuFolderCheck color="var(--chakra-colors-green-500)" size={18} />
                        ) : (
                          <LuFolder color={colorHex} size={18} />
                        )}
                        <Text fontSize="xs" fontWeight={item.is_steam_library ? 'bold' : 'normal'} truncate>
                          {item.name}
                        </Text>
                        {item.is_steam_library && (
                          <Badge size="xs" colorPalette="green" variant="solid">
                            <LuGamepad2 style={{ marginRight: 3 }} /> Steam Library
                          </Badge>
                        )}
                      </HStack>

                      <Button
                        size="2xs"
                        variant={item.is_steam_library ? 'solid' : 'subtle'}
                        colorPalette={item.is_steam_library ? 'green' : palette}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(item.path);
                        }}
                      >
                        Select This
                      </Button>
                    </Flex>
                  ))}
                </VStack>
              )}
            </Box>
          </VStack>
        </DialogBody>

        <DialogFooter p={0} mt={3}>
          <HStack justify="space-between" width="100%">
            <Text fontSize="2xs" color="fg.muted" truncate maxW="360px">
              Current: {listing?.current_path}
            </Text>
            <HStack gap={2}>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                colorPalette={palette}
                onClick={() => listing && handleSelect(listing.current_path)}
              >
                Select Current Folder
              </Button>
            </HStack>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
