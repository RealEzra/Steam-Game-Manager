import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  SimpleGrid,
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
import { LuGamepad2, LuPlus } from 'react-icons/lu';
import { SteamGame, SteamLibrary } from '@/types';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  libraries: SteamLibrary[];
  onAddGame: (game: SteamGame) => void;
}

const PRESET_GAMES = [
  { appid: 489830, name: 'The Elder Scrolls V: Skyrim Special Edition', install_dir: 'Skyrim Special Edition' },
  { appid: 377160, name: 'Fallout 4', install_dir: 'Fallout 4' },
  { appid: 1091500, name: 'Cyberpunk 2077', install_dir: 'Cyberpunk 2077' },
  { appid: 1086940, name: "Baldur's Gate 3", install_dir: 'Baldurs Gate 3' },
  { appid: 1245620, name: 'Elden Ring', install_dir: 'ELDEN RING' },
  { appid: 1716740, name: 'Starfield', install_dir: 'Starfield' },
  { appid: 292030, name: 'The Witcher 3: Wild Hunt', install_dir: 'The Witcher 3' },
  { appid: 271590, name: 'Grand Theft Auto V', install_dir: 'Grand Theft Auto V' },
  { appid: 1174180, name: 'Red Dead Redemption 2', install_dir: 'Red Dead Redemption 2' },
  { appid: 1196590, name: 'Resident Evil 4 (2023)', install_dir: 'RESIDENT EVIL 4' },
  { appid: 413150, name: 'Stardew Valley', install_dir: 'Stardew Valley' },
  { appid: 814380, name: 'Sekiro: Shadows Die Twice', install_dir: 'Sekiro' },
];

export function AddGameModal({
  isOpen,
  onClose,
  libraries,
  onAddGame,
}: AddGameModalProps) {
  const [appidInput, setAppidInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [installDirInput, setInstallDirInput] = useState('');

  const handleSelectPreset = (preset: typeof PRESET_GAMES[0]) => {
    setAppidInput(String(preset.appid));
    setNameInput(preset.name);
    setInstallDirInput(preset.install_dir);
  };

  const handleAdd = () => {
    const appid = parseInt(appidInput.trim(), 10);
    if (isNaN(appid) || appid <= 0) {
      toaster.create({
        title: 'Invalid AppID',
        description: 'Please enter a valid numeric Steam AppID.',
        type: 'warning',
      });
      return;
    }

    const name = nameInput.trim() || `Steam App #${appid}`;
    const install_dir = installDirInput.trim() || name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || `game_${appid}`;

    const defaultLib = libraries.length > 0 ? libraries[0].path : 'SteamLibrary';
    const fullPath = defaultLib.endsWith('steamapps')
      ? `${defaultLib}/common/${install_dir}`
      : `${defaultLib}/steamapps/common/${install_dir}`;

    const newGame: SteamGame = {
      appid,
      name,
      install_dir,
      full_path: fullPath,
      library_path: defaultLib,
      size_on_disk: 0,
      build_id: 'None (Uninstalled)',
      last_updated: 0,
      mounted_depots: {},
      cover_image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`,
      header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
      hero_image: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`,
      steamdb_url: `https://steamdb.info/app/${appid}/`,
      is_installed: false,
    };

    onAddGame(newGame);
    toaster.create({
      title: 'Game Added to Library',
      description: `${name} (AppID ${appid}) added as uninstalled. Ready to download and install!`,
      type: 'success',
    });

    setAppidInput('');
    setNameInput('');
    setInstallDirInput('');
    onClose();
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="md"
    >
      <DialogContent rounded="2xl" p={6}>
        <DialogHeader p={0} mb={4}>
          <HStack gap={2}>
            <Box color="blue.500">
              <LuPlus size={20} />
            </Box>
            <DialogTitle fontSize="lg">Add Game by AppID</DialogTitle>
          </HStack>
          <Text fontSize="xs" color="fg.muted" mt={1}>
            Add any Steam game to your uninstalled library to install or downgrade to a specific build.
          </Text>
        </DialogHeader>

        <DialogBody p={0}>
          <VStack gap={4} align="stretch">
            {/* Quick Presets */}
            <Box>
              <Text fontSize="2xs" fontWeight="semibold" color="fg.muted" mb={2} textTransform="uppercase">
                Popular Downgradeable Games
              </Text>
              <SimpleGrid columns={{ base: 2, sm: 3 }} gap={1.5}>
                {PRESET_GAMES.map((preset) => (
                  <Button
                    key={preset.appid}
                    size="xs"
                    variant={appidInput === String(preset.appid) ? 'solid' : 'subtle'}
                    colorPalette={appidInput === String(preset.appid) ? 'blue' : 'gray'}
                    justifyContent="flex-start"
                    onClick={() => handleSelectPreset(preset)}
                    truncate
                  >
                    <LuGamepad2 size={12} style={{ flexShrink: 0 }} />
                    <Text truncate fontSize="2xs">
                      {preset.name.split(':')[0]}
                    </Text>
                  </Button>
                ))}
              </SimpleGrid>
            </Box>

            {/* Inputs */}
            <VStack gap={3} align="stretch">
              <Box>
                <Flex justify="space-between" align="center" mb={1}>
                  <Text fontSize="xs" fontWeight="semibold">
                    Steam AppID *
                  </Text>
                  {appidInput && (
                    <Badge size="xs" colorPalette="blue">
                      AppID: {appidInput}
                    </Badge>
                  )}
                </Flex>
                <Input
                  size="sm"
                  placeholder="e.g. 489830"
                  value={appidInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setAppidInput(val);
                    const match = PRESET_GAMES.find((p) => String(p.appid) === val);
                    if (match) {
                      setNameInput(match.name);
                      setInstallDirInput(match.install_dir);
                    }
                  }}
                />
              </Box>

              <Box>
                <Text fontSize="xs" fontWeight="semibold" mb={1}>
                  Game Name
                </Text>
                <Input
                  size="sm"
                  placeholder="e.g. The Elder Scrolls V: Skyrim Special Edition"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </Box>

              <Box>
                <Text fontSize="xs" fontWeight="semibold" mb={1}>
                  Install Directory Name
                </Text>
                <Input
                  size="sm"
                  placeholder="e.g. Skyrim Special Edition"
                  value={installDirInput}
                  onChange={(e) => setInstallDirInput(e.target.value)}
                />
              </Box>
            </VStack>

            <Flex justify="flex-end" gap={2} mt={2}>
              <Button size="sm" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                colorPalette="blue"
                disabled={!appidInput.trim()}
                onClick={handleAdd}
              >
                <LuPlus />
                Add Game to Library
              </Button>
            </Flex>
          </VStack>
        </DialogBody>

        <DialogCloseTrigger top={4} insetEnd={4} />
      </DialogContent>
    </DialogRoot>
  );
}
