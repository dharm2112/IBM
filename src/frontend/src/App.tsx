import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import {
  ExecutiveDashboard,
  SiteRanking,
  SiteDetails,
  DeviationCenter,
  PatientTimeline,
  CAPAManagement,
  ProtocolRuleViewer,
  AuditTrail
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ExecutiveDashboard />} />
          <Route path="sites" element={<SiteRanking />} />
          <Route path="sites/:siteId" element={<SiteDetails />} />
          <Route path="deviations" element={<DeviationCenter />} />
          <Route path="patients/:patientId" element={<PatientTimeline />} />
          <Route path="capa" element={<CAPAManagement />} />
          <Route path="protocol-rules" element={<ProtocolRuleViewer />} />
          <Route path="audit" element={<AuditTrail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
