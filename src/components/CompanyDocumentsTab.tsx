import { useEffect, useState } from 'react';
import { Box, Flex, Heading, SimpleGrid, Spinner, Text } from '@chakra-ui/react';
import { useApp } from '../hailer/use-app';
import DocumentCard, { DocRow, groupByCategory } from './DocumentCard';

const INSIGHT_COMPANY_DOCS = '6aa3a9883a6ad1770e6a85e0';

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

export default function CompanyDocumentsTab() {
  const { hailer, inside } = useApp();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inside || !hailer) return;
    setLoading(true);
    hailer.insight.data(INSIGHT_COMPANY_DOCS, { update: true })
      .then(data => {
        setDocs(parseInsight(data).map(r => ({
          id: r.id as string,
          name: r.name as string,
          category: (r.category as string) || null,
          file: (r.file as string) || null,
          description: (r.description as string) || null,
        })));
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, hailer]);

  if (loading) return <Flex justify="center" py={12}><Spinner size="lg" /></Flex>;
  if (error) return <Text color="red.500">{error}</Text>;

  const groups = groupByCategory(docs);

  return (
    <Box>
      <Text color="subtleText" fontSize="sm" mb={6}>
        Company-wide reference documents — the same for every employee. Managed by HR.
      </Text>
      {groups.length === 0 ? (
        <Text color="subtleText">No company documents have been added yet.</Text>
      ) : (
        groups.map(({ category, rows }) => (
          <Box key={category} mb={6}>
            <Heading size="sm" mb={3}>{category}</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {rows.map(doc => <DocumentCard key={doc.id} doc={doc} downloadMode="session" />)}
            </SimpleGrid>
          </Box>
        ))
      )}
    </Box>
  );
}
