import { useEffect } from 'react';
import { Box, Heading, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { useApp } from './hailer/use-app';
import MyPTOTab from './components/MyPTOTab';
import MyDocumentsTab from './components/MyDocumentsTab';
import CompanyDocumentsTab from './components/CompanyDocumentsTab';

export default function App() {
  const { api, inside, user } = useApp();

  useEffect(() => {
    void api.init();
  }, [api]);

  if (!inside) {
    return (
      <Box p={8}>
        <Text color="subtleText">Open this app inside Hailer to see your employment info.</Text>
      </Box>
    );
  }

  return (
    <Box p={8} maxW="900px" mx="auto">
      <Box mb={6}>
        <Heading size="lg">My Employment Info</Heading>
        <Text color="subtleText" fontSize="sm">
          {user.current ? `${user.current.firstname} ${user.current.lastname}` : ''}
        </Text>
      </Box>

      <Tabs variant="line" isLazy>
        <TabList>
          <Tab>🌴 My PTO</Tab>
          <Tab>📁 My Documents</Tab>
          <Tab>📄 Company Documents</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}><MyPTOTab /></TabPanel>
          <TabPanel px={0}><MyDocumentsTab /></TabPanel>
          <TabPanel px={0}><CompanyDocumentsTab /></TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}
