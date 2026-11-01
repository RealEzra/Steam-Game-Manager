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

interface GameCardProps {
  game: SteamGame;
  isHidden: boolean;
  onSelect: (game: SteamGame) => void;
  onToggleHide: (e: React.MouseEvent, appid: number) => void;
  onContextMenu?: (e: React.MouseEvent, game: SteamGame) => void;
}

export function GameCard({
  game,
  isHidden,
  onSelect,
  onToggleHide,
  onContextMenu,
}: GameCardProps) {
  const [fallbackIndex, setFallbackIndex] = useState(0);

  // Cascade of image sources for robust artwork display:
  // 1. cover_image (library_600x900.jpg)
  // 2. header_image (header.jpg / dynamic hashed CDN)
  // 3. hero_image (library_hero.jpg - available even for newer games like Forza Horizon 6 & Gamble With Your Friends)
  // 4. capsule_616x353.jpg (Steam standard store capsule)
  // 5. storepagebackground (storepagebackground/app/{appid})
  const imageCandidates = useMemo(() => {
    const list: string[] = [];
    if (game.cover_image) list.push(game.cover_image);
    if (game.header_image) list.push(game.header_image);
    if (game.hero_image) list.push(game.hero_image);
    list.push(`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appid}/capsule_616x353.jpg`);
    list.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/capsule_616x353.jpg`);
    list.push(`https://store.akamai.steamstatic.com/images/storepagebackground/app/${game.appid}`);
    return list;
  }, [game.cover_image, game.header_image, game.hero_image, game.appid]);

  useEffect(() => {
    setFallbackIndex(0);
  }, [game.appid, game.header_image]);

  const imgSrc = fallbackIndex < imageCandidates.length ? imageCandidates[fallbackIndex] : null;

  const isUninstalled = !game.is_installed;
  const { depotCount, manifestCount } = useGameManifestStats(game);
  const { colorHex, palette } = useAppAccent();

  return (
    <Box
      role="group"
      position="relative"
      rounded="xl"
      overflow="hidden"
      bg="bg.panel"
      borderWidth="1px"
      borderColor={isHidden ? 'orange.500' : isUninstalled ? 'border.subtle' : 'border.subtle'}
      opacity={isUninstalled ? 0.75 : isHidden ? 0.75 : 1}
      transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
      cursor="pointer"
      onClick={() => onSelect(game)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, game);
        }
      }}
      _hover={{
        transform: 'translateY(-4px)',
        shadow: 'lg',
        borderColor: isHidden ? 'orange.500' : isUninstalled ? 'purple.500' : colorHex,
        opacity: isUninstalled ? 0.95 : 1,
      }}
      display="flex"
      flexDirection="column"
    >
      {/* Cover Image Container (2:3 aspect ratio) */}
      <Box
        position="relative"
        width="100%"
        paddingBottom="150%"
        overflow="hidden"
        bg="bg.muted"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={game.name}
            onError={() => {
              setFallbackIndex((prev) => prev + 1);
            }}
            loading="lazy"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: isHidden
                ? 'blur(4px)'
                : isUninstalled
                ? 'grayscale(85%) contrast(80%) brightness(75%)'
                : 'none',
              opacity: isUninstalled ? 0.65 : 1,
              transition: 'transform 0.4s ease, filter 0.3s ease, opacity 0.3s ease',
            }}
          />
        ) : (
          <Flex
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            p={4}
            textAlign="center"
            bgGradient="to-br"
            gradientFrom="gray.800"
            gradientTo="gray.900"
            color="white"
            filter={isUninstalled ? 'grayscale(80%) opacity(0.7)' : 'none'}
          >
            <Heading size="md" wordBreak="break-word">
              {game.name}
            </Heading>
          </Flex>
        )}

        {/* Top Left Badges */}
        <HStack position="absolute" top={2} left={2} gap={1} zIndex={2}>
          <Badge
            colorPalette="blackAlpha"
            variant="solid"
            size="xs"
            backdropFilter="blur(8px)"
            bg="blackAlpha.700"
            color="white"
          >
            #{game.appid}
          </Badge>
          {!game.is_installed && (
            <Badge colorPalette="purple" variant="solid" size="xs">
              Uninstalled
            </Badge>
          )}
          {isHidden && (
            <Badge colorPalette="orange" variant="solid" size="xs">
              Hidden
            </Badge>
          )}
        </HStack>

        {/* Top Right Quick Actions: Hide / Unhide button (Dedicated, with stopPropagation) */}
        <HStack position="absolute" top={2} right={2} gap={1} zIndex={4}>
          <IconButton
            size="2xs"
            variant="solid"
            colorPalette={isHidden ? 'orange' : 'blackAlpha'}
            bg={isHidden ? 'orange.600' : 'blackAlpha.700'}
            color="white"
            aria-label={isHidden ? 'Unhide game' : 'Hide game'}
            title={isHidden ? 'Unhide game' : 'Hide game'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHide(e, game.appid);
            }}
          >
            {isHidden ? <LuEye size={13} /> : <LuEyeOff size={13} />}
          </IconButton>
        </HStack>

        {/* Hover Action Overlay: Pointer events strictly disabled when not hovering */}
        <Flex
          position="absolute"
          inset={0}
          bg="blackAlpha.700"
          opacity={0}
          pointerEvents="none"
          _groupHover={{ opacity: 1, pointerEvents: 'auto' }}
          transition="opacity 0.2s ease"
          align="center"
          justify="center"
          direction="column"
          gap={2}
          zIndex={3}
          p={4}
        >
          <Button
            size="sm"
            colorPalette={game.is_installed ? palette : 'purple'}
            variant="solid"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(game);
            }}
          >
            <LuDownload />
            {game.is_installed ? 'Manage & Switch Version' : 'Install Specific Version'}
          </Button>
        </Flex>
      </Box>

      {/* Info footer */}
      <Box p={3} flex="1" display="flex" flexDirection="column" justifyContent="space-between">
        <Heading
          size="sm"
          fontWeight="semibold"
          title={game.name}
          truncate
          mb={1.5}
        >
          {game.name}
        </Heading>

        <Flex justify="space-between" align="center" fontSize="xs" color="fg.muted" gap={2}>
          <HStack gap={1} flexShrink={0} whiteSpace="nowrap">
            <LuHardDrive size={13} />
            <Text whiteSpace="nowrap">{game.is_installed ? formatBytes(game.size_on_disk) : 'Not Installed'}</Text>
          </HStack>

          <HStack
            gap={1}
            flexShrink={0}
            whiteSpace="nowrap"
            title={`${depotCount} ${depotCount === 1 ? 'depot' : 'depots'} • ${manifestCount} total ${manifestCount === 1 ? 'manifest' : 'manifests'} (installed, presets, local cache & SteamDB)`}
          >
            <LuLayers size={13} />
            <Text whiteSpace="nowrap">
              <Text as="span" display={{ base: 'none', '2xl': 'inline' }}>
                {depotCount} {depotCount === 1 ? 'depot' : 'depots'} •{' '}
              </Text>
              {manifestCount} {manifestCount === 1 ? 'manifest' : 'manifests'}
            </Text>
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
}
