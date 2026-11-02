import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  Icon,
  Input,
  Spinner,
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
import {
  LuBookOpen,
  LuCheck,
  LuExternalLink,
  LuRefreshCw,
  LuSparkles,
  LuWrench,
} from 'react-icons/lu';
import {
  ChangelogSection,
  ChangelogVersion,
  getChangelog,
} from '@/utils/changelog';
import { useAppAccent } from '@/utils/theme';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAppVersion?: string;
}

export function ChangelogModal({
  isOpen,
  onClose,
  currentAppVersion = '0.9.4',
}: ChangelogModalProps) {
  const { palette, colorHex } = useAppAccent();
  const [versions, setVersions] = useState<ChangelogVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const loadChangelogData = async (force = false) => {
    setIsLoading(true);
    try {
      const data = await getChangelog(force);
      setVersions(data.versions);
      if (!selectedVersion && data.versions.length > 0) {
        setSelectedVersion(data.versions[0].version);
      }
    } catch (e) {
      console.error('Failed to load changelog:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadChangelogData();
    }
  }, [isOpen]);

  // Filter versions by search term
  const filteredVersions = versions.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (v.version.toLowerCase().includes(q)) return true;
    if (v.rawText.toLowerCase().includes(q)) return true;
    return false;
  });

  const activeVersion =
    versions.find((v) => v.version === selectedVersion) ||
    filteredVersions[0] ||
    versions[0];

  const getSectionColor = (type: ChangelogSection['type']) => {
    switch (type) {
      case 'Added':
        return 'green';
      case 'Fixed':
        return 'cyan';
      case 'Changed':
        return 'purple';
      case 'Removed':
        return 'red';
      case 'Security':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getSectionIcon = (type: ChangelogSection['type']) => {
    switch (type) {
      case 'Added':
        return LuSparkles;
      case 'Fixed':
        return LuWrench;
      default:
        return LuCheck;
    }
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
      size="xl"
    >
      <DialogContent rounded="2xl" maxW="880px" maxH="85vh" p={6}>
        <DialogHeader p={0} mb={4}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
            <HStack gap={2.5}>
              <Box p={2} rounded="lg" bg={`${palette}.500/15`} color={colorHex}>
                <LuBookOpen size={20} />
              </Box>
              <Box>
                <DialogTitle fontSize="lg" fontWeight="bold">
                  What's New & Release Changelog
                </DialogTitle>
                <Text fontSize="xs" color="fg.muted">
                  Full version history and detailed release notes directly from GitHub
                </Text>
              </Box>
            </HStack>

            <HStack gap={2} mr={8}>
              <Button
                size="xs"
                variant="ghost"
                loading={isLoading}
                onClick={() => loadChangelogData(true)}
              >
                <LuRefreshCw /> Refresh
              </Button>
              <a
                href="https://github.com/RealEzra/Steam-Game-Manager/blob/main/CHANGELOG.md"
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '11px',
                  color: colorHex,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'none',
                }}
              >
                View on GitHub <LuExternalLink size={11} />
              </a>
            </HStack>
          </Flex>
          <DialogCloseTrigger top={4} insetEnd={4} />
        </DialogHeader>

        <DialogBody p={0} overflow="hidden">
          {isLoading && versions.length === 0 ? (
            <Flex justify="center" align="center" minH="280px" direction="column" gap={3}>
              <Spinner size="lg" color={colorHex} />
              <Text fontSize="sm" color="fg.muted">
                Fetching latest changelog from GitHub...
              </Text>
            </Flex>
          ) : (
            <Flex gap={5} minH="440px" maxH="58vh" direction={{ base: 'column', md: 'row' }}>
              {/* Left sidebar: version list & search */}
              <Box
                w={{ base: '100%', md: '240px' }}
                flexShrink={0}
                borderRightWidth={{ base: '0px', md: '1px' }}
                borderColor="border.subtle"
                pr={{ base: 0, md: 3 }}
                display="flex"
                flexDirection="column"
              >
                <Box mb={3} position="relative">
                  <Input
                    placeholder="Search changelog..."
                    size="xs"
                    rounded="lg"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </Box>

                <VStack gap={1.5} align="stretch" overflowY="auto" flex="1" pr={1}>
                  {filteredVersions.map((v) => {
                    const isSelected = activeVersion?.version === v.version;
                    const isCurrent = v.version === currentAppVersion;

                    return (
                      <Box
                        key={v.version}
                        p={2.5}
                        rounded="lg"
                        cursor="pointer"
                        bg={
                          isSelected
                            ? `${palette}.500/15`
                            : 'transparent'
                        }
                        borderWidth="1px"
                        borderColor={isSelected ? colorHex : 'transparent'}
                        _hover={{
                          bg: isSelected ? `${palette}.500/20` : 'bg.muted',
                        }}
                        onClick={() => setSelectedVersion(v.version)}
                        transition="all 0.15s ease"
                      >
                        <Flex justify="space-between" align="center">
                          <HStack gap={1.5}>
                            <Text
                              fontSize="xs"
                              fontWeight={isSelected ? 'bold' : 'medium'}
                              color={isSelected ? colorHex : 'fg'}
                            >
                              v{v.version}
                            </Text>
                            {isCurrent && (
                              <Badge size="xs" colorPalette="green" variant="solid">
                                Current
                              </Badge>
                            )}
                          </HStack>
                          {v.date && (
                            <Text fontSize="2xs" color="fg.muted">
                              {v.date}
                            </Text>
                          )}
                        </Flex>
                      </Box>
                    );
                  })}
                  {filteredVersions.length === 0 && (
                    <Text fontSize="xs" color="fg.muted" textAlign="center" py={4}>
                      No versions match "{searchQuery}"
                    </Text>
                  )}
                </VStack>
              </Box>

              {/* Right content: details of selected version */}
              <Box flex="1" overflowY="auto" pl={{ base: 0, md: 1 }} pr={2}>
                {activeVersion ? (
                  <VStack gap={4} align="stretch">
                    <Flex justify="space-between" align="center" borderBottomWidth="1px" borderColor="border.subtle" pb={2.5}>
                      <HStack gap={2}>
                        <Heading size="md" fontWeight="bold">
                          Version {activeVersion.version}
                        </Heading>
                        {activeVersion.version === currentAppVersion && (
                          <Badge colorPalette="green" size="sm">
                            Currently Running
                          </Badge>
                        )}
                      </HStack>
                      {activeVersion.date && (
                        <Text fontSize="xs" color="fg.muted">
                          Released {activeVersion.date}
                        </Text>
                      )}
                    </Flex>

                    {activeVersion.sections.map((section, idx) => {
                      const color = getSectionColor(section.type);
                      const SectionIcon = getSectionIcon(section.type);

                      return (
                        <Box
                          key={idx}
                          p={3.5}
                          rounded="xl"
                          bg="bg.muted"
                          borderWidth="1px"
                          borderColor="border.subtle"
                        >
                          <HStack gap={2} mb={2.5}>
                            <Badge colorPalette={color} size="sm" variant="subtle">
                              <Icon as={SectionIcon} mr={1} />
                              {section.type.toUpperCase()}
                            </Badge>
                          </HStack>

                          <VStack gap={2.5} align="stretch">
                            {section.items.map((item, itemIdx) => (
                              <Box key={itemIdx} pl={1}>
                                <HStack align="flex-start" gap={2}>
                                  <Text color={colorHex} fontSize="sm" lineHeight="1.2">
                                    •
                                  </Text>
                                  <Box flex="1">
                                    {item.title && (
                                      <Text fontSize="xs" fontWeight="bold" display="inline" mr={1}>
                                        {item.title}:
                                      </Text>
                                    )}
                                    <Text fontSize="xs" color="fg" display="inline">
                                      {item.description}
                                    </Text>

                                    {item.subItems && item.subItems.length > 0 && (
                                      <VStack gap={1} align="stretch" mt={1.5} pl={4}>
                                        {item.subItems.map((sub, sIdx) => (
                                          <HStack key={sIdx} align="flex-start" gap={2}>
                                            <Text color="fg.muted" fontSize="2xs" lineHeight="1.4">
                                              -
                                            </Text>
                                            <Text fontSize="2xs" color="fg.muted">
                                              {sub}
                                            </Text>
                                          </HStack>
                                        ))}
                                      </VStack>
                                    )}
                                  </Box>
                                </HStack>
                              </Box>
                            ))}
                          </VStack>
                        </Box>
                      );
                    })}

                    {activeVersion.sections.length === 0 && (
                      <Box
                        p={3}
                        rounded="lg"
                        bg="bg.muted"
                        fontFamily="mono"
                        fontSize="2xs"
                        whiteSpace="pre-wrap"
                      >
                        {activeVersion.rawText}
                      </Box>
                    )}
                  </VStack>
                ) : (
                  <Flex justify="center" align="center" minH="200px">
                    <Text fontSize="sm" color="fg.muted">
                      Select a version to inspect release notes.
                    </Text>
                  </Flex>
                )}
              </Box>
            </Flex>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
