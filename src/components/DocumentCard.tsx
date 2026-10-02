import { Badge, Box, Button, Flex, Text, useColorModeValue } from '@chakra-ui/react';

// modifier.file:true fields store a JSON-stringified array of file IDs — parse it, don't
// treat the raw value as one ID. Same pattern used throughout this workspace's apps.
export function firstFileId(raw: unknown): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed[0];
  } catch {
    if (typeof raw === 'string') return raw;
  }
  return undefined;
}

export interface DocRow {
  id: string;
  name: string;
  category: string | null;
  file: string | null; // raw insight value — JSON array string or null
  description: string | null;
}

/** Groups rows by category, preserving first-seen category order. */
export function groupByCategory(rows: DocRow[]): { category: string; rows: DocRow[] }[] {
  const order: string[] = [];
  const map = new Map<string, DocRow[]>();
  for (const r of rows) {
    const cat = r.category || 'Other';
    if (!map.has(cat)) { map.set(cat, []); order.push(cat); }
    map.get(cat)!.push(r);
  }
  return order.map(category => ({ category, rows: map.get(category)! }));
}

interface Props {
  doc: DocRow;
  // Company Documents: every employee has "any" workflow permission, so the normal
  // session-authenticated route works. Employee Documents: permission is deliberately
  // NOT broadened (personal/sensitive — insurance cards, medical forms), so only files
  // uploaded with isPublic:true are reachable for the owning employee, via the public
  // route. Pre-existing private Employee Documents files need a one-time re-upload to
  // pick this up — same limitation as Online Orders' documents earlier in this workspace.
  downloadMode: 'session' | 'public';
}

export default function DocumentCard({ doc, downloadMode }: Props) {
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  const fileId = firstFileId(doc.file);
  const downloadUrl = fileId
    ? `https://api.hailer.com/${downloadMode === 'public' ? 'public/file' : 'file'}/${fileId}`
    : undefined;

  return (
    <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={4} h="100%">
      <Flex justify="space-between" align="start" mb={1}>
        <Text fontWeight="semibold" fontSize="sm">📄 {doc.name}</Text>
        {doc.category && (
          <Badge fontSize="2xs" colorScheme="gray" whiteSpace="nowrap" ml={2}>
            {doc.category.toUpperCase()}
          </Badge>
        )}
      </Flex>
      {doc.description && (
        <Text fontSize="xs" color={mutedText} mb={3}>{doc.description}</Text>
      )}
      {downloadUrl ? (
        <Button
          as="a"
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          size="xs"
          variant="outline"
          leftIcon={<span>⬇</span>}
        >
          Download
        </Button>
      ) : (
        <Text fontSize="xs" color="orange.400">No file attached yet</Text>
      )}
    </Box>
  );
}
