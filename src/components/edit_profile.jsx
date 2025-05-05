import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, deleteUser, signOut } from 'firebase/auth';
import { doc, getDoc, deleteDoc, setDoc, collection, getDocs, FieldPath } from 'firebase/firestore';
import '../css/edit_profile.css';
import { availableTags } from '../constants';

const Pedit = () => {
  const [formData, setFormData] = useState({
    name: "user's name",
    email: "user@example.com",
    location: "Current Location",
    bio: "This is the user's bio."
  });

  const navigate = useNavigate();
  const [selectedTags, setSelectedTags] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [notifications, setNotifications] = useState([]); 
  const [averageRating, setAverageRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [jobHistory, setJobHistory] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);

  

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserName(user.displayName || 'User');
        setUserEmail(user.email || 'user@example.com');

        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userProfileData = docSnap.data();
          setFormData({
            name: user.displayName || '',
            email: user.email || '',
            location: userProfileData.location || '',
            bio: userProfileData.bio || '',
            resume: null,
          });
          setSelectedTags(userProfileData.skills || []);
          fetchRatings(user.uid);
        }

        const appliedSnapshot = await getDocs(collection(db, 'users', user.uid, 'applied_jobs'));
        const jobs = [];

        for (const jobDoc of appliedSnapshot.docs) {
          const jobData = jobDoc.data();
          const jobRef = doc(db, 'communities', jobData.communityId, 'jobs', jobDoc.id);
          const jobSnap = await getDoc(jobRef);

          if (jobSnap.exists()) {
            const liveJobData = jobSnap.data();
            const isClosed = liveJobData.status === 'closed';
            const isUserAccepted = Array.isArray(liveJobData.acceptedApplicantIds) && liveJobData.acceptedApplicantIds.includes(user.uid);

            if (!isClosed && !isUserAccepted) {
              jobs.push({
                id: jobDoc.id,
                ...jobData,
                ...liveJobData
              });
            } else if (!isClosed && isUserAccepted) {
              jobs.push({
                id: jobDoc.id,
                ...jobData,
                ...liveJobData
              });
            } else if (isClosed && isUserAccepted) {
            }
            
          }
        }
      
        const completedJobs = [];
        const jobHistorySnapshot = await getDocs(collection(db, 'users', user.uid, 'job_history'));
        jobHistorySnapshot.forEach(doc => {
          const data = doc.data();
          completedJobs.push({
            id: doc.id,
            title: data.title || 'Untitled Job',
            price: data.price || 0,
            rating: data.rating ?? null,
            role: data.role || 'unknown',
            completed: true,
            createdAt: data.createdAt?.toDate() || null
          });
          
        });
        setAppliedJobs(jobs);
        setJobHistory(completedJobs);

        const notificationsSnapshot = await getDocs(collection(db, 'users', user.uid, 'notifications'));
        const notifs = notificationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setNotifications(notifs);
        if (notifs.some(n => !n.read)) {
          setActiveTab('applications');
        }        
      }
    });
    return () => unsubscribe();
  }, []);

  const handleChange = async (e) => {
    const { name, value, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  
    if (name === 'location' && value.length > 2) {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${value}`);
        const data = await response.json();
        setLocationSuggestions(data.slice(0, 5));
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
      }
    } else if (name === 'location') {
      setLocationSuggestions([]);
    }
  };
  

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleAllTags = () => {
    setSelectedTags(selectedTags.length === availableTags.length ? [] : [...availableTags]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        location: formData.location,
        bio: formData.bio,
        skills: selectedTags
      }, { merge: true });

      alert("Profile updated successfully!");
      navigate('/community');
    } catch (err) {
      console.error("Error saving profile:", err.message);
      alert("Failed to save profile.");
    }
  };

  const handleDeleteProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const confirmDelete = window.confirm("Are you sure you want to delete your account?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
      alert("Account successfully deleted.");
      navigate('/');
    } catch (err) {
      console.error("Error deleting profile:", err.message);
      alert("Failed to delete account. You may need to log in again to delete.");
    }
  };

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem("activeEmployeeId");
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const fetchRatings = async (userId) => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      setAverageRating(data.averageRating || 0);
      setRatingCount(data.ratingCount || 0);
    }
  };  

  return (
    <div className="container py-5" style={{ maxWidth: '800px' }}>
      <button className="btn btn-secondary mb-3" onClick={() => navigate('/community')}>
        ← Back to Home Page
      </button>

      <div className="card shadow p-4 position-relative">
        <form onSubmit={handleSubmit}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div className="d-flex gap-2">
              <button
                type="button"
                className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-outline-dark'}`}
                onClick={() => setActiveTab('profile')}> Edit Profile </button>
              <button type="button" className={`btn ${activeTab === 'skills' ? 'btn-primary' : 'btn-outline-dark'}`} onClick={() => setActiveTab('skills')}> Skills</button>
              <button type="button" className={`btn ${activeTab === 'applications' ? 'btn-primary' : 'btn-outline-dark'} position-relative`} onClick={() => setActiveTab  ('applications')}> Applications {notifications.length > 0 && notifications.some(n => !n.read) && (
                <span 
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                style={{ fontSize: '0.7rem' }}> {notifications.filter(n => !n.read).length}
                </span>
                )}
              </button>
              <button type="button" className={`btn ${activeTab === 'jobHistory' ? 'btn-primary' : 'btn-outline-dark'}`} onClick={() => setActiveTab('jobHistory')}> Job History </button>
            </div>
            <button className="btn btn-outline-danger" onClick={handleLogout}>Log Out</button>
          </div>

          {activeTab === 'profile' && (
            <>
              <h2 className="text-center mb-4 text-primary">Edit Profile</h2>
              <p><strong>Name:</strong> {userName}</p>
              <p><strong>Email:</strong> {userEmail}</p>
              {averageRating !== null && (
              <p><strong>Rating:</strong> ⭐ {averageRating.toFixed(2)} ({ratingCount})</p>
              )}
              <div className="mb-3">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-control"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder={formData.bio ? "" : "You have not entered your location"}
                />
                {locationSuggestions.length > 0 && (
                  <ul className="list-group mt-1">
                    {locationSuggestions.map((loc, index) => (
                      <li
                        key={index}
                        className="list-group-item list-group-item-action"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, location: loc.display_name }));
                          setLocationSuggestions([]);
                        }}
                      >
                        {loc.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mb-4">
                <label className="form-label">Bio</label>
                <input
                  type="text"
                  className="form-control"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder={formData.bio ? "" : "You have not entered your bio"}
                />
              </div>
              <div className="d-grid mb-3">
                <button type="submit" className="btn btn-success">Save Profile</button>
              </div>
              <div className="d-grid">
                <button type="button" className="btn btn-danger" onClick={handleDeleteProfile}>
                  Delete Profile
                </button>
              </div>
            </>
          )}

          {activeTab === 'skills' && (
            <>
              <h2 className="text-center mb-4 text-primary">Select Your Skills</h2>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className={`btn btn-outline-primary ${selectedTags.length === availableTags.length ? 'active' : ''}`}
                  onClick={toggleAllTags}
                >
                  All
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`btn btn-outline-primary ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTab === 'applications' && (
            <>
              <h2 className="text-center mb-4 text-primary">My Applications</h2>
              {appliedJobs.length === 0 ? (
                <p className="text-muted text-center">You haven't applied for any jobs yet.</p>
              ) : (
                <ul className="list-group">
                  {appliedJobs.map(job => {
                  const hasNotif = notifications.some(notif => notif.jobId === job.id && !notif.read);
                  const isAccepted = Array.isArray(job.acceptedApplicantIds) && job.acceptedApplicantIds.includes(auth.currentUser?.uid);
                return (
                  <li key={job.id} className={`list-group-item d-flex justify-content-between align-items-center ${hasNotif ? 'bg-warning-subtle' : ''}`}>
                    <span className={hasNotif ? 'fw-bold' : ''}>
                      {job.title || 'Untitled Job'}
                    </span>
                    <button 
                      type="button" 
                      className={`btn btn-sm ${isAccepted ? 'btn-success' : 'btn-outline-primary'}`} 
                      onClick={async () => {
                        const notifDoc = notifications.find(notif => notif.jobId === job.id && !notif.read);
                        if (notifDoc) {
                          const notifRef = doc(db, 'users', auth.currentUser.uid, 'notifications', notifDoc.id);
                          await setDoc(notifRef, { read: true }, { merge: true });
                          setNotifications(prev => prev.map(n => n.id === notifDoc.id ? { ...n, read: true } : n));
                        }
                        const path = isAccepted
                          ? `/community/${job.communityId}/${job.id}/start`
                          : `/community/${job.communityId}/${job.id}`;
                        navigate(path);
                      }}
                    >
                      {isAccepted ? 'Begin Work' : 'View'}
                    </button>

                    
                  </li>
                );
              })}
                </ul>
              )}
            </>
          )}

          {activeTab === 'jobHistory' && (
            <>
              <h2 className="text-center mb-4 text-primary">Job History</h2>
              {jobHistory.length === 0 ? (
                <p className="text-muted text-center">No completed jobs yet.</p>
              ) : (
                <ul className="list-group">
                  {jobHistory.map(job => (
                    <li key={job.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{job.title}</strong><br />
                        <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                          Pay: ${job.price}/hr
                        </span><br />
                        <span className="badge bg-success me-2">Completed</span>
                        <span className={`badge ${job.role === 'employer' ? 'bg-primary' : 'bg-info'}`}>
                          {job.role === 'employer' ? 'Posted' : 'Worked'}
                        </span>
                      </div>
                      <div>
                        {job.rating != null ? (
                          <span>⭐ {job.rating}</span>
                        ) : (
                          <span className="text-muted">No rating</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default Pedit;
