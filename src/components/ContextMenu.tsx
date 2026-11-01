import { useEffect, useRef } from 'react';
import {
  Badge,
  Box,
  Flex,
  HStack,
  Separator,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  LuArchive,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFolder,
  LuGamepad2,
  LuLayers,
  LuPlay,
  LuZap,
} from 'react-icons/lu';
import { SteamGame } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { toaster } from '@/components/ui/toaster';

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  game: SteamGame | null;
}

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onOpenGame: (game: SteamGame, tab?: 'downgrade' | 'vault' | 'backups' | 'info') => void;
  isHidden: boolean;
  onToggleHide: (appid: number) => void;
}

export function ContextMenu({
  state,
  onClose,
  onOpenGame,
  isHidden,
  onToggleHide,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (state.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen || !state.game) return null;

  const { game, x, y } = state;

  // Keep menu within screen boundaries
  const menuWidth = 240;
  const menuHeight = 330;
  const safeX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 10);
  const safeY = Math.min(Math.max(10, y), window.innerHeight - menuHeight - 10);

  const handleOpenFolder = async () => {
    try {
      await invoke('open_folder', { path: game.full_path });
    } catch (err) {
      toaster.create({
        title: 'Could not open folder',
        description: String(err),
        type: 'error',
      });
    }
    onClose();
  };

  const handleLaunchSteamConsole = async () => {
    try {
      await invoke('open_steam_console');
      toaster.create({
        title: 'Launched Steam Console',
        type: 'info',
      });
    } catch (err) {
      toaster.create({
        title: 'Could not launch Steam console',
        description: String(err),
        type: 'error',
      });
    }
    onClose();
  };

  return (
    <Box
      ref={menuRef}
      position="fixed"
      left={`${safeX}px`}
      top={`${safeY}px`}
      zIndex={1000}
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="xl"
      shadow="2xl"
      p={1.5}
      minW="230px"
      backdropFilter="blur(16px)"
      animation="scale-fade-in 0.15s ease-out"
    >
      {/* Game Mini Header */}
      <Flex p={2} align="center" gap={2.5} bg="bg.muted" rounded="lg" mb={1}>
        <img
          src={game.header_image}
          alt={game.name}
          style={{ width: '38px', height: '24px', objectFit: 'cover', borderRadius: '4px' }}
        />
        <Box minW={0} flex="1">
          <Text fontSize="xs" fontWeight="bold" truncate title={game.name}>
            {game.name}
          </Text>
          <HStack gap={1}>
            <Badge size="xs" colorPalette="blue">
              #{game.appid}
            </Badge>
            <Text fontSize="2xs" color="fg.muted">
              Build {game.build_id}
            </Text>
          </HStack>
        </Box>
      </Flex>

      {/* Menu Options */}
      <VStack gap={0.5} align="stretch">
        <MenuItem
          icon={<LuDownload />}
          label="Manage & Downgrade"
          onClick={() => {
            onOpenGame(game, 'downgrade');
            onClose();
          }}
        />

        <MenuItem
          icon={<LuZap />}
          label="⚡ Quick Switch Builds (Vault)"
          color="blue.400"
          onClick={() => {
            onOpenGame(game, 'vault');
            onClose();
          }}
        />

        <MenuItem
          icon={<LuLayers />}
          label="Browse Game Builds"
          onClick={() => {
            onOpenGame(game, 'downgrade');
            onClose();
          }}
        />

        <MenuItem
          icon={<LuArchive />}
          label="Create Save Data Backup"
          onClick={() => {
            onOpenGame(game, 'backups');
            onClose();
          }}
        />

        <Separator my={1} borderColor="border.subtle" />

        <MenuItem
          icon={<LuFolder />}
          label="Open Game Folder"
          onClick={handleOpenFolder}
        />

        <MenuItem
          icon={<LuPlay />}
          label="Launch Steam Console"
          onClick={handleLaunchSteamConsole}
        />

        <MenuItem
          icon={<LuExternalLink />}
          label="View on SteamDB"
          onClick={() => {
            window.open(game.steamdb_url, '_blank');
            onClose();
          }}
        />

        <MenuItem
          icon={<LuGamepad2 />}
          label="View on Steam Store"
          onClick={() => {
            window.open(`https://store.steampowered.com/app/${game.appid}/`, '_blank');
            onClose();
          }}
        />

        <Separator my={1} borderColor="border.subtle" />

        <MenuItem
          icon={isHidden ? <LuEye /> : <LuEyeOff />}
          label={isHidden ? 'Unhide Game' : 'Hide Game'}
          color={isHidden ? 'orange.500' : undefined}
          onClick={() => {
            onToggleHide(game.appid);
            onClose();
          }}
        />
      </VStack>
    </Box>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <Flex
      align="center"
      gap={2.5}
      px={2.5}
      py={1.5}
      rounded="md"
      cursor="pointer"
      fontSize="xs"
      color={color || 'fg'}
      transition="all 0.12s ease"
      _hover={{
        bg: 'blue.500/10',
        color: 'blue.500',
      }}
      onClick={onClick}
    >
      <Box fontSize="14px">{icon}</Box>
      <Text fontWeight="medium">{label}</Text>
    </Flex>
  );
}
