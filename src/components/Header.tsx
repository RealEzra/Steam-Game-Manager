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
import { LuFolderSync, LuGamepad2, LuHardDrive, LuSettings } from 'react-icons/lu';

interface HeaderProps {
  steamPath: string | null;
  totalGames: number;
  totalLibraries: number;
  isScanning: boolean;
  onScan: () => void;
  onOpenSettings: () => void;
}

export function Header({
  steamPath,
  totalGames,
  totalLibraries,
  isScanning,
  onScan,
  onOpenSettings,
}: HeaderProps) {
  return (
    <Box
      data-tauri-drag-region
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
            p={2}
            rounded="xl"
            bgGradient="to-br"
            gradientFrom="blue.500"
            gradientTo="purple.600"
            color="white"
            boxShadow="sm"
          >
            <LuGamepad2 size={26} />
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
            variant="subtle"
            colorPalette="blue"
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
