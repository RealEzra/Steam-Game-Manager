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

export type SortOption =
  | 'name_asc'
  | 'name_desc'
  | 'size_desc'
  | 'size_asc'
  | 'updated_desc'
  | 'appid_asc';

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
            <select
              value={selectedLibrary}
              onChange={(e) => onLibraryChange(e.target.value)}
              style={{
                height: '32px',
                fontSize: '13px',
                borderRadius: '8px',
                padding: '0 10px',
                background: 'var(--chakra-colors-bg-muted)',
                color: 'var(--chakra-colors-fg)',
                border: '1px solid var(--chakra-colors-border-subtle)',
                outline: 'none',
              }}
            >
              <option value="all">All Drives ({totalCount})</option>
              {libraries.map((lib) => (
                <option key={lib.path} value={lib.path}>
                  {lib.label} ({lib.total_games})
                </option>
              ))}
            </select>
          )}

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            style={{
              height: '32px',
              fontSize: '13px',
              borderRadius: '8px',
              padding: '0 10px',
              background: 'var(--chakra-colors-bg-muted)',
              color: 'var(--chakra-colors-fg)',
              border: '1px solid var(--chakra-colors-border-subtle)',
              outline: 'none',
            }}
          >
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="size_desc">Size (Largest first)</option>
            <option value="size_asc">Size (Smallest first)</option>
            <option value="updated_desc">Recently Updated</option>
            <option value="appid_asc">App ID</option>
          </select>

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
            colorPalette="blue"
            onClick={onOpenAddGame}
          >
            <LuPlus /> Add Game
          </Button>

          {/* View Mode Buttons */}
          <HStack gap={1} bg="bg.muted" p={0.5} rounded="lg" borderWidth="1px" borderColor="border.subtle">
            <IconButton
              size="xs"
              variant={viewMode === 'grid' ? 'solid' : 'ghost'}
              colorPalette={viewMode === 'grid' ? 'blue' : 'gray'}
              aria-label="Grid view"
              onClick={() => onViewModeChange('grid')}
            >
              <LuLayoutGrid size={14} />
            </IconButton>
            <IconButton
              size="xs"
              variant={viewMode === 'list' ? 'solid' : 'ghost'}
              colorPalette={viewMode === 'list' ? 'blue' : 'gray'}
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
