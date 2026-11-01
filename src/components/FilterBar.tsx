import {
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  Text,
} from '@chakra-ui/react';
import {
  LuDownload,
  LuEye,
  LuEyeOff,
  LuLayoutGrid,
  LuList,
  LuPlus,
  LuSearch,
} from 'react-icons/lu';
import { SteamLibrary } from '@/types';
import { AppSelect } from '@/components/ui/AppSelect';
import { useAppAccent } from '@/utils/theme';

export type SortOption =
  | 'name_asc'
  | 'name_desc'
  | 'size_desc'
  | 'size_asc'
  | 'updated_desc'
  | 'appid_asc';

export type GridSize = 'compact' | 'medium' | 'large';

interface FilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  selectedLibrary: string;
  onLibraryChange: (lib: string) => void;
  libraries: SteamLibrary[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  gridSize?: GridSize;
  onGridSizeChange?: (size: GridSize) => void;
  filteredCount: number;
  totalCount: number;
  showHidden: boolean;
  onToggleShowHidden: () => void;
  hiddenCount: number;
  showUninstalled: boolean;
  onToggleShowUninstalled: () => void;
  uninstalledCount: number;
  onOpenAddGame: () => void;
}

export function FilterBar({
  search,
  onSearchChange,
  selectedLibrary,
  onLibraryChange,
  libraries,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  gridSize = 'medium',
  onGridSizeChange,
  filteredCount,
  totalCount,
  showHidden,
  onToggleShowHidden,
  hiddenCount,
  showUninstalled,
  onToggleShowUninstalled,
  uninstalledCount,
  onOpenAddGame,
}: FilterBarProps) {
  const { palette } = useAppAccent();

  const driveOptions = [
    { value: 'all', label: `All Drives (${totalCount})` },
    ...libraries.map((lib) => ({
      value: lib.path,
      label: `${lib.label} (${lib.total_games})`,
    })),
  ];

  const sortOptions = [
    { value: 'name_asc', label: 'Name (A-Z)' },
    { value: 'name_desc', label: 'Name (Z-A)' },
    { value: 'size_desc', label: 'Size (Largest first)' },
    { value: 'size_asc', label: 'Size (Smallest first)' },
    { value: 'updated_desc', label: 'Recently Updated' },
    { value: 'appid_asc', label: 'App ID' },
  ];

  return (
    <Box
      py={3}
      px={{ base: 4, md: 8 }}
      bg="bg"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Flex
        direction={{ base: 'column', md: 'row' }}
        gap={3}
        align={{ base: 'stretch', md: 'center' }}
        justify="space-between"
      >
        {/* Search Input */}
        <Box position="relative" flex="1" maxW={{ md: '360px' }}>
          <Input
            placeholder="Search game title, AppID, or folder..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            size="sm"
            rounded="lg"
            paddingLeft="36px"
          />
          <Box
            position="absolute"
            left="12px"
            top="50%"
            transform="translateY(-50%)"
            color="fg.muted"
            pointerEvents="none"
          >
            <LuSearch size={16} />
          </Box>
        </Box>

        {/* Filters and View controls */}
        <HStack gap={3} wrap="wrap" justify={{ base: 'space-between', md: 'flex-end' }}>
          {/* Drive Filter Dropdown */}
          {libraries.length > 0 && (
            <AppSelect
              value={selectedLibrary}
              onChange={onLibraryChange}
              options={driveOptions}
              minWidth="145px"
            />
          )}

          {/* Sort dropdown */}
          <AppSelect
            value={sortBy}
            onChange={(val) => onSortChange(val as SortOption)}
            options={sortOptions}
            minWidth="155px"
          />

          {/* Uninstalled Games Toggle (Hidden by default) */}
          <Button
            size="xs"
            variant={showUninstalled ? 'solid' : 'outline'}
            colorPalette={showUninstalled ? 'purple' : 'gray'}
            onClick={onToggleShowUninstalled}
          >
            <LuDownload />
            {showUninstalled ? 'Showing Uninstalled' : 'Uninstalled'} ({uninstalledCount})
          </Button>

          {/* Hidden Games Toggle */}
          {hiddenCount > 0 && (
            <Button
              size="xs"
              variant={showHidden ? 'solid' : 'outline'}
              colorPalette={showHidden ? 'orange' : 'gray'}
              onClick={onToggleShowHidden}
            >
              {showHidden ? <LuEye /> : <LuEyeOff />}
              {showHidden ? 'Showing Hidden' : 'Hidden'} ({hiddenCount})
            </Button>
          )}

          {/* Add Game by AppID Button */}
          <Button
            size="xs"
            variant="subtle"
            colorPalette={palette}
            onClick={onOpenAddGame}
          >
            <LuPlus /> Add Game
          </Button>

          {/* Grid Size Switcher (only when in grid view) */}
          {viewMode === 'grid' && onGridSizeChange && (
            <HStack gap={0.5} bg="bg.muted" p={0.5} rounded="lg" borderWidth="1px" borderColor="border.subtle">
              <Button
                size="2xs"
                variant={gridSize === 'compact' ? 'solid' : 'ghost'}
                colorPalette={gridSize === 'compact' ? palette : 'gray'}
                px={1.5}
                h="24px"
                minW="24px"
                onClick={() => onGridSizeChange('compact')}
                title="Compact Grid"
              >
                S
              </Button>
              <Button
                size="2xs"
                variant={gridSize === 'medium' ? 'solid' : 'ghost'}
                colorPalette={gridSize === 'medium' ? palette : 'gray'}
                px={1.5}
                h="24px"
                minW="24px"
                onClick={() => onGridSizeChange('medium')}
                title="Medium Grid"
              >
                M
              </Button>
              <Button
                size="2xs"
                variant={gridSize === 'large' ? 'solid' : 'ghost'}
                colorPalette={gridSize === 'large' ? palette : 'gray'}
                px={1.5}
                h="24px"
                minW="24px"
                onClick={() => onGridSizeChange('large')}
                title="Large Grid"
              >
                L
              </Button>
            </HStack>
          )}

          {/* View Mode Buttons */}
          <HStack gap={1} bg="bg.muted" p={0.5} rounded="lg" borderWidth="1px" borderColor="border.subtle">
            <IconButton
              size="xs"
              variant={viewMode === 'grid' ? 'solid' : 'ghost'}
              colorPalette={viewMode === 'grid' ? palette : 'gray'}
              aria-label="Grid view"
              onClick={() => onViewModeChange('grid')}
            >
              <LuLayoutGrid size={14} />
            </IconButton>
            <IconButton
              size="xs"
              variant={viewMode === 'list' ? 'solid' : 'ghost'}
              colorPalette={viewMode === 'list' ? palette : 'gray'}
              aria-label="List view"
              onClick={() => onViewModeChange('list')}
            >
              <LuList size={14} />
            </IconButton>
          </HStack>

          <Text fontSize="xs" color="fg.muted">
            {filteredCount} of {totalCount}
          </Text>
        </HStack>
      </Flex>
    </Box>
  );
}
