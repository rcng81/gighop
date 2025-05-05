import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from "./components/login";
import Signup from './components/signup';
import CommunityDetail from './components/communityDetail';
import CreateJobs from './components/create-jobs';
import JobDetail from './components/jobDetail';
import CommunityPage from './components/communityPage';
import Pedit from './components/edit_profile';  
import CreateCommunities from './components/create-communities';
import ViewApplicants from './components/ViewApplicants';
import MessagesPage from './components/MessagesPage';
import WorkPage from './components/workpage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path ="/" element={<Login />} />
        <Route path ="/signup" element={<Signup />}/>
        <Route path="/community/:communityId" element={<CommunityDetail />} />
        <Route path="/community/:communityId/createJobs" element={<CreateJobs />} />
        <Route path="/community/:communityId/:jobId" element={<JobDetail />}/>
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/edit-profile" element={<Pedit />} />
        <Route path="/create-community" element={<CreateCommunities />}/>
        <Route path="/job/:communityId/:jobId/applicants" element={<ViewApplicants />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:chatId" element={<MessagesPage />} />
        <Route path="/community/:communityId/:jobId/start" element={<WorkPage />} />
      </Routes>
    </Router>
  )
}

export default App
