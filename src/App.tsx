import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Heading,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { invoke } from '@tauri-apps/api/core';
import { TitleBar } from '@/components/TitleBar';
import { Header } from '@/components/Header';
import { FilterBar, GridSize, SortOption } from '@/components/FilterBar';
import { useAppAccent } from '@/utils/theme';
import { GameCard } from '@/components/GameCard';
import { GameRow } from '@/components/GameRow';
import { GameDetailModal } from '@/components/GameDetailModal';
import { SettingsModal } from '@/components/SettingsModal';
import { ChangelogModal } from '@/components/ChangelogModal';
import { ContextMenu, ContextMenuState } from '@/components/ContextMenu';
import { FolderBrowserModal } from '@/components/FolderBrowserModal';
import { AddGameModal } from '@/components/AddGameModal';
import { toaster } from '@/components/ui/toaster';
import { ScanResult, SteamGame, SteamLibrary } from '@/types';
import { isGameVisible } from '@/utils/filterGames';
import { checkUpdate } from '@/utils/updater';
import { downloadTracker } from '@/utils/downloadTracker';
import { listen } from '@tauri-apps/api/event';
import { DepotDownloadProgressEvent } from '@/types';
import { LuFolderPlus, LuFolderSync, LuGamepad2, LuHardDrive } from 'react-icons/lu';

export function App() {
  const { palette, colorHex } = useAppAccent();
  const [games, setGames] = useState<SteamGame[]>([]);
  const [libraries, setLibraries] = useState<SteamLibrary[]>([]);
  const [steamPath, setSteamPath] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Hidden game IDs persisted in localStorage
  const [hiddenGameIds, setHiddenGameIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('steam_hidden_game_ids');
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  const [showHidden, setShowHidden] = useState(false);
  const [showUninstalled, setShowUninstalled] = useState(false);

  // Custom user-added games persisted in localStorage
  const [customAddedGames, setCustomAddedGames] = useState<SteamGame[]>(() => {
    try {
      const saved = localStorage.getItem('steam_custom_added_games');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Custom paths persisted in localStorage
  const [customPaths, setCustomPaths] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('steam_custom_paths');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Filter & View State
  const [search, setSearch] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [gridSize, setGridSize] = useState<GridSize>(() => {
    try {
      const saved = localStorage.getItem('steam_game_manager_grid_size') as GridSize;
      if (saved === 'compact' || saved === 'medium' || saved === 'large') {
        return saved;
      }
    } catch {}
    return 'medium';
  });

  const handleGridSizeChange = (size: GridSize) => {
    setGridSize(size);
    try {
      localStorage.setItem('steam_game_manager_grid_size', size);
    } catch {}
  };

  // Modal State
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'downgrade' | 'vault' | 'backups' | 'info'>('downgrade');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
  const [isAddGameOpen, setIsAddGameOpen] = useState(false);

  const handleAddCustomGame = (newGame: SteamGame) => {
    setCustomAddedGames((prev) => {
      const updated = [newGame, ...prev.filter((g) => g.appid !== newGame.appid)];
      localStorage.setItem('steam_custom_added_games', JSON.stringify(updated));
      return updated;
    });
    setGames((prev) => {
      return [newGame, ...prev.filter((g) => g.appid !== newGame.appid)];
    });
    handleOpenGame(newGame, 'downgrade');
  };

  const handleOpenGame = (game: SteamGame, tab: 'downgrade' | 'vault' | 'backups' | 'info' = 'downgrade') => {
    setSelectedGame(game);
    setDetailModalTab(tab);
  };

  // Custom Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    game: null,
  });

  const saveCustomPaths = (paths: string[]) => {
    setCustomPaths(paths);
    localStorage.setItem('steam_custom_paths', JSON.stringify(paths));
  };

  const handleAddCustomPath = (path: string) => {
    const updated = [...customPaths, path];
    saveCustomPaths(updated);
  };

  const handleRemoveCustomPath = (path: string) => {
    const updated = customPaths.filter((p) => p !== path);
    saveCustomPaths(updated);
  };

  const handleToggleHide = (appid: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setHiddenGameIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(appid)) {
        updated.delete(appid);
        toaster.create({
          title: 'Game Unhidden',
          description: `Game #${appid} is now visible.`,
          type: 'info',
        });
      } else {
        updated.add(appid);
        toaster.create({
          title: 'Game Hidden',
          description: `Game #${appid} has been hidden. Toggle 'Hidden' in the filter bar to view.`,
          type: 'info',
        });
      }
      localStorage.setItem('steam_hidden_game_ids', JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, game: SteamGame) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      game,
    });
  };

  const scanLibraries = async (overridePaths?: string[], options?: { silent?: boolean }) => {
    const isSilent = options?.silent ?? false;
    if (!isSilent) {
      setIsScanning(true);
    }
    const pathsToScan = overridePaths || customPaths;
    try {
      const result = await invoke<ScanResult>('scan_steam_games', {
        customPaths: pathsToScan,
      });

      setSteamPath(result.steam_path);
      setLibraries(result.libraries);

      // Merge scanned games with any custom user-added games
      const allDiscovered = [...result.games];
      for (const cg of customAddedGames) {
        if (!allDiscovered.some((g) => g.appid === cg.appid)) {
          allDiscovered.push(cg);
        }
      }
      setGames(allDiscovered);

      // If a game detail modal is currently open, seamlessly update its selectedGame instance
      setSelectedGame((prev) => {
        if (!prev) return null;
        const updated = allDiscovered.find((g) => g.appid === prev.appid);
        return updated || prev;
      });

      if (!isSilent && result.games.length > 0) {
        toaster.create({
          title: 'Scan Complete',
          description: `Found ${result.games.length} games across ${result.libraries.length} drives/libraries.`,
          type: 'success',
        });
      }
    } catch (err) {
      console.error('Scan error:', err);
      if (!isSilent) {
        toaster.create({
          title: 'Scan Error',
          description: String(err),
          type: 'error',
        });
      }
    } finally {
      if (!isSilent) {
        setIsScanning(false);
      }
    }
  };

  useEffect(() => {
    scanLibraries();

    // Check for app updates silently in background on startup
    const timer = setTimeout(() => {
      checkUpdate(undefined, false).catch(() => {});
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  // Global event listener for depot downloads to keep track across background/closed modals
  const selectedGameRef = useRef<SteamGame | null>(null);
  selectedGameRef.current = selectedGame;

  const gamesRef = useRef<SteamGame[]>([]);
  gamesRef.current = games;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<DepotDownloadProgressEvent>('depot_download_progress', (ev) => {
      const p = ev.payload;
      downloadTracker.updateProgress(p);

      const targetGame = gamesRef.current.find((g) => g.appid === p.appid);
      const gameTitle = targetGame ? targetGame.name : `AppID ${p.appid}`;

      if (p.step === 'finished') {
        scanLibraries(undefined, { silent: true });
        toaster.create({
          title: 'Version Switch Complete!',
          description: `${gameTitle} (Depot ${p.depot_id}) is ready to play.`,
          type: 'success',
          action: {
            label: 'View Details',
            onClick: () => {
              const currentG = gamesRef.current.find((g) => g.appid === p.appid);
              if (currentG) {
                handleOpenGame(currentG, 'downgrade');
              }
            },
          },
        });
      } else if (p.step === 'error') {
        toaster.create({
          title: `Version Switch Error - ${gameTitle}`,
          description: p.message,
          type: 'error',
          action: {
            label: 'Open Details',
            onClick: () => {
              const currentG = gamesRef.current.find((g) => g.appid === p.appid);
              if (currentG) {
                handleOpenGame(currentG, 'downgrade');
              }
            },
          },
        });
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Track appids that we've already attempted to resolve this session to avoid redundant queries
  const attemptedAppids = useRef<Set<number>>(new Set());

  // Automatically resolve titles and artwork for any uninstalled games showing as "Steam Game #..."
  useEffect(() => {
    // 1. Check local cache first for instant synchronous resolution
    let cache: Record<number, { name: string; header_image?: string }> = {};
    try {
      const cacheRaw = localStorage.getItem('steam_app_metadata_cache_v1');
      if (cacheRaw) cache = JSON.parse(cacheRaw);
    } catch {}

    let hasCachedUpdates = false;
    const resolvedFromCache = games.map((g) => {
      if (g.name.startsWith('Steam Game #')) {
        const cached = cache[g.appid];
        if (cached) {
          hasCachedUpdates = true;
          return {
            ...g,
            name: cached.name,
            header_image: cached.header_image || g.header_image,
          };
        }
      }
      return g;
    });

    if (hasCachedUpdates) {
      setGames(resolvedFromCache);
      return;
    }

    // 2. Find unknown games that haven't been attempted yet
    const unknownGames = games.filter(
      (g) => g.name.startsWith('Steam Game #') && !attemptedAppids.current.has(g.appid)
    );
    if (unknownGames.length === 0) return;

    // Pick a manageable batch of up to 10 unknown games to fetch in the background
    const batch = unknownGames.slice(0, 10);
    for (const g of batch) {
      attemptedAppids.current.add(g.appid);
    }

    invoke<Array<{ appid: number; name: string; header_image?: string }>>(
      'resolve_steam_apps_metadata',
      { appids: batch.map((g) => g.appid) }
    )
      .then((resolvedList) => {
        if (resolvedList && resolvedList.length > 0) {
          const newCache = { ...cache };
          const resolvedMap = new Map<number, { name: string; header_image?: string }>();
          for (const item of resolvedList) {
            newCache[item.appid] = { name: item.name, header_image: item.header_image };
            resolvedMap.set(item.appid, item);
          }
          try {
            localStorage.setItem('steam_app_metadata_cache_v1', JSON.stringify(newCache));
          } catch {}

          setGames((prev) =>
            prev.map((g) => {
              const resolved = resolvedMap.get(g.appid);
              if (resolved) {
                return {
                  ...g,
                  name: resolved.name,
                  header_image: resolved.header_image || g.header_image,
                };
              }
              return g;
            })
          );
        }
      })
      .catch((err) => {
        console.warn('Could not resolve uninstalled app metadata:', err);
      });
  }, [games]);

  // Filtered and Sorted Games
  const filteredGames = useMemo(() => {
    let result = [...games];

    // Visibility filter (Installed vs Uninstalled vs Hidden)
    // - Normal installed games show unless hidden.
    // - If a game is uninstalled and hidden, it shows if EITHER filter is enabled (rather than requiring both).
    // - An uninstalled game shows if showUninstalled is on.
    // - A hidden game shows if showHidden is on.
    result = result.filter((g) => isGameVisible(g, hiddenGameIds, showUninstalled, showHidden));

    // 3. Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.appid.toString().includes(q) ||
          g.install_dir.toLowerCase().includes(q)
      );
    }

    // 4. Library filter
    if (selectedLibrary !== 'all') {
      result = result.filter((g) => {
        if (g.is_installed) {
          return g.library_path === selectedLibrary;
        }
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'size_desc':
          return b.size_on_disk - a.size_on_disk;
        case 'size_asc':
          return a.size_on_disk - b.size_on_disk;
        case 'updated_desc':
          return b.last_updated - a.last_updated;
        case 'appid_asc':
          return a.appid - b.appid;
        default:
          return 0;
      }
    });

    return result;
  }, [games, search, selectedLibrary, sortBy, showHidden, showUninstalled, hiddenGameIds]);

  const hiddenCount = useMemo(() => {
    return games.filter((g) => hiddenGameIds.has(g.appid)).length;
  }, [games, hiddenGameIds]);

  const uninstalledCount = useMemo(() => {
    return games.filter((g) => !g.is_installed && (showHidden || !hiddenGameIds.has(g.appid))).length;
  }, [games, hiddenGameIds, showHidden]);

  const installedCount = useMemo(() => {
    return games.filter((g) => g.is_installed).length;
  }, [games]);

  return (
    <Box minH="100vh" bg="bg" color="fg" display="flex" flexDirection="column" colorPalette={palette}>
      {/* Discord / Spotify Custom TitleBar */}
      <TitleBar />

      {/* Top Header */}
      <Header
        steamPath={steamPath}
        totalGames={installedCount}
        totalLibraries={libraries.length}
        isScanning={isScanning}
        onScan={() => scanLibraries()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenChangelog={() => setIsChangelogOpen(true)}
      />

      {/* Filter and View Options */}
      {games.length > 0 && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          selectedLibrary={selectedLibrary}
          onLibraryChange={setSelectedLibrary}
          libraries={libraries}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          gridSize={gridSize}
          onGridSizeChange={handleGridSizeChange}
          filteredCount={filteredGames.length}
          totalCount={showUninstalled ? games.length : installedCount}
          showHidden={showHidden}
          onToggleShowHidden={() => setShowHidden(!showHidden)}
          hiddenCount={hiddenCount}
          showUninstalled={showUninstalled}
          onToggleShowUninstalled={() => setShowUninstalled(!showUninstalled)}
          uninstalledCount={uninstalledCount}
          onOpenAddGame={() => setIsAddGameOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <Box flex="1" px={{ base: 4, md: 8 }} py={6}>
        {isScanning && games.length === 0 ? (
          <Flex justify="center" align="center" direction="column" minH="350px" gap={3}>
            <Spinner size="xl" color={colorHex} />
            <Text fontSize="md" fontWeight="medium">
              Scanning drives for Steam games and manifests...
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Checking Windows drives, WSL mounts, and Steam library directories
            </Text>
          </Flex>
        ) : games.length === 0 ? (
          /* Pure No Steam Games Found View */
          <Flex
            direction="column"
            align="center"
            justify="center"
            minH="400px"
            p={8}
            rounded="2xl"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border.subtle"
            textAlign="center"
            bg="bg.panel"
          >
            <Box p={4} rounded="full" bg="bg.muted" mb={3} color="fg.muted">
              <LuHardDrive size={40} />
            </Box>
            <Heading size="lg" mb={2}>
              No Steam Games Found
            </Heading>
            <Text fontSize="sm" color="fg.muted" maxW="460px" mb={6}>
              We scanned all connected drives and common Steam locations, but did not detect any
              installed Steam games. Click below to browse folders or select an unmounted drive.
            </Text>

            <HStack gap={3}>
              <Button
                size="md"
                colorPalette={palette}
                variant="solid"
                onClick={() => scanLibraries()}
              >
                <LuFolderSync /> Rescan Drives
              </Button>
              <Button
                size="md"
                variant="subtle"
                onClick={() => setIsFolderBrowserOpen(true)}
              >
                <LuFolderPlus /> Browse Drives & Folders
              </Button>
            </HStack>
          </Flex>
        ) : filteredGames.length === 0 ? (
          <Flex
            direction="column"
            align="center"
            justify="center"
            minH="300px"
            p={8}
            rounded="2xl"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border.subtle"
            textAlign="center"
          >
            <Box p={3} rounded="full" bg="bg.muted" mb={2} color="fg.muted">
              <LuGamepad2 size={32} />
            </Box>
            <Heading size="md" mb={1}>
              No Matching Games
            </Heading>
            <Text fontSize="sm" color="fg.muted" maxW="400px" mb={4}>
              {search
                ? `No games match "${search}". Try clearing your search.`
                : 'All games in this drive filter may be hidden.'}
            </Text>
            <HStack gap={2}>
              {search && (
                <Button size="sm" variant="outline" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              )}
              {hiddenCount > 0 && !showHidden && (
                <Button size="sm" colorPalette="orange" variant="subtle" onClick={() => setShowHidden(true)}>
                  Show {hiddenCount} Hidden Games
                </Button>
              )}
            </HStack>
          </Flex>
        ) : viewMode === 'grid' ? (
          <Grid
            templateColumns={
              gridSize === 'compact'
                ? 'repeat(auto-fill, minmax(170px, 1fr))'
                : gridSize === 'large'
                  ? 'repeat(auto-fill, minmax(285px, 1fr))'
                  : 'repeat(auto-fill, minmax(215px, 1fr))'
            }
            gap={gridSize === 'compact' ? 3.5 : gridSize === 'large' ? 6 : 5}
          >
            {filteredGames.map((game) => (
              <GameCard
                key={`${game.appid}-${game.library_path}`}
                game={game}
                isHidden={hiddenGameIds.has(game.appid)}
                onSelect={(g) => handleOpenGame(g, 'downgrade')}
                onToggleHide={(e, appid) => handleToggleHide(appid, e)}
                onContextMenu={handleContextMenu}
              />
            ))}
          </Grid>
        ) : (
          <VStack gap={3} align="stretch">
            {filteredGames.map((game) => (
              <GameRow
                key={`${game.appid}-${game.library_path}`}
                game={game}
                isHidden={hiddenGameIds.has(game.appid)}
                onSelect={(g) => handleOpenGame(g, 'downgrade')}
                onToggleHide={(e, appid) => handleToggleHide(appid, e)}
                onContextMenu={handleContextMenu}
              />
            ))}
          </VStack>
        )}
      </Box>

      {/* Game Details & Downgrade Modal */}
      <GameDetailModal
        game={selectedGame}
        isOpen={Boolean(selectedGame)}
        onClose={() => setSelectedGame(null)}
        steamPath={steamPath}
        isHidden={selectedGame ? hiddenGameIds.has(selectedGame.appid) : false}
        onToggleHide={(appid) => handleToggleHide(appid)}
        initialTab={detailModalTab}
        onRefreshGame={() => scanLibraries(undefined, { silent: true })}
        libraries={libraries}
      />

      {/* Add Game by AppID Modal */}
      <AddGameModal
        isOpen={isAddGameOpen}
        onClose={() => setIsAddGameOpen(false)}
        libraries={libraries}
        onAddGame={handleAddCustomGame}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        steamPath={steamPath}
        customPaths={customPaths}
        onAddCustomPath={handleAddCustomPath}
        onRemoveCustomPath={handleRemoveCustomPath}
        onRescan={() => scanLibraries()}
        gridSize={gridSize}
        onGridSizeChange={handleGridSizeChange}
        onOpenChangelog={() => setIsChangelogOpen(true)}
      />

      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />

      {/* Folder Browser Modal */}
      <FolderBrowserModal
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onSelectFolder={(selectedPath) => {
          handleAddCustomPath(selectedPath);
          scanLibraries([...customPaths, selectedPath]);
        }}
        initialPath={steamPath || undefined}
      />

      {/* Custom Context Menu */}
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onOpenGame={(game, tab) => handleOpenGame(game, tab || 'downgrade')}
        isHidden={contextMenu.game ? hiddenGameIds.has(contextMenu.game.appid) : false}
        onToggleHide={(appid) => handleToggleHide(appid)}
      />
    </Box>
  );
}

export default App;
