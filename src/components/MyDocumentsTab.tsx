import { useEffect, useMemo, useState } from 'react';
import { Box, Flex, Heading, SimpleGrid, Spinner, Text, useColorModeValue } from '@chakra-ui/react';
import { useApp } from '../hailer/use-app';
import DocumentCard, { DocRow, groupByCategory } from './DocumentCard';

interface MyDocRow extends DocRow { employee: string | null; }
import { formatDate, formatNextAnniversary, formatTenure } from '../tenure';

const INSIGHT_MY_PROFILE = '6aa73528477a2c5b80ff48e3';
const INSIGHT_EMPLOYEE_NAMES = '6aa73900fe11781c0e7e7cd3';
const INSIGHT_MY_DOCUMENTS = '6aa3a9883a6ad1770e6a85e5';

interface ProfileRow {
  userId: string | null;
  startingDate: number | null;
  positionName: string | null;
  teamName: string | null;
  supervisorId: string | null;
  employmentType: string | null;
  workingHours: string | null;
  workEmail: string | null;
  workPhone: string | null;
  emergencyContact: string | null;
  benefits: string | null;
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const mutedText = useColorModeValue('gray.500', 'gray.400');
  return (
    <Box>
      <Text fontSize="xs" color={mutedText}>{label}</Text>
      <Text fontSize="sm" fontWeight="medium">{value || '—'}</Text>
    </Box>
  );
}

export default function MyDocumentsTab() {
  const { hailer, inside, user } = useApp();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<MyDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!inside || !hailer) return;
    setLoading(true);
    Promise.all([
      hailer.insight.data(INSIGHT_MY_PROFILE, { update: true }),
      hailer.insight.data(INSIGHT_EMPLOYEE_NAMES, { update: true }),
      hailer.insight.data(INSIGHT_MY_DOCUMENTS, { update: true }),
    ]).then(([profileData, nameData, docData]) => {
      setProfiles(parseInsight(profileData) as unknown as ProfileRow[]);
      const nameMap: Record<string, string> = {};
      parseInsight(nameData).forEach(r => { nameMap[r.id as string] = r.name as string; });
      setNames(nameMap);
      setDocs(parseInsight(docData).map(r => ({
        id: r.id as string,
        name: r.name as string,
        category: (r.category as string) || null,
        file: (r.file as string) || null,
        description: (r.description as string) || null,
        employee: (r.employee as string) || null,
      })));
      setLoading(false);
    }).catch(err => { setError(String(err)); setLoading(false); });
  }, [inside, hailer]);

  const myProfile = useMemo(
    () => profiles.find(p => p.userId === user.current?._id) || null,
    [profiles, user.current],
  );

  const myDocs = useMemo(
    () => docs.filter(d => d.employee === user.current?._id),
    [docs, user.current],
  );

  if (loading) return <Flex justify="center" py={12}><Spinner size="lg" /></Flex>;
  if (error) return <Text color="red.500">{error}</Text>;

  const groups = groupByCategory(myDocs);
  const supervisorName = myProfile?.supervisorId ? names[myProfile.supervisorId] : null;

  return (
    <Box>
      {!myProfile ? (
        <Text color={mutedText} fontSize="sm" mb={6}>
          Your employment profile hasn't been set up yet — contact HR.
        </Text>
      ) : (
        <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" p={5} mb={6}>
          <Text fontSize="xs" fontWeight="semibold" color={mutedText} textTransform="uppercase" mb={3}>
            Employment
          </Text>
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing={4} mb={4}>
            <Field label="Start Date" value={formatDate(myProfile.startingDate)} />
            <Field label="Years of Service" value={formatTenure(myProfile.startingDate)} />
            <Field label="Next Anniversary" value={formatNextAnniversary(myProfile.startingDate)} />
          </SimpleGrid>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
            <Field label="Position" value={myProfile.positionName} />
            <Field label="Team" value={myProfile.teamName} />
            {supervisorName && <Field label="Supervisor" value={supervisorName} />}
            <Field label="Employment Type" value={myProfile.employmentType} />
            <Field label="Working Hours" value={myProfile.workingHours} />
          </SimpleGrid>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={myProfile.benefits ? 4 : 0}>
            <Field label="Work Email" value={myProfile.workEmail} />
            <Field label="Work Phone" value={myProfile.workPhone} />
            {myProfile.emergencyContact && <Field label="Emergency Contact (ICE)" value={myProfile.emergencyContact} />}
          </SimpleGrid>
          {myProfile.benefits && (
            <Box>
              <Text fontSize="xs" color={mutedText}>Benefits</Text>
              <Text fontSize="sm" fontWeight="medium" whiteSpace="pre-wrap">{myProfile.benefits}</Text>
            </Box>
          )}
        </Box>
      )}

      <Text color={mutedText} fontSize="sm" mb={4}>
        Your personal employment documents — insurance cards, medical insurance forms, and other
        records specific to you. Managed by HR.
      </Text>
      {groups.length === 0 ? (
        <Text color={mutedText} fontSize="sm">
          No personal documents on file yet — contact HR if you're expecting one.
        </Text>
      ) : (
        groups.map(({ category, rows }) => (
          <Box key={category} mb={6}>
            <Heading size="sm" mb={3}>{category}</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {rows.map(doc => <DocumentCard key={doc.id} doc={doc} downloadMode="public" />)}
            </SimpleGrid>
          </Box>
        ))
      )}
    </Box>
  );
}
