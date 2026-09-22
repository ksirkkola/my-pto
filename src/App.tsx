import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, AlertIcon,
  Badge, Box, Button, Divider, Flex, FormControl, FormLabel, Heading,
  HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, NumberInput, NumberInputField,
  Progress, Select, SimpleGrid, Spinner, Stat, StatHelpText, StatLabel,
  StatNumber, Table, Tbody, Td, Text, Th, Thead, Tr, useColorModeValue,
  useDisclosure, useToast, VStack, Textarea,
} from '@chakra-ui/react';
import { useApp } from './hailer/use-app';
import { getFinnishHolidays } from './finnishHolidays';

const INSIGHT_MY_BALANCE = '6a9aff8368b2d1b98a71c0e7';
const INSIGHT_MY_REQUESTS = '6a9aff8368b2d1b98a71c0eb';
const INSIGHT_HOLIDAY_WINDOWS = '6a9b055268b2d1b98a71d17b';

const WF_REQUEST = '6a717f77a8140c7b12b1ceac';
const PHASE_PENDING = '6a717fac693253992c87719e';

// PTO Request field IDs
const RF_EMPLOYEE = '6a717fe74af977ffe55b3de5';
const RF_TYPE = '6a717fe74af977ffe55b3de9';
const RF_START = '6a717fe74af977ffe55b3ded';
const RF_END = '6a717fe74af977ffe55b3df1';
const RF_DAYS = '6a717fe74af977ffe55b3df5';
const RF_EMP_NOTE = '6a717fe74af977ffe55b3df9';

const PTO_TYPES = ['Vacation', 'Sick Leave', 'Personal', 'Public Holiday', 'Other'];

const REQUEST_COLOR: Record<string, string> = {
  Pending: 'yellow', Approved: 'green', Denied: 'red', Cancelled: 'gray',
};

interface BalanceRow {
  id: string; employee: string | null; year: string | null;
  leaveYearStart: number | null; totalDays: number | null;
  daysUsed: number | null; daysPending: number | null; daysRemaining: number | null;
}

interface RequestRow {
  id: string; name: string; phase: string;
  employee: string | null; ptoType: string | null;
  startDate: number | null; endDate: number | null;
  daysRequested: number | null; employeeNotes: string | null;
  managerNotes: string | null;
}

interface HolidayWindows {
  summerStart: string | null; summerEnd: string | null;
  winterStart: string | null; winterEnd: string | null;
  guidanceNote: string | null; medicalLeaveNote: string | null;
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

function fmtDate(val: unknown): string {
  if (!val || isNaN(Number(val))) return '—';
  const n = Number(val);
  const ms = n > 1e10 ? n : n * 1000;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Finland's holiday accrual year runs 1 April - 31 March, not the calendar
// year — matches the "Year" label PTO Balance's own function field computes.
function computeCurrentLeaveYear(): string {
  const now = new Date();
  const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${startYear}/${startYear + 1}`;
}
const currentLeaveYear = computeCurrentLeaveYear();

export default function App() {
  const { hailer, api, inside, user } = useApp();
  const toast = useToast();
  const { isOpen: isRequestOpen, onOpen: onRequestOpen, onClose: onRequestClose } = useDisclosure();
  const { isOpen: isSickOpen, onOpen: onSickOpen, onClose: onSickClose } = useDisclosure();

  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [windows, setWindows] = useState<HolidayWindows | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sickSubmitting, setSickSubmitting] = useState(false);
  const [newReq, setNewReq] = useState({
    ptoType: 'Vacation', startDate: '', endDate: '', daysRequested: '', notes: '',
  });
  const todayStr = new Date().toISOString().slice(0, 10);
  const [newSick, setNewSick] = useState({ startDate: todayStr, endDate: todayStr, notes: '' });
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const certUploadRef = useRef<Promise<string> | null>(null);

  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText = useColorModeValue('gray.600', 'gray.400');
  const theadBg = useColorModeValue('gray.50', 'gray.800');
  const trackBg = useColorModeValue('gray.100', 'gray.600');

  useEffect(() => {
    void api.init();
  }, [api]);

  const currentUser = user.current;

  // Rolling year-ahead list of Finland's public holidays (office closed) —
  // computed client-side so it's always correct, no yearly data maintenance.
  const upcomingHolidays = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const all = [now.getFullYear(), now.getFullYear() + 1].flatMap(y => getFinnishHolidays(y));
    return all
      .filter(h => h.date.getTime() >= startOfToday.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 14);
  }, []);

  useEffect(() => {
    if (!inside || !hailer || !currentUser) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [bal, req, win] = await Promise.all([
          hailer.insight.data(INSIGHT_MY_BALANCE, { update: true }),
          hailer.insight.data(INSIGHT_MY_REQUESTS, { update: true }),
          hailer.insight.data(INSIGHT_HOLIDAY_WINDOWS, { update: true }),
        ]);
        if (cancelled) return;
        setBalances(parseInsight(bal) as unknown as BalanceRow[]);
        setRequests(parseInsight(req) as unknown as RequestRow[]);
        const winRows = parseInsight(win) as unknown as HolidayWindows[];
        setWindows(winRows[0] || null);
      } catch (err) {
        toast({ title: 'Could not load your PTO data', description: String(err), status: 'error', duration: 4000 });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [inside, hailer, currentUser, toast]);

  const myBalance = useMemo(
    () => balances.find(b => b.employee === currentUser?._id && b.year === currentLeaveYear) || null,
    [balances, currentUser],
  );

  const myRequests = useMemo(
    () => requests
      .filter(r => r.employee === currentUser?._id)
      .sort((a, b) => (b.startDate || 0) - (a.startDate || 0)),
    [requests, currentUser],
  );

  async function refresh() {
    if (!hailer) return;
    const [bal, req] = await Promise.all([
      hailer.insight.data(INSIGHT_MY_BALANCE, { update: true }),
      hailer.insight.data(INSIGHT_MY_REQUESTS, { update: true }),
    ]);
    setBalances(parseInsight(bal) as unknown as BalanceRow[]);
    setRequests(parseInsight(req) as unknown as RequestRow[]);
  }

  async function submitRequest() {
    if (!newReq.startDate || !newReq.endDate || !newReq.daysRequested) {
      toast({ title: 'Please fill in all required fields', status: 'warning', duration: 3000 });
      return;
    }
    setSubmitting(true);
    try {
      await hailer!.activity.create(WF_REQUEST, [{
        name: `PTO - ${currentUser?.firstname} ${currentUser?.lastname} - ${newReq.startDate}`,
        phaseId: PHASE_PENDING,
        fields: {
          [RF_EMPLOYEE]: currentUser?._id || '',
          [RF_TYPE]: newReq.ptoType,
          [RF_START]: newReq.startDate,
          [RF_END]: newReq.endDate,
          [RF_DAYS]: Number(newReq.daysRequested),
          [RF_EMP_NOTE]: newReq.notes,
        },
      }], {});
      toast({ title: 'PTO request submitted', description: 'HR will review it soon.', status: 'success', duration: 3000 });
      onRequestClose();
      setNewReq({ ptoType: 'Vacation', startDate: '', endDate: '', daysRequested: '', notes: '' });
      await refresh();
    } catch (err) {
      toast({ title: 'Could not submit your request', description: String(err), status: 'error', duration: 4000 });
    }
    setSubmitting(false);
  }

  function handleCertificateSelected(file: File | null) {
    setCertificateFile(file);
    certUploadRef.current = file ? hailer!.file.upload(file, file.name, {}) : null;
  }

  async function submitSickLeave() {
    if (!newSick.startDate || !newSick.endDate) {
      toast({ title: 'Please fill in the start and end date', status: 'warning', duration: 3000 });
      return;
    }
    setSickSubmitting(true);
    try {
      const days = Math.round((new Date(newSick.endDate).getTime() - new Date(newSick.startDate).getTime()) / 86400000) + 1;
      const fileId = certUploadRef.current ? await certUploadRef.current : null;
      await hailer!.activity.create(WF_REQUEST, [{
        name: `Sick Leave - ${currentUser?.firstname} ${currentUser?.lastname} - ${newSick.startDate}`,
        phaseId: PHASE_PENDING,
        fields: {
          [RF_EMPLOYEE]: currentUser?._id || '',
          [RF_TYPE]: 'Sick Leave',
          [RF_START]: newSick.startDate,
          [RF_END]: newSick.endDate,
          [RF_DAYS]: Math.max(days, 1),
          [RF_EMP_NOTE]: newSick.notes,
        },
      }], fileId ? { fileIds: [fileId] } : {});
      toast({ title: 'Sick leave reported', description: 'Feel better soon — HR has been notified.', status: 'success', duration: 3000 });
      onSickClose();
      setNewSick({ startDate: todayStr, endDate: todayStr, notes: '' });
      setCertificateFile(null);
      certUploadRef.current = null;
      await refresh();
    } catch (err) {
      toast({ title: 'Could not submit your sick leave report', description: String(err), status: 'error', duration: 4000 });
    }
    setSickSubmitting(false);
  }

  if (!inside) {
    return (
      <Box p={8}>
        <Text color="subtleText">Open this app inside Hailer to request PTO and see your balance.</Text>
      </Box>
    );
  }

  return (
    <Box p={8} maxW="900px" mx="auto">
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg">🌴 My PTO</Heading>
          <Text color={mutedText} fontSize="sm">
            {currentUser ? `${currentUser.firstname} ${currentUser.lastname}` : ''} — {currentLeaveYear}
          </Text>
        </Box>
        <HStack spacing={3}>
          <Button variant="outline" colorScheme="red" onClick={onSickOpen}>+ Report Sick Leave</Button>
          <Button colorScheme="blue" onClick={onRequestOpen}>+ Request PTO</Button>
        </HStack>
      </Flex>

      {loading ? (
        <Flex justify="center" py={16}><Spinner size="lg" /></Flex>
      ) : (
        <VStack spacing={6} align="stretch">
          {/* Holiday windows — reference only, not enforced. Finnish holiday law
              splits leave into a summer window and a winter window. */}
          {windows && (windows.summerStart || windows.winterStart) && (
            <Alert status="info" borderRadius="md" alignItems="flex-start">
              <AlertIcon mt={0.5} />
              <Box fontSize="sm">
                <Text fontWeight="bold" mb={1}>When you can take holiday</Text>
                <Text>
                  Summer holiday: <strong>{windows.summerStart} – {windows.summerEnd}</strong>
                  {' · '}Winter holiday: <strong>{windows.winterStart} – {windows.winterEnd}</strong>
                </Text>
                {windows.guidanceNote && (
                  <Text color={mutedText} mt={1}>{windows.guidanceNote}</Text>
                )}
              </Box>
            </Alert>
          )}

          {/* Medical leave guidance — reference only. */}
          {windows?.medicalLeaveNote && (
            <Alert status="info" borderRadius="md" alignItems="flex-start">
              <AlertIcon mt={0.5} />
              <Box fontSize="sm">
                <Text fontWeight="bold" mb={1}>Sick pay while on medical leave</Text>
                <Text color={mutedText}>{windows.medicalLeaveNote}</Text>
              </Box>
            </Alert>
          )}

          {/* Finland public holidays — the office is closed on these days.
              These are NOT PTO and don't need a request; shown for reference
              so you know what's coming up. Computed client-side, always
              current — no yearly data maintenance needed. */}
          <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5}>
            <Heading size="sm" mb={1}>🇫🇮 Finland Public Holidays — Office Closed</Heading>
            <Text fontSize="xs" color={mutedText} mb={4}>
              These days don't count against your PTO — the office is simply closed.
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacingX={8} spacingY={1}>
              {upcomingHolidays.map(h => (
                <Flex key={h.name + h.date.toISOString()} justify="space-between" py={1}
                  borderBottom="1px" borderColor={borderColor}>
                  <Text fontSize="sm">{h.name}</Text>
                  <Text fontSize="sm" color={mutedText} whiteSpace="nowrap" ml={3}>
                    {h.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  </Text>
                </Flex>
              ))}
            </SimpleGrid>
          </Box>

          {/* My Balance — a personal accrual ledger, for your own knowledge. Not an
              official system of record; contact HR if something looks off. */}
          <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5}>
            <Heading size="sm" mb={4}>My Balance — {currentLeaveYear}</Heading>
            {!myBalance ? (
              <Text color={mutedText} fontSize="sm">
                Your PTO balance for this leave year hasn't been set up yet — contact HR.
              </Text>
            ) : (
              <>
                <Text fontSize="sm" color={mutedText} mb={4}>
                  You started accruing PTO for this leave year on <strong>{fmtDate(myBalance.leaveYearStart)}</strong>.
                </Text>
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
                  <Stat>
                    <StatLabel>Accrued</StatLabel>
                    <StatNumber>{myBalance.totalDays ?? 0}</StatNumber>
                    <StatHelpText>days total</StatHelpText>
                  </Stat>
                  <Stat>
                    <StatLabel>Used</StatLabel>
                    <StatNumber color="red.500">{myBalance.daysUsed ?? 0}</StatNumber>
                    <StatHelpText>days taken</StatHelpText>
                  </Stat>
                  <Stat>
                    <StatLabel>Pending</StatLabel>
                    <StatNumber color="yellow.500">{myBalance.daysPending ?? 0}</StatNumber>
                    <StatHelpText>awaiting approval</StatHelpText>
                  </Stat>
                  <Stat>
                    <StatLabel>Remaining</StatLabel>
                    <StatNumber color="green.500">{myBalance.daysRemaining ?? 0}</StatNumber>
                    <StatHelpText>days left</StatHelpText>
                  </Stat>
                </SimpleGrid>
                <Progress
                  value={myBalance.totalDays ? ((myBalance.daysUsed || 0) / myBalance.totalDays) * 100 : 0}
                  size="sm" borderRadius="full" colorScheme="blue" bg={trackBg}
                />
              </>
            )}
          </Box>

          <Divider />

          {/* My Requests */}
          <Box bg={cardBg} border="1px" borderColor={borderColor} borderRadius="md" shadow="sm" p={5}>
            <Heading size="sm" mb={4}>My Requests</Heading>
            {myRequests.length === 0 ? (
              <Text color={mutedText} fontSize="sm">You haven't submitted any PTO requests yet.</Text>
            ) : (
              <Table variant="simple" size="sm">
                <Thead bg={theadBg}>
                  <Tr>
                    <Th>Type</Th>
                    <Th>Dates</Th>
                    <Th isNumeric>Days</Th>
                    <Th>Status</Th>
                    <Th>Notes</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {myRequests.map(r => (
                    <Tr key={r.id}>
                      <Td>{r.ptoType || '—'}</Td>
                      <Td>{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</Td>
                      <Td isNumeric>{r.daysRequested ?? '—'}</Td>
                      <Td><Badge colorScheme={REQUEST_COLOR[r.phase] || 'gray'}>{r.phase}</Badge></Td>
                      <Td fontSize="xs" color={mutedText}>
                        {r.phase === 'Denied' && r.managerNotes ? `Denied: ${r.managerNotes}` : (r.employeeNotes || '—')}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Box>
        </VStack>
      )}

      {/* Request PTO Modal */}
      <Modal isOpen={isRequestOpen} onClose={onRequestClose} size="md" trapFocus={false} autoFocus={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Request PTO</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">PTO Type</FormLabel>
                <Select value={newReq.ptoType} onChange={e => setNewReq(p => ({ ...p, ptoType: e.target.value }))}>
                  {PTO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Start Date</FormLabel>
                <Input type="date" value={newReq.startDate} onChange={e => setNewReq(p => ({ ...p, startDate: e.target.value }))} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">End Date</FormLabel>
                <Input type="date" value={newReq.endDate} onChange={e => setNewReq(p => ({ ...p, endDate: e.target.value }))} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Number of Days</FormLabel>
                <NumberInput min={0.5}>
                  <NumberInputField value={newReq.daysRequested}
                    onChange={e => setNewReq(p => ({ ...p, daysRequested: e.target.value }))} />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Notes (optional)</FormLabel>
                <Textarea rows={3} value={newReq.notes}
                  onChange={e => setNewReq(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional information..." />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onRequestClose}>Cancel</Button>
            <Button colorScheme="blue" isLoading={submitting} onClick={submitRequest}>Submit Request</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Report Sick Leave Modal */}
      <Modal isOpen={isSickOpen} onClose={onSickClose} size="md" trapFocus={false} autoFocus={false}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Report Sick Leave</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">First Day Sick</FormLabel>
                <Input type="date" value={newSick.startDate} onChange={e => setNewSick(p => ({ ...p, startDate: e.target.value }))} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">Last Day Sick (or expected)</FormLabel>
                <Input type="date" value={newSick.endDate} onChange={e => setNewSick(p => ({ ...p, endDate: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Notes (optional)</FormLabel>
                <Textarea rows={3} value={newSick.notes}
                  onChange={e => setNewSick(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Anything HR should know..." />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Medical Certificate (optional)</FormLabel>
                <Input type="file" accept="image/*,application/pdf" p={1}
                  onChange={e => handleCertificateSelected(e.target.files?.[0] || null)} />
                {certificateFile && (
                  <Text fontSize="xs" color={mutedText} mt={1}>Attached: {certificateFile.name}</Text>
                )}
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onSickClose}>Cancel</Button>
            <Button colorScheme="red" isLoading={sickSubmitting} onClick={submitSickLeave}>Submit</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
