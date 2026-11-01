import { useEffect, useState } from 'react';
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { invoke } from '@tauri-apps/api/core';

interface TitleBarProps {
  title?: string;
}

export function TitleBar({ title = 'Steam Game Manager' }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    invoke<boolean>('app_window_is_maximized')
      .then((max) => setIsMaximized(max))
      .catch(() => {});

    // Listen to resize to keep maximized state in sync
    const handleResize = () => {
      invoke<boolean>('app_window_is_maximized')
        .then((max) => setIsMaximized(max))
        .catch(() => {});
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('app_window_minimize');
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  };

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const newMaxState = await invoke<boolean>('app_window_toggle_maximize');
      setIsMaximized(newMaxState);
    } catch (err) {
      console.error('Failed to toggle maximize:', err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('app_window_close');
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  return (
    <Flex
      as="header"
      data-tauri-drag-region
      onContextMenu={(e) => e.preventDefault()}
      h="32px"
      bg="bg.panel"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      align="center"
      justify="space-between"
      userSelect="none"
      position="sticky"
      top={0}
      zIndex={100}
      onDoubleClick={() => handleToggleMaximize()}
      cursor="default"
    >
      {/* Left: App Icon & Title */}
      <HStack
        gap={2}
        px={3}
        h="100%"
        align="center"
        pointerEvents="none"
        data-tauri-drag-region
      >
        <Box display="flex" alignItems="center">
          <img src="/app-icon.svg" width="16" height="16" style={{ borderRadius: '3px' }} alt="" />
        </Box>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color="fg.muted"
          letterSpacing="0.02em"
          lineHeight="1"
        >
          {title}
        </Text>
      </HStack>

      {/* Center: Draggable Spacer */}
      <Box flex="1" h="100%" data-tauri-drag-region />

      {/* Right: Window Controls (Discord / Spotify Style) */}
      <HStack gap={0} h="100%" align="stretch">
        {/* Minimize Button */}
        <WindowControlButton
          ariaLabel="Minimize"
          onClick={handleMinimize}
          hoverBg="rgba(255, 255, 255, 0.08)"
          activeBg="rgba(255, 255, 255, 0.14)"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <path fill="currentColor" d="M0 0h10v1H0z" />
          </svg>
        </WindowControlButton>

        {/* Maximize / Restore Button */}
        <WindowControlButton
          ariaLabel={isMaximized ? 'Restore' : 'Maximize'}
          onClick={handleToggleMaximize}
          hoverBg="rgba(255, 255, 255, 0.08)"
          activeBg="rgba(255, 255, 255, 0.14)"
        >
          {isMaximized ? (
            /* Restore Icon (overlapping squares) */
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                fill="currentColor"
                d="M2 0v2H0v8h8V8h2V0H2zm6 7H1V3h7v4zm1-1V1H3v1h5v4h1z"
              />
            </svg>
          ) : (
            /* Maximize Icon (single square outline) */
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path
                fill="currentColor"
                d="M0 0v10h10V0H0zm1 1h8v8H1V1z"
              />
            </svg>
          )}
        </WindowControlButton>

        {/* Close Button (Discord / Windows signature red hover) */}
        <WindowControlButton
          ariaLabel="Close"
          onClick={handleClose}
          hoverBg="#ed4245"
          hoverColor="#ffffff"
          activeBg="#c03537"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              fill="currentColor"
              d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z"
            />
          </svg>
        </WindowControlButton>
      </HStack>
    </Flex>
  );
}

interface WindowControlButtonProps {
  children: React.ReactNode;
  ariaLabel: string;
  onClick: (e: React.MouseEvent) => void;
  hoverBg: string;
  hoverColor?: string;
  activeBg?: string;
}

function WindowControlButton({
  children,
  ariaLabel,
  onClick,
  hoverBg,
  hoverColor,
  activeBg,
}: WindowControlButtonProps) {
  return (
    <Box
      as="button"
      aria-label={ariaLabel}
      w="46px"
      h="100%"
      display="flex"
      alignItems="center"
      justifyContent="center"
      color="fg.muted"
      bg="transparent"
      border="none"
      outline="none"
      cursor="pointer"
      transition="all 0.1s ease"
      _hover={{
        bg: hoverBg,
        color: hoverColor || 'fg',
      }}
      _active={{
        bg: activeBg || hoverBg,
      }}
      onClick={onClick}
    >
      {children}
    </Box>
  );
}

