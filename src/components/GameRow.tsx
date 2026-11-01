import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  Text,
} from '@chakra-ui/react';
import { LuDownload, LuEye, LuEyeOff, LuHardDrive, LuLayers } from 'react-icons/lu';
import { SteamGame } from '@/types';
import { formatBytes } from '@/utils/format';
import { useGameManifestStats } from '@/utils/knownVersions';
import { useAppAccent } from '@/utils/theme';

interface GameRowProps {
  game: SteamGame;
  isHidden: boolean;
  onSelect: (game: SteamGame) => void;
  onToggleHide: (e: React.MouseEvent, appid: number) => void;
  onContextMenu?: (e: React.MouseEvent, game: SteamGame) => void;
}

export function GameRow({
  game,
  isHidden,
  onSelect,
  onToggleHide,
  onContextMenu,
}: GameRowProps) {
  const [fallbackIndex, setFallbackIndex] = useState(0);

  // Cascade of image sources for robust thumbnail display:
  // 1. header_image (header.jpg or dynamic hashed)
  // 2. hero_image (library_hero.jpg - available for Forza Horizon 6, Gamble With Your Friends, etc.)
  // 3. capsule_616x353.jpg (Steam standard store capsule)
  // 4. cover_image (library_600x900.jpg)
  // 5. storepagebackground (storepagebackground/app/{appid})
  const imageCandidates = useMemo(() => {
    const list: string[] = [];
    if (game.header_image) list.push(game.header_image);
    if (game.hero_image) list.push(game.hero_image);
    list.push(`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appid}/capsule_616x353.jpg`);
    list.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/capsule_616x353.jpg`);
    if (game.cover_image) list.push(game.cover_image);
    list.push(`https://store.akamai.steamstatic.com/images/storepagebackground/app/${game.appid}`);
    return list;
  }, [game.header_image, game.hero_image, game.cover_image, game.appid]);

  useEffect(() => {
    setFallbackIndex(0);
  }, [game.appid, game.header_image]);

  const imgSrc = fallbackIndex < imageCandidates.length ? imageCandidates[fallbackIndex] : null;

  const isUninstalled = !game.is_installed;
  const { depotCount, manifestCount } = useGameManifestStats(game);
  const { colorHex, palette } = useAppAccent();

  return (
    <Flex
      align="center"
      justify="space-between"
      p={3}
      rounded="xl"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={isHidden ? 'orange.500' : 'border.subtle'}
      opacity={isUninstalled ? 0.75 : isHidden ? 0.75 : 1}
      transition="all 0.2s ease"
      cursor="pointer"
      onClick={() => onSelect(game)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, game);
        }
      }}
      _hover={{
        borderColor: isHidden ? 'orange.500' : isUninstalled ? 'purple.500' : colorHex,
        bg: 'bg.muted',
        opacity: isUninstalled ? 0.95 : 1,
      }}
      gap={4}
    >
      <HStack gap={4} flex="1" minW={0}>
        {/* Thumbnail */}
        <Box
          width="70px"
          height="45px"
          rounded="md"
          overflow="hidden"
          bg="bg.muted"
          flexShrink={0}
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={game.name}
              onError={() => setFallbackIndex((prev) => prev + 1)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: isHidden
                  ? 'blur(2px)'
                  : isUninstalled
                  ? 'grayscale(85%) contrast(80%) brightness(75%)'
                  : 'none',
                opacity: isUninstalled ? 0.65 : 1,
                transition: 'filter 0.3s ease, opacity 0.3s ease',
              }}
            />
          ) : (
            <Flex
              w="100%"
              h="100%"
              align="center"
              justify="center"
              fontSize="xs"
              fontWeight="bold"
              bg="gray.800"
              color="white"
              filter={isUninstalled ? 'grayscale(80%) opacity(0.7)' : 'none'}
            >
              #{game.appid}
            </Flex>
          )}
        </Box>

        {/* Title and details */}
        <Box minW={0} flex="1">
          <HStack gap={2} mb={1}>
            <Heading size="sm" truncate>
              {game.name}
            </Heading>
            <Badge size="xs" colorPalette="gray" variant="subtle">
              #{game.appid}
            </Badge>
            {!game.is_installed && (
              <Badge size="xs" colorPalette="purple" variant="solid">
                Uninstalled
              </Badge>
            )}
            {isHidden && (
              <Badge size="xs" colorPalette="orange" variant="solid">
                Hidden
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="fg.muted" truncate>
            {game.install_dir} • {game.is_installed ? `Build ${game.build_id}` : 'Not Installed'}
          </Text>
        </Box>
      </HStack>

      {/* Stats and Action */}
      <HStack gap={4} flexShrink={0}>
        <HStack gap={1} fontSize="xs" color="fg.muted" whiteSpace="nowrap">
          <LuHardDrive size={14} />
          <Text whiteSpace="nowrap">{game.is_installed ? formatBytes(game.size_on_disk) : 'Not Installed'}</Text>
        </HStack>

        <HStack
          gap={1}
          fontSize="xs"
          color="fg.muted"
          whiteSpace="nowrap"
          title={`${depotCount} ${depotCount === 1 ? 'depot' : 'depots'} • ${manifestCount} total ${manifestCount === 1 ? 'manifest' : 'manifests'} (installed, presets, local cache & SteamDB)`}
        >
          <LuLayers size={14} />
          <Text whiteSpace="nowrap">
            <Text as="span" display={{ base: 'none', md: 'inline' }}>
              {depotCount} {depotCount === 1 ? 'depot' : 'depots'} •{' '}
            </Text>
            {manifestCount} {manifestCount === 1 ? 'manifest' : 'manifests'}
          </Text>
        </HStack>

        <IconButton
          size="sm"
          variant="ghost"
          colorPalette={isHidden ? 'orange' : 'gray'}
          aria-label={isHidden ? 'Unhide game' : 'Hide game'}
          title={isHidden ? 'Unhide game' : 'Hide game'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleHide(e, game.appid);
          }}
        >
          {isHidden ? <LuEye size={16} /> : <LuEyeOff size={16} />}
        </IconButton>

        <Button
          size="sm"
          colorPalette={game.is_installed ? palette : 'purple'}
          variant="subtle"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(game);
          }}
        >
          <LuDownload />
          {game.is_installed ? 'Manage' : 'Install'}
        </Button>
      </HStack>
    </Flex>
  );
}
