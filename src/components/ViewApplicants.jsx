import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';

const ViewApplicants = () => {
  const { communityId, jobId } = useParams();
  const navigate = useNavigate();

  const [applicants, setApplicants] = useState([]);
  const [jobTitle, setJobTitle] = useState('');
  const [jobStatus, setJobStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        if (!communityId || !jobId) {
          console.error('Missing communityId or jobId');
          setLoading(false);
          return;
        }

        const jobRef = doc(db, 'communities', communityId, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);
        const currentUser = auth.currentUser;

        if (jobSnap.exists()) {
          const jobData = jobSnap.data();
          setJobTitle(jobData.title || 'Job');
          setJobStatus(jobData.status || 'open');
          if (currentUser) {
            setIsOwner(currentUser.uid === jobData.employerId);
          }
        }

        const applicantsSnapshot = await getDocs(
          collection(db, 'communities', communityId, 'jobs', jobId, 'applicants')
        );

        const applicantsData = await Promise.all(
          applicantsSnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            let updatedName = data.name;
            let averageRating = 0;
            let ratingCount = 0;
        
            if (data.userId) {
              const userDoc = await getDoc(doc(db, 'users', data.userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                updatedName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                averageRating = userData.averageRating ?? 0;
                ratingCount = userData.ratingCount ?? 0;
              }
            }
        
            return {
              id: docSnap.id,
              ...data,
              name: updatedName,
              averageRating,
              ratingCount,
            };
          })
        );
        console.log("Applicants fetched with ratings:", applicantsData);
        setApplicants(applicantsData);
        
      } catch (err) {
        console.error('Error fetching applicants:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicants();
  }, [communityId, jobId]);

  const updateStatus = async (applicantId, newStatus) => {
    try {
      await updateDoc(
        doc(db, 'communities', communityId, 'jobs', jobId, 'applicants', applicantId),
        { status: newStatus }
      );

      // Accepting an applicant:
      if (newStatus === 'accepted') {
        // Get job Data, particularly the array  of accepted applicants:
        const jobRef = doc(db, 'communities', communityId, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);
        const jobData = jobSnap.data();
        const currentIds = jobData.acceptedApplicantIds || [];

        if (!currentIds.includes(applicantId)) {
          await updateDoc(jobRef, {
            acceptedApplicantIds: [...currentIds, applicantId]
          });
        }
      }

      // Rejecting an applicant:
      if (newStatus === 'rejected') {
        const jobRef = doc(db, 'communities', communityId, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);
        const jobData = jobSnap.data();
        const currentIds = jobData.acceptedApplicantIds || [];
      
        if (currentIds.includes(applicantId)) {
          const updatedIds = currentIds.filter(id => id !== applicantId);
          await updateDoc(jobRef, {
            acceptedApplicantIds: updatedIds
          });
        }
      }
  
      const notifCollection = collection(db, "users", applicantId, "notifications");
      const q = query(notifCollection, where("jobId", "==", jobId));
      const notifSnap = await getDocs(q);
  
      if (!notifSnap.empty) {
        const notifDoc = notifSnap.docs[0];
        await updateDoc(doc(db, "users", applicantId, "notifications", notifDoc.id), {
          type: "application_status",
          message: `Your application to ${jobTitle} was ${newStatus}.`,
          read: false,
          timestamp: serverTimestamp()
        });
      } else {
        const notifRef = doc(notifCollection);
        await setDoc(notifRef, {
          jobId: jobId,
          type: "application_status",
          message: `Your application to ${jobTitle} was ${newStatus}.`,
          read: false,
          timestamp: serverTimestamp()
        });
      }

      setApplicants(prev =>
        prev.map(app => app.id === applicantId ? { ...app, status: newStatus } : app)
      );
    } catch (err) {
      console.error(`Error updating status for ${applicantId}:`, err);
    }
  };

  const handleCloseJob = async () => {
    try {
      await updateDoc(doc(db, 'communities', communityId, 'jobs', jobId), {
        status: 'closed'
      });

      const applicantsSnapshot = await getDocs(
        collection(db, 'communities', communityId, 'jobs', jobId, 'applicants')
      );

      const batchUpdates = applicantsSnapshot.docs.map(docSnap => 
        updateDoc(doc(db, 'communities', communityId, 'jobs', jobId, 'applicants', docSnap.id), {
          status: 'closed'
        })
      );

      await Promise.all(batchUpdates);

      setJobStatus('closed');
      alert('Job closed and all applicants marked as closed.');
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Error closing job:', err);
      alert('Failed to close job.');
    }
  };

  const handleOpenJob = async () => {
    try {
      await updateDoc(doc(db, 'communities', communityId, 'jobs', jobId), {
        status: 'open'
      });
  
      const applicantsSnapshot = await getDocs(
        collection(db, 'communities', communityId, 'jobs', jobId, 'applicants')
      );
  
      const batchUpdates = applicantsSnapshot.docs.map(docSnap => {
        const applicantData = docSnap.data();
        if (applicantData.status === 'closed') {
          return updateDoc(doc(db, 'communities', communityId, 'jobs', jobId, 'applicants', docSnap.id), {
            status: 'pending'
          });
        }
        return Promise.resolve();
      });
  
      await Promise.all(batchUpdates);
  
      setApplicants(prev =>
        prev.map(app => app.status === 'closed' ? { ...app, status: 'pending' } : app)
      );
  
      setJobStatus('open');
      alert('Job reopened and applicants set to pending.');
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Error reopening job:', err);
      alert('Failed to reopen job.');
    }
  };

  return (
    <div className="container mt-5">
      {/* Back Button */}
      <button 
        className="btn btn-secondary mb-4" 
        onClick={() => navigate(`/community/${communityId}/${jobId}`)}
      >
        ← Back to Job Detail
      </button>

      {/* Tutor Applicants Section */}
      <div className="card shadow-sm mb-4">
        <div className="card-body d-flex justify-content-between align-items-center">
          <h4 className="card-title mb-0 text-primary">Applicants Page</h4>
          <button 
            className="btn btn-light border rounded-circle" 
            onClick={() => setShowSettingsModal(true)}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Main Applicants Card */}
      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-primary mb-4">{jobTitle} Applicants</h2>

          {loading ? (
            <p>Loading applicants...</p>
          ) : applicants.length === 0 ? (
            <p>No applicants yet.</p>
          ) : (
            <div className="row row-cols-1 row-cols-md-2 g-4">
              {applicants.map(applicant => (
                <div key={applicant.id} className="col">
                  <div className="card h-100 p-3 shadow-sm" style={{ fontSize: '0.95rem' }}>
                    <div className="card-body d-flex flex-column justify-content-between">
                      <h5 className="card-title mb-3">{applicant.name || 'Unnamed User'}</h5>
                      <p className="text-muted mb-2" style={{ fontSize: '0.85rem' }}>
                        ⭐ {applicant.averageRating?.toFixed(2) ?? "0.00"} ({applicant.ratingCount ?? 0})
                      </p>
                      
                      <div className="mb-2">
                        <strong>Skills:</strong>
                        <span className="ms-2" style={{ fontSize: '0.85rem' }}>
                          {(applicant.skills || []).join(', ') || 'N/A'}
                        </span>
                      </div>

                      <div className="mb-3">
                        <strong>Status:</strong>{' '}
                        <span className={`badge rounded-pill px-3 py-1 ${
                          applicant.status === 'accepted' ? 'bg-success' :
                          applicant.status === 'rejected' ? 'bg-danger' :
                          applicant.status === 'closed' ? 'bg-dark' :
                          'bg-secondary'
                        }`}>
                          {applicant.status === 'accepted' ? '✅ Accepted' :
                           applicant.status === 'rejected' ? '❌ Rejected' :
                           applicant.status === 'closed' ? '🚫 Closed' :
                           '⏳ Pending'}
                        </span>
                      </div>

                      {isOwner && (
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-outline-success"
                            disabled={applicant.status === 'accepted' || applicant.status === 'closed'}
                            onClick={() => updateStatus(applicant.id, 'accepted')}
                          >
                            Accept
                          </button>

                          <button
                            className="btn btn-sm btn-outline-danger"
                            disabled={applicant.status === 'rejected' || applicant.status === 'closed'}
                            onClick={() => updateStatus(applicant.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {isOwner && applicant.status === 'accepted' && (
                        <button
                          className="btn btn-sm btn-success mt-2"
                          onClick={() => {
                            sessionStorage.setItem("activeEmployeeId", applicant.id);
                            navigate(`/community/${communityId}/${jobId}/start`);
                          }}
                        >
                          🚀 Begin Work
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Job Settings</h5>
                <button type="button" className="btn-close" onClick={() => setShowSettingsModal(false)}></button>
              </div>
              <div className="modal-body">
                <p>Current job status: <strong>{jobStatus.toUpperCase()}</strong></p>
                <div className="d-flex flex-column gap-3 mt-3">
                  <button 
                    className="btn btn-danger" 
                    onClick={handleCloseJob}
                    disabled={jobStatus === 'closed'}
                  >
                    Close Job
                  </button>
                  <button 
                    className="btn btn-success" 
                    onClick={handleOpenJob}
                    disabled={jobStatus === 'open'}
                  >
                    Reopen Job
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ViewApplicants;
