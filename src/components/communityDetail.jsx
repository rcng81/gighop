import React, { useEffect, useState } from 'react';
import { useParams, useNavigate} from 'react-router-dom';
import { doc, getDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db , auth } from '../firebase';

const CommunityDetail = () => {
  const { communityId } = useParams();
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('jobs');
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [myJobs, setMyJobs] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [filterApplied, setFilterApplied] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [ignoreKeyword, setIgnoreKeyword] = useState(false);
  const [minWage, setMinWage] = useState('');
  const [ignoreWage, setIgnoreWage] = useState(false);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [keywordError, setKeywordError] = useState('');
  const [wageError, setWageError] = useState('');

  const navigate = useNavigate();
  const goToCreateJobs = () => navigate(`/community/${communityId}/createJobs`);
  const goToHomePage = () => navigate(`/community`);

  const handleLeaveCommunity = async () => {
    const user = auth.currentUser;
    if (!user) return;
  
    try {
      await deleteDoc(doc(db, "users", user.uid, "user_communities", communityId));
      navigate("/community");
    } catch (error) {
      console.error("Error leaving community:", error);
      alert("Something went wrong while leaving the community.");
    }
  }; 
  
  const handleDeleteCommunity = async () => {
    const user = auth.currentUser;
    if (!user || user.uid !== community.ownerId) {
      alert("Only the creator can delete this community.");
      return;
    }

    try {
      await deleteDoc(doc(db, "communities", communityId));
      const usersSnapshot = await getDocs(collection(db, "users"));
      usersSnapshot.forEach(async (userDoc) => {
        await deleteDoc(doc(db, "users", userDoc.id, "user_communities", communityId));
      });

      navigate("/community");
      alert("Community deleted successfully.");
    } catch (error) {
      console.error("Error deleting community:", error);
      alert("Something went wrong while deleting the community.");
    }
  };

  const handleFilterjobs = (e) => {
    e.preventDefault(); // stops the page from reloading

    // did the user enter valid fields for searching? If not, don't search and notify user
    let valid = true;
    setKeywordError('');
    setWageError('');

    // keywords are separated by spaces in keyword input
    const keywordList = searchKeyword.split(" ").filter(k => k.length > 0); // keyword list is an array of keywords
    const wageValue = parseFloat(minWage); // parseFloat converts a string to a float

    // check search inputs are valid. If not, don't search, notify, and return.
    if (!ignoreKeyword && keywordList.length === 0) { // if 'Any' keyword is not checked and no keywords are entered,...
      setKeywordError("Please enter at least one keyword or check 'Any'");
      valid = false;
    }

    if (!ignoreWage && minWage === '') { // if 'Any' wage is not checked and no wage is entered,...
      setWageError("Please enter a wage of at least $0.01/hr or check 'Any'");
      valid = false;
    }

    if (!valid) return;

    // A valid search is made at this point
    setFilterApplied(true);

    /* Filter & Search: */
    // filter() creates a new array containing only the elements that match a condition
    // "jobs.filter((job) => {...});" : for each job in jobs
    const filtered = jobs.filter((job) => {
      // keywordMatch is true if ignoreKeyword is true (Any is checked). Else, it is true if the current job contains one of the kewords entered in the search in its title or description
      const keywordMatch =  ignoreKeyword
        ? true
        : keywordList.some( kw => /* some() returns true if at least one item in the array passes the following test */
            job.title.toLowerCase().includes(kw.toLowerCase()) ||
            job.description.toLowerCase().includes(kw.toLowerCase())
          );
      
      // wageMatch is true if ignoreWage is true (Any is checked). Else, it is true if the current job has a wage that is at least the minWage specified in search
      const wageMatch = ignoreWage
      ? true
        : parseFloat(job.price) >= wageValue;

      // Condition to be matched:
      return keywordMatch && wageMatch; // add current job to filtered array if condition is met
    });

    setFilteredJobs(filtered); // set filtered as the current filteredJobs
  };

  /* Hooks: */
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const membersList = [];
  
        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;
          const communityRef = doc(db, "users", userId, "user_communities", communityId);
          const communitySnap = await getDoc(communityRef);
  
          if (communitySnap.exists()) {
            const data = userDoc.data();
            membersList.push({
              id: userId,
              name: `${data.firstName || "First"} ${data.lastName || "Last"}`,
            });
          }
        }
  
        setMembers(membersList);
      } catch (err) {
        console.error("Error fetching members:", err);
      }
    };

    const fetchCommunity = async () => {
      try {
        const docRef = doc(db, 'communities', communityId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setCommunity({
            id: docSnap.id,
            ...docSnap.data(),
          });
        } else {
          console.log('Community not found');
        }
      } catch (error) {
        console.error('Error fetching community:', error);
      }
    };

    const fetchJobs = async () => {
      try {
        const jobsRef = collection(db, 'communities', communityId, 'jobs');
        const jobsSnapshot = await getDocs(jobsRef);
    
        const employerCache = {};
        const allJobs = [];
        const createdJobs = [];
    
        for (const docSnap of jobsSnapshot.docs) {
          const jobData = docSnap.data();
          let employerName = "Unknown";
    
          if (jobData.employerId) {
            if (!employerCache[jobData.employerId]) {
              try {
                const userDoc = await getDoc(doc(db, 'users', jobData.employerId));
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  employerCache[jobData.employerId] =
                    userData.firstName && userData.lastName ? 
                    `${userData.firstName} ${userData.lastName}`
                    : "Unknown";
                } else {
                  employerCache[jobData.employerId] = "Unknown";
                }
              } catch (err) {
                employerCache[jobData.employerId] = "Unknown";
              }
            }
            employerName = employerCache[jobData.employerId];
          }
    
          const jobWithEmployer = {
            id: docSnap.id,
            ...jobData,
            employerName,
          };
    
          if (jobData.status !== 'closed') {
            allJobs.push(jobWithEmployer); // Only open jobs
          }
    
          if (jobData.employerId === auth.currentUser?.uid) {
            createdJobs.push(jobWithEmployer); // Jobs created by current user (even closed)
          }
        }
    
        setJobs(allJobs);
        setMyJobs(createdJobs);
      } catch (error) {
        console.error('Error fetching jobs:', error);
      }
    };
    

    fetchCommunity();
    fetchJobs();
    fetchMembers();
  }, [communityId]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setCurrentUserId(user.uid);
      } else {
        setCurrentUserId(null);
      }
    });
  
    return () => unsubscribe();
  }, []);
  

  if (!community) {
    return <div className="container mt-5">Loading community...</div>;
  }

  return (
    <div className="d-flex flex-column min-vh-100" style={{ background: 'linear-gradient(135deg, #E0F2FE, #93C5FD)' }}>
      <div className="px-4 pt-4 pb-5" style={{ width: '100%' }}>
        {/* Navigate back to Community's main page */}
        <div className="mb-4">
          <button className="btn btn-secondary" onClick={goToHomePage}>
            ← Return to Home Page
          </button>
        </div>

        {/* Community Details*/}
        <div className="card mb-4 shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="card-title text-primary mb-0">{community.name}</h2>
              <div className="d-flex gap-2">
                {/* Creator of Current community gets to edit the name and description of community */}
                {community.ownerId === auth.currentUser?.uid && (
                  <>
                    <button
                      className="btn btn-outline-secondary"
                      title="Edit Community Settings"
                      onClick={() => {
                        setEditName(community.name);
                        setEditDescription(community.description || '');
                        setShowSettings(true);
                      }}
                    >
                      ⚙️
                    </button>
                  </>
                )}
                <button className="btn btn-outline-danger" onClick={handleLeaveCommunity}>Leave</button>
              </div>
            </div>

            {/* Settings shown if current user is owner of community */}
            {showSettings && (
              <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="modal-dialog">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Edit Community</h5>
                      <button type="button" className="btn-close" onClick={() => setShowSettings(false)}></button>
                    </div>

                    <div className="modal-body">
                      <label className="form-label">Community Name</label>
                      <input
                        type="text"
                        className="form-control mb-3"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                      <div className="modal-footer d-flex flex-column align-items-stretch">
                        <div className="d-flex justify-content-between w-100 mb-2">
                          <button className="btn btn-secondary" onClick={() => setShowSettings(false)} >Cancel</button>
                          <button
                            className="btn btn-primary"
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'communities', communityId), {
                                  name: editName,
                                  description: editDescription,
                                });
                                setCommunity(prev => ({ ...prev, name: editName, description:editDescription }));
                                setShowSettings(false);
                              } catch (error) {
                                console.error("Error updating community:", error);
                                alert("Failed to update community");
                              }
                            }}
                          >
                            Save Changes
                          </button>
                        </div>

                        <button
                          className="btn btn-outline-danger w-100"
                          onClick={handleDeleteCommunity}
                        >
                          🛑 Disband Community
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Community Description (Jobs or Members?): */}
            <h5>Description:</h5>
            <p>{community.description || "No description provided."}</p>
            <div className="d-flex flex-wrap gap-3 mb-3">
              {/* Swtich to Jobs Tab Button */}
              <button className={`btn ${activeTab === 'jobs' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTab('jobs')}>
                Jobs
              </button>

              {/* Switch to Members Tab Button */}
              <button className={`btn ${activeTab === 'members' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveTab('members')}>
                Members
              </button>

              {/* Create Jobs button (shows if in jobs tab) */}
              {activeTab === 'jobs' && (
                <button className="btn btn-primary ms-auto" onClick={goToCreateJobs}>
                  + Create Job
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Job Search */}
        {activeTab === 'jobs' && (
          <div className="card mb-4 shadow-sm">
            <div className="card-body">
              <h4>Search for Jobs</h4>

              <form onSubmit={handleFilterjobs}>
                {/* Job search keyword */}
                <div className="d-flex align-items-center gap-2">
                  {/* Keyword input box */}
                  <label className="form-label">Keyword</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Enter keywords that match in job title or description"
                    value={searchKeyword} 
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    disabled={ignoreKeyword} 
                  />

                  {/* Check any keyword */}
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={ignoreKeyword}
                      onChange={() => setIgnoreKeyword(!ignoreKeyword)}
                    />
                    Any
                  </label>
                </div>
                {keywordError && <div className="invalid-feedback d-block">{keywordError}</div>}

                {/* Job search min Wage */}
                <div className="d-flex align-items-center gap-2 mt-2">
                  {/* Min Wage input box */}
                  <label className="form-label">Minimum Price ($/hr)</label>
                  <input 
                    type="number" 
                    min="0.01" 
                    step="0.01"
                    className="form-control"  
                    placeholder="e.g. 12" 
                    value={minWage} 
                    onChange={(e) => setMinWage(e.target.value)} 
                    disabled={ignoreWage}
                  />

                  {/* Check any wage */}
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={ignoreWage}
                      onChange={() => setIgnoreWage(!ignoreWage)}
                    />
                    Any
                  </label>
                </div>
                {wageError && <div className="invalid-feedback d-block">{wageError}</div>}

                {/* Click button to search jobs */}
                <button className="btn btn-secondary" type="submit">Search Jobs</button>
              </form>
            </div>
          </div>
        )}

        {/* List of Jobs */}
        {activeTab === 'jobs' && (
          <>
          {/* Available Jobs */}
          <h4>Available Jobs</h4>
          <div className="row g-4">
            {/* Display jobs that match search critieria: */}
            {(filterApplied ? filteredJobs : jobs).map((job, idx) => (
              <div key={idx} className="col-md-4">
                <div className="card h-100 shadow-sm">
                  <div className="card-body">
                    <h5 className="card-title mb-0">{job.title}</h5>
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">By: {job.employerName}</small>
                      <span className="badge bg-success">${job.price}/hr</span>
                    </div>
                    <p className="mt-2">{job.description}</p>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/community/${communityId}/${job.id}`)}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Display no jobs match search criteria */}
            {filterApplied && filteredJobs.length === 0 && (
              <div className="text-muted mt-3">No jobs match your search criteria.</div>
            )}
          </div> {/* ✅ Available Jobs div closes here */}


          {/* Your Created Jobs */}
          {currentUserId && myJobs.length > 0 && (
            <>
              <h4 className="mt-5">Jobs Owned</h4>
              <div className="row g-4">
                {myJobs.map((job, idx) => (
                  <div key={idx} className="col-md-4">
                    <div className="card h-100 shadow-sm">
                      <div className="card-body">
                        <h5 className="card-title">{job.title}</h5>
                        <div className="d-flex justify-content-between align-items-center">
                        <small className="text-muted"> Status: {(job.status || "Open").charAt(0).toUpperCase() + (job.status || "Open").slice(1)} </small>
                          <span className="badge bg-primary">${job.price}/hr</span>
                        </div>
                        <p className="mt-2">{job.description}</p>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/community/${communityId}/${job.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          </>
        )}

        {/* List of community members */}
        {activeTab === 'members' && (
          <>
          <h4>Members</h4>
          <ul className="list-group">
            {members.map(member => (
              <li key={member.id} className="list-group-item d-flex justify-content-between align-items-center">
                {member.name}
                {member.id === community.ownerId && <span title="Community Owner">👑</span>}
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </div>
  );
};

export default CommunityDetail;