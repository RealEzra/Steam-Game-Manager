import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Text,
} from '@chakra-ui/react';
import { ColorModeButton } from '@/components/ui/color-mode';
import { LuBookOpen, LuFolderSync, LuHardDrive, LuLayers, LuSettings } from 'react-icons/lu';
import { useAppAccent } from '@/utils/theme';

interface HeaderProps {
  steamPath: string | null;
  totalGames: number;
  totalLibraries: number;
  isScanning: boolean;
  onScan: () => void;
  onOpenSettings: () => void;
  onOpenChangelog?: () => void;
  onOpenStorageManager?: () => void;
}

export function Header({
  steamPath,
  totalGames,
  totalLibraries,
  isScanning,
  onScan,
  onOpenSettings,
  onOpenChangelog,
  onOpenStorageManager,
}: HeaderProps) {
  const { palette } = useAppAccent();

  return (
    <Box
      data-tauri-drag-region
      onContextMenu={(e) => e.preventDefault()}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      bg="bg.panel"
      px={{ base: 4, md: 8 }}
      py={3.5}
      position="sticky"
      top="32px"
      zIndex={20}
      backdropFilter="blur(10px)"
    >
      <Flex
        data-tauri-drag-region
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'flex-start', md: 'center' }}
        justify="space-between"
        gap={4}
      >
        <HStack gap={3}>
          <Box
            rounded="xl"
            overflow="hidden"
            boxShadow="sm"
            w="42px"
            h="42px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <img src="/app-icon.svg" width="42" height="42" alt="Steam Game Manager" />
          </Box>
          <Box>
            <HStack gap={2}>
              <Heading size="lg" fontWeight="bold" letterSpacing="tight">
                Steam Game Manager
              </Heading>
            </HStack>
            <HStack gap={2} mt={0.5}>
              {steamPath ? (
                <Badge colorPalette="green" variant="subtle" size="xs">
                  <LuHardDrive style={{ marginRight: 4 }} />
                  Steam: {steamPath.length > 35 ? '...' + steamPath.slice(-32) : steamPath}
                </Badge>
              ) : (
                <Badge colorPalette="orange" variant="subtle" size="xs">
                  No default Steam path
                </Badge>
              )}
              <Text fontSize="xs" color="fg.muted">
                {totalGames} {totalGames === 1 ? 'game' : 'games'} • {totalLibraries} {totalLibraries === 1 ? 'drive' : 'drives'}
              </Text>
            </HStack>
          </Box>
        </HStack>

        <HStack gap={2} wrap="wrap">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Storage Manager"
            onClick={onOpenStorageManager}
            title="Manage Vault profiles and backups across all games"
          >
            <LuLayers />
            Storage
          </Button>

          <Button
            size="sm"
            variant="ghost"
            aria-label="Changelog"
            onClick={onOpenChangelog}
          >
            <LuBookOpen />
            Changelog
          </Button>

          <Button
            size="sm"
            variant="subtle"
            colorPalette={palette}
            loading={isScanning}
            onClick={onScan}
          >
            <LuFolderSync />
            Scan Drives
          </Button>

          <Button
            size="sm"
            variant="ghost"
            aria-label="Settings"
            onClick={onOpenSettings}
          >
            <LuSettings />
            Settings
          </Button>

          <ColorModeButton />
        </HStack>
      </Flex>
    </Box>
  );
}
