import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, deleteDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { availableTags } from '../constants';

const JobDetail = () => {
   const { communityId, jobId } = useParams();
   const [job, setJob] = useState(null);
   const [userSkills, setUserSkills] = useState([]);
   const [currentUserId, setCurrentUserId] = useState(null);
   const [editMode, setEditMode] = useState(false);
   const [editTitle, setEditTitle] = useState('');
   const [editDescription, setEditDescription] = useState('');
   const [editPrice, setEditPrice] = useState('');
   const [editTags, setEditTags] = useState([]);
   const [hasApplied, setHasApplied] = useState(false);
   const [showApplyPopup, setShowApplyPopup] = useState(false); 
   const [applicationStatus, setApplicationStatus] = useState(null);
  
   const navigate = useNavigate();

   useEffect(() => {
      const fetchJob = async () => {
      try {
         const jobRef = doc(db, 'communities', communityId, 'jobs', jobId);
         const jobSnap = await getDoc(jobRef);
         if (jobSnap.exists()) {
            const data = jobSnap.data();
            setJob(data);
            setEditTitle(data.title || '');
            setEditDescription(data.description || '');
            setEditPrice(data.price || '');
            setEditTags(data.tags || []);
         }
      } catch (error) {
        console.error('Error fetching job:', error);
      }
   };

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
         if (user) {
            setCurrentUserId(user.uid);
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
               const data = userDoc.data();
               setUserSkills(data.skills || []);
            }

            const appliedJobsRef = doc(db, 'users', user.uid, 'applied_jobs', jobId);
            const appliedJobSnap = await getDoc(appliedJobsRef);

            if (appliedJobSnap.exists()) {
               setHasApplied(true);
               const applicantDoc = await getDoc(doc(db, 'communities', communityId, 'jobs',jobId, 'applicants', user.uid));
               if (applicantDoc.exists()) {
                  const status = applicantDoc.data().status || 'pending';
                  setApplicationStatus(status);
               }
            }
         }
      });

      if (communityId && jobId) fetchJob();

      return () => unsubscribe();
   }, [communityId, jobId]);

   const allTagsMatched = job?.tags?.every(tag => userSkills.includes(tag));

   const handleUpdate = async () => {
      try {
         await updateDoc(doc(db, 'communities', communityId, 'jobs', jobId), {
            title: editTitle,
            description: editDescription,
            price: parseFloat(editPrice),
            tags: editTags
         });
         setJob(prev => ({
         ...prev,
         title: editTitle,
         description: editDescription,
         price: parseFloat(editPrice),
         tags: editTags
         }));
      setEditMode(false);
    } catch (err) {
      console.error('Error updating job:', err);
      alert('Failed to update job.');
    }
  };

   const handleDelete = async () => {
      if (window.confirm('Are you sure you want to delete this job?')) {
         try {
            await deleteDoc(doc(db, 'communities', communityId, 'jobs', jobId));
            navigate(`/community/${communityId}`);
         } catch (err) {
         console.error('Error deleting job:', err);
         alert('Failed to delete job.');
         }
      }
   };

   const handleApply = async () => {
      try {
         const userDoc = await getDoc(doc(db, 'users', currentUserId));
         const userData = userDoc.exists() ? userDoc.data() : {};
    
        // Write to user's personal applied_jobs
         await setDoc(doc(db, 'users', currentUserId, 'applied_jobs', jobId), {
            appliedAt: new Date(),
            communityId: communityId,
            title: job?.title || 'Untitled Job',
         });
       
    
        // Write to the job's applicants collection
        await setDoc(doc(db, 'communities', communityId, 'jobs', jobId, 'applicants', currentUserId), {
         appliedAt: new Date(),
         name: userData.fullName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || auth.currentUser?.displayName || 'Unnamed User',
         userId: currentUserId, // 🔥 Add this line
         bio: userData.bio || '',
         location: userData.location || '',
         skills: userData.skills || [],
         status: 'pending',
       });
       
    
        setHasApplied(true);
        setShowApplyPopup(true);
    
        setTimeout(() => {
          navigate('/community');
        }, 2000);
      } catch (err) {
        console.error('Error applying for job:', err);
        alert('Failed to apply.');
      }
    };
    

   const toggleTag = (tag) => {
      setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
   };

   const toggleAllTags = () => {
      setEditTags(editTags.length === availableTags.length ? [] : [... availableTags]);
   };

   if (!job) return <div className="container mt-5">Loading job details...</div>;

   return (
      <div className="container mt-5">
         <button className="btn btn-secondary mb-3" onClick={() => navigate(`/community/${communityId}`)}> ← Back to Community </button>
         <div className="card shadow-sm">
            <div className="card-body">
               <h2 className="card-title text-primary">{job.title}</h2>
               <h5>Description:</h5>
               <p>{job.description}</p>
               <h6 className="text-muted">Pay: ${job.price}/hr</h6>

               {job.tags && job.tags.length > 0 && (
                  <>
                  <h6 className="mt-4">Required Skills:</h6>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                     {job.tags.map(tag => (
                        <span
                        key={tag}
                        className={`badge px-3 py-2 border rounded-pill ${userSkills.includes(tag) ? 'bg-primary text-white' : 'bg-light text-secondary'}`}
                        >
                        {tag}
                        </span>
                     ))}
                  </div>
                  </>
               )}

               <div className="mt-4">
                  {currentUserId === job.employerId ? (
                     <div className="d-flex gap-2">
                        <button className="btn btn-warning" onClick={() => setEditMode(true)}>Edit</button>
                        <button
                           className="btn btn-outline-info"
                           onClick={() => {
                              navigate(`/job/${communityId}/${jobId}/applicants`);
                           }}
                        >
                           View Applicants
                        </button>
                     </div>
                  ) : hasApplied ? (
                     <>
                     <div className="d-flex flex-column align-items-start gap-2">
                        <div className="d-inline-flex align-items-center gap-2">
                           <button 
                              className="btn btn-sm btn-secondary" 
                              disabled
                           >
                              Applied
                           </button>

                           <span 
                              className={
                                 `badge rounded-pill px-3 py-1 ${
                                 applicationStatus === 'accepted' ? 'bg-success' :
                                 applicationStatus === 'rejected' ? 'bg-danger' :
                                 'bg-secondary'}`
                              }
                           >
                              {applicationStatus === 'accepted' ? '✅ Accepted' :
                              applicationStatus === 'rejected' ? '❌ Rejected' :
                              '⏳ Pending'}
                           </span>

                           {/* ✅ If accepted, show Begin Work button */}
                           {applicationStatus === 'accepted' && (
                              <button
                                 className="btn btn-success mt-2"
                                 onClick={() => navigate(`/community/${communityId}/${jobId}/start`)}
                              >
                              🚀 Begin Work
                              </button>
                           )}
                        </div>
                     </div>
                     </>
                  ) : (
                     <button className="btn btn-success" disabled={!allTagsMatched} onClick={handleApply}>
                        Apply
                     </button>
                  )}
               </div>
            </div>
         </div>

         {editMode && (
            <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
               <div className="modal-dialog">
                  <div className="modal-content">
                     <div className="modal-header">
                        <h5 className="modal-title">Edit Job</h5>
                        <button type="button" className="btn-close" onClick={() => setEditMode(false)}></button>
                     </div>
                     <div className="modal-body">
                        <label>Title</label>
                        <input className="form-control mb-2" value={editTitle} onChange=  {(e) => setEditTitle(e.target.value)} />
                        <label>Description</label>
                        <textarea className="form-control mb-2" value={editDescription}   onChange={(e) => setEditDescription(e.target.value)} />
                        <label>Pay ($/hr)</label>
                        <input type="number" className="form-control mb-2" value=   {editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                        <label>Skills</label>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                           <button type="button" className={`btn btn-outline-primary $ {editTags.length ===    availableTags.length ? 'active' : ''}   `} onClick={toggleAllTags}>All</button> {availableTags.map  (tag => (
                           <button key={tag} type="button" className={`btn    btn-outline-primary ${editTags.includes (tag) ? 'active' :  ''}`} onClick={() => toggleTag(tag)} >{tag}
                           </button>
                        ))}
                        </div>
                     </div>
                  <div className="modal-footer d-flex justify-content-between">
                     <button className="btn btn-danger" onClick={handleDelete}>Delete Job</button>
                     <div>
                        <button className="btn btn-secondary me-2" onClick={() => setEditMode(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleUpdate}>Save Changes</button>
                     </div>
                  </div>
                  </div>
               </div>
            </div>
         )}
         
         {showApplyPopup && (
               <div className="alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3 shadow" style={{ zIndex: 2000 }}> ✅ Successfully applied! Redirecting to homepage...
               </div>
         )}
      </div>
   );
};

export default JobDetail;