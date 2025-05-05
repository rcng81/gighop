import React, { useState, useEffect } from 'react';
import UsrIcon from '../assets/usrIcon.png';
import MagGlassIcon from '../assets/MagGlassIcon.png';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { query, collection, doc as firestoreDoc, setDoc, getDocs, getDoc, orderBy, limit } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import '../css/communityPage.css';

const CommunityPage = () => {
  const [myCommunities, setMyCommunities] = useState([]);
  const [userName, setUserName] = useState("User");
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [communitiesExpanded, setCommunitiesExpanded] = useState(false);
  const [recommendedCommunities, setRecommendedCommunities] = useState([]);
  const [hasNotification, setHasNotification] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const dummyCards = [
    "Card 1", "Card 2", "Card 3",
    "Card 4", "Card 5", "Card 6",
    "Card 7", "Card 8", "Card 9"
  ];

  const cardsPerPage = 3;

  /* Functions: */
  const navigate = useNavigate();
  const goToEditProfile = () => navigate('/edit-profile');
  const goToCreateCommunity = () => navigate('/create-community');

  const handleNext = () => {
    if (visibleIndex + cardsPerPage < dummyCards.length) {
      setVisibleIndex(prev => prev + cardsPerPage);
    }
  };

  const handlePrev = () => {
    if (visibleIndex - cardsPerPage >= 0) {
      setVisibleIndex(prev => prev - cardsPerPage);
    }
  };

  const handleSearch = async (e) => {
    if (e.key === 'Enter') {
      const q = query(collection(db, 'communities'));
      const snapshot = await getDocs(q);
      const allCommunities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const filtered = allCommunities.filter(comm =>
        (comm.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      
      setSearchResults(filtered);
    }
  };

  const handleJoinCommunity = async (communityId) => {
    const user = auth.currentUser;
    if (!user) return;
  
    try {
      await setDoc(firestoreDoc(db, "users", user.uid, "user_communities", communityId), {
        joinedAt: new Date()
      });
      navigate(`/community/${communityId}`);
    } catch (err) {
      console.error("Error joining community:", err);
    }
  };

  const isCommunityJoined = (communityId) => {
    return myCommunities.some(comm => comm.id === communityId);
  };

  /* Hooks: */
  useEffect(() => {
    const fetchRecommended = async () => {
      const user = auth.currentUser;
      if (!user) return;
  
      const joinedSnapshot = await getDocs(collection(db, "users", user.uid, "user_communities"));
      const joinedCommunityIds = joinedSnapshot.docs.map(doc => doc.id);

      const q = query(
        collection(db, 'communities'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const allRecent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
      const filtered = allRecent.filter(comm => !joinedCommunityIds.includes(comm.id));
  
      setRecommendedCommunities(filtered.slice(0, 9));
    };
  
    fetchRecommended();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
  
      setUserName(user.displayName || "User");
  
      const userCommunitiesRef = collection(db, "users", user.uid, "user_communities");
      const joinedSnapshot = await getDocs(userCommunitiesRef);
      const joinedCommunityIds = joinedSnapshot.docs.map(doc => doc.id);

      // Check if user has any unread notifications
      const notificationsSnapshot = await getDocs(collection(db, "users", user.uid,         "notifications"));
      const unread = notificationsSnapshot.docs.some(doc => doc.data().read === false);
      setHasNotification(unread);         
  
      // Set user communities for sidebar
      const allCommunities = await Promise.all(
        joinedCommunityIds.map(async (id) => {
          const commDoc = await getDoc(firestoreDoc(db, "communities", id));
          return commDoc.exists() ? { id, ...commDoc.data() } : null;
        })
      );
      setMyCommunities(allCommunities.filter(Boolean));
  
      // 🔁 Now fetch recommended communities
      const q = query(
        collection(db, 'communities'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const allRecent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
      // Filter out communities the user already joined
      const filtered = allRecent.filter(comm => !joinedCommunityIds.includes(comm.id));
  
      setRecommendedCommunities(filtered.slice(0, 9));
    });
  
    return () => unsubscribe();
  }, []);
    
  
  return (
    <div>
      {/* Mobile Toggle Button */}
      {!sidebarVisible && (
        <button
        className="menu-toggle d-lg-none"
        onClick={() => setSidebarVisible(!sidebarVisible)}
      >
        ☰
      </button>
      )}

      <aside
        className={`sidebar shadow ${sidebarVisible ? 'show-sidebar' : ''}`}
      >
        <div className="d-flex flex-column h-100">
          <div className="d-flex d-lg-none justify-content-end mb-2">
            <button className="btn btn-outline-secondary" onClick={() => setSidebarVisible(false)}>✕</button>
          </div>

          {/* My Communities Section */}
          <div className="w-100 mb-2 px-2">
            {/* Header Row */}
            <div 
              className="d-flex justify-content-between align-items-center">
              <h5 
                className="mb-0 flex-grow-1 text-truncate"
                style={{ overflow: 'hidden' }}          
              >
                My Communities
              </h5>

              {/* Collapse or expand community List button */}
              <button
                className="btn btn-sm btn-outline-secondary ms-2" 
                onClick={() => setCommunitiesExpanded(!communitiesExpanded)}
              >
                {/* ▲ - expanded; ▼ - collapsed */}
                {communitiesExpanded ? "▲" : "▼"}
              </button>
            </div>

            {/* Scrollable list of communities */}
            <div
              style={{
                maxHeight: communitiesExpanded? "300px" : "0",
                overflowY: "auto",
                transition: "max-height 0.3s ease",
                width: "100%",
              }}
            >
              <ul className="list-unstyled text-center">
                {myCommunities.map(comm => (
                  <li key={comm.id} className="mb-2">
                    <Link
                      to={`/community/${comm.id}`}
                      className="community-link text-decoration-none text-dark"
                    >
                      {comm.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* User Icon */}
          <div 
            className="text-center mt-auto pt-4 border-top position-relative" 
            onClick={goToEditProfile} 
            style={{ cursor: 'pointer' }}
          >
            <img src={UsrIcon} alt="User Icon" className="img-fluid rounded-circle mb-2" width="60" />

            {/* Notification Dot */}
            {hasNotification && (
              <span 
                style={{
                  position: "absolute",
                  top: "10px",
                  right: "calc(50% - 15px)",
                  backgroundColor: "red",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  border: "2px solid white"
                }}
              ></span>
            )}

            <p className="mb-0">{userName}</p>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className={`main-content flex-grow-1 p-4 ${sidebarVisible ? 'mt-4' : ''}`} >
        <div className="mb-4">
          {/* Seach Bar */}
          <label htmlFor="search" className="form-label fw-bold">Search for Communities:</label>
          <div className="d-flex align-items-center mb-3">
            <img src={MagGlassIcon} alt="Search Icon" className="me-2" style={{ width: 30 }} />
            <input
              type="text"
              className="form-control"
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search..."
            />
          </div>

          {/* Create Community Button */}
          <button className="btn btn-primary mb-3" onClick={goToCreateCommunity}>Create Community</button>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="row g-3">
              {searchResults.map((comm) => (
                <div className="col-md-4" key={comm.id}>
                  <div className="card h-100">
                    <div className="card-body">
                      <h5 className="card-title">{comm.name}</h5>
                      <p className="card-text">{comm.description || "No description."}</p>
                      {isCommunityJoined(comm.id) ? (
                        <button className="btn btn-sm btn-success" disabled>Joined</button> ) : ( <button className="btn btn-sm btn-outline-primary" onClick={() => handleJoinCommunity(comm.id)} > Join </button> )}

                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Communities */}
        <h3 className="mb-3">Recommended Communities</h3>
        <div className="row g-4">
          {recommendedCommunities.slice(visibleIndex, visibleIndex + cardsPerPage).map((comm, idx) => (
          <div className="col-md-4" key={comm.id}>
            <div className="card h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <h5 className="card-title">{comm.name}</h5>
                  <span className="text-muted">#{visibleIndex + idx + 1}</span>
                </div>
                <p className="card-text">{comm.description || "No description."}</p>
                {isCommunityJoined(comm.id) ? (
                  <button className="btn btn-sm btn-success" disabled>Joined</button>
                ) : (
                  <button className="btn btn-sm btn-outline-success" onClick={() => handleJoinCommunity(comm.id)}>Join</button>
                )}
              </div>
            </div>
          </div>
          ))}
        </div>
        <div className="d-flex justify-content-center mt-4">
          <button className="scroll-arrow me-2" onClick={handlePrev}>←</button>
          <button className="scroll-arrow" onClick={handleNext}>→</button>
        </div>
      </main>
    </div>
  );
};

export default CommunityPage;

