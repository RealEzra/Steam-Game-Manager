import { useEffect, useRef, useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { LuCheck, LuChevronDown } from 'react-icons/lu';
import { useAppAccent } from '@/utils/theme';

export interface AppSelectOption {
  value: string;
  label: string;
}

interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md' | 'xs';
  width?: string | number;
  minWidth?: string | number;
}

export function AppSelect({
  value,
  onChange,
  options,
  placeholder,
  size = 'sm',
  width,
  minWidth = '140px',
}: AppSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { colorHex } = useAppAccent();

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const currentLabel = selectedOption ? selectedOption.label : placeholder || value;

  const height = size === 'xs' ? '24px' : size === 'md' ? '36px' : '32px';
  const fontSize = size === 'xs' ? '11px' : size === 'md' ? '14px' : '13px';
  const px = size === 'xs' ? 2 : 2.5;

  return (
    <Box ref={containerRef} position="relative" width={width} minW={minWidth} userSelect="none">
      {/* Trigger Button */}
      <Flex
        as="button"
        align="center"
        justify="space-between"
        gap={2}
        h={height}
        w="100%"
        px={px}
        fontSize={fontSize}
        rounded="lg"
        bg="bg.muted"
        borderWidth="1px"
        borderColor={isOpen ? colorHex : 'border.subtle'}
        color="fg"
        cursor="pointer"
        outline="none"
        transition="all 0.15s ease"
        _hover={{ borderColor: 'border.emphasized', bg: 'bg.subtle' }}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <Text truncate textAlign="left" flex="1">
          {currentLabel}
        </Text>
        <Box
          color="fg.muted"
          transform={isOpen ? 'rotate(180deg)' : undefined}
          transition="transform 0.15s ease"
          flexShrink={0}
        >
          <LuChevronDown size={size === 'xs' ? 12 : 14} />
        </Box>
      </Flex>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <Box
          position="absolute"
          top={`calc(${height} + 4px)`}
          left={0}
          right={0}
          minW={minWidth}
          zIndex={1500}
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border.subtle"
          rounded="xl"
          shadow="2xl"
          py={1}
          px={1}
          maxH="280px"
          overflowY="auto"
          animation="scale-fade-in 0.12s ease-out"
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <Flex
                key={opt.value}
                align="center"
                justify="space-between"
                px={2.5}
                py={1.5}
                rounded="md"
                cursor="pointer"
                fontSize={fontSize}
                color={isSelected ? colorHex : 'fg'}
                fontWeight={isSelected ? 'semibold' : 'normal'}
                bg={isSelected ? 'bg.muted' : 'transparent'}
                _hover={{ bg: 'bg.muted', color: 'fg' }}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <Text truncate>{opt.label}</Text>
                {isSelected && (
                  <Box color={colorHex} flexShrink={0} ml={2}>
                    <LuCheck size={14} />
                  </Box>
                )}
              </Flex>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
