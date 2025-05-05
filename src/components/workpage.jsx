import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, setDoc } from 'firebase/firestore';
import { startConversation } from '../utils/startConversation';
import { updateUserRating } from '../utils/updateUserRating';

const WorkPage = () => {
  const { communityId, jobId } = useParams();

  const [job, setJob] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [chatTargetId, setChatTargetId] = useState(null);
  const [otherUserName, setOtherUserName] = useState("User");
  const [isPoster, setIsPoster] = useState(false);
  const [isWorker, setIsWorker] = useState(false);

  const navigate = useNavigate();

  const handleStartChat = async ({ currentUserId, otherUserId, jobTitle }) => {
    if (!otherUserId) {
      alert("Unable to determine who to chat with.");
      return;
    }

    try {
      // Get current User:
      const currentUserRef = doc(db, "users", currentUserId);
      const currentUserSnap = await getDoc(currentUserRef);
      const currentUserData = currentUserSnap.data();

      // Get other User:
      const otherUserRef = doc(db, "users", otherUserId);
      const otherUserSnap = await getDoc(otherUserRef);
      const otherUserData = otherUserSnap.data();

      // Start conversation:
      const chatId = await startConversation(
        currentUserId,
        otherUserId,
        jobTitle,
        currentUserData?.firstName || "User",
        currentUserData?.lastName || "",
        otherUserData?.firstName || "User",
        otherUserData?.lastName || ""
      );

      // redirect to messages page:
      navigate(`/messages/${chatId}`);
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const jobRef = doc(db, 'communities', communityId, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);
        let jobData = null;

        if (jobSnap.exists()) {
          jobData = jobSnap.data();
          setJob(jobData);
          
          // Read from sessionStorage after job is fetched to get employeeId
          const tempEmpId = sessionStorage.getItem("activeEmployeeId");
          if (tempEmpId && !chatTargetId) {
            setChatTargetId(tempEmpId);
          }

          const user = auth.currentUser;
          if (user) {
            const uid = user.uid;
            setCurrentUserId(uid);
          
            const jobRef = doc(db, 'communities', communityId, 'jobs', jobId);
            const jobSnap = await getDoc(jobRef);
          
            if (jobSnap.exists()) {
              const jobData = jobSnap.data();
              setJob(jobData);
          
              setIsPoster(jobData.employerId === uid);
              setIsWorker(
                Array.isArray(jobData.acceptedApplicantIds) &&
                jobData.acceptedApplicantIds.includes(uid)
              );
          
              // rating logic
              setRating(jobData.ratings?.[uid] || 0);
              setRatingSubmitted(!!jobData.ratings?.[uid]);
          
              // fetch the other user's name
              const targetUserId = jobData.employerId === uid ? tempEmpId : jobData.employerId;
              if (targetUserId) {
                const userDocRef = doc(db, 'users', targetUserId);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                  const data = userSnap.data();
                  setOtherUserName(`${data.firstName} ${data.lastName}`);
                }
              }
            } else {
              console.error('Job does not exist.');
            }
          }                   
        }
    
        // 🛑 Check if job is completed
        if (jobData.status === 'closed') {
          alert('✅ This job is complete. Redirecting you back to the community.');
          navigate(`/community/${communityId}`);
          return;
        }
  
        const posterRated = jobData.ratings?.[jobData.employerId];
        const anyWorkersRated = jobData.acceptedApplicantIds?.some(id => jobData.ratings?.[id]);
        const posterConfirmed = jobData.paymentConfirmation?.posterConfirmed;
        const workerConfirmed = jobData.paymentConfirmation?.workerConfirmed;
  
        if (posterRated && anyWorkersRated && posterConfirmed && workerConfirmed) {
          if (jobData.status !== 'closed') {
            await updateDoc(doc(db, 'communities', communityId, 'jobs', jobId), {
              status: 'closed'
            });
          }
          alert('🎉 Work completed and both rated. Redirecting to community.');
          navigate(`/community/${communityId}`);
          return;
        }
      } catch (error) {
        console.error('Error fetching job:', error);
      }
    };

    fetchJob();
  }, [communityId, jobId]);

  const handleConfirmPayment = async () => {
    if (!job) return;
  
    const paymentUpdate = isPoster
      ? { 'paymentConfirmation.posterConfirmed': true }
      : { 'paymentConfirmation.workerConfirmed': true };
  
    try {
      await updateDoc(doc(db, 'communities', communityId, 'jobs', jobId), paymentUpdate);
      setJob(prev => ({
        ...prev,
        paymentConfirmation: {
          ...prev.paymentConfirmation,
          ...(isPoster ? { posterConfirmed: true } : { workerConfirmed: true })
        }
      }));
      alert('✅ Payment confirmed! Thank you!');
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Failed to confirm payment.');
    }
  };

  const handleSubmitRating = async () => {
    if (!job || rating === 0) {
      alert('Please select a rating before submitting.');
      return;
    }
  
    try {
      const jobRef = doc(db, 'communities', communityId, 'jobs', jobId);
  
      await updateDoc(jobRef, {
        [`ratings.${currentUserId}`]: rating
      });
  
      setRatingSubmitted(true);
      alert('✅ Rating submitted! Thank you!');
  
      const updatedJobSnap = await getDoc(jobRef);
      const updatedJob = updatedJobSnap.data();

      if (!updatedJob.ratings) updatedJob.ratings = {};
      updatedJob.ratings[currentUserId] = rating;

      const posterRated = updatedJob.ratings?.[updatedJob.employerId];
      const anyWorkersRated = Array.isArray(updatedJob.acceptedApplicantIds)
        ? updatedJob.acceptedApplicantIds.some(id => updatedJob.ratings?.[id])
        : false;

  
      if (posterRated && anyWorkersRated) {
        await updateDoc(jobRef, { status: 'closed' });
      
        const targetId = isPoster ? chatTargetId : updatedJob.employerId;
        const targetRole = isPoster ? 'employee' : 'employer';
        
        const employeeId = updatedJob.acceptedApplicantIds?.[0] || null;
        await setDoc(doc(db, 'users', updatedJob.employerId, 'job_history', jobId), {
          title: updatedJob.title,
          price: updatedJob.price,
          rating: employeeId ? updatedJob.ratings?.[employeeId] || null : null,
          completed: true,
          timestamp: new Date(),
          role: 'employer'
        });

        // Store job history for employee(s) (they receive rating from employer)
        if (Array.isArray(updatedJob.acceptedApplicantIds)) {
          for (const userId of updatedJob.acceptedApplicantIds) {
            await setDoc(doc(db, 'users', userId, 'job_history', jobId), {
              title: updatedJob.title,
              price: updatedJob.price,
              rating: updatedJob.ratings?.[updatedJob.employerId] || null,
              completed: true,
              timestamp: new Date(),
              role: 'employee'
            });
          }
        }
        // 🆕 Always update user profile rating after submitting rating
      await updateUserRating(updatedJob.employerId);

      if (Array.isArray(updatedJob.acceptedApplicantIds)) {
        for (const userId of updatedJob.acceptedApplicantIds) {
          await updateUserRating(userId);
        }
      }
      
        alert('🎉 Both users have rated. Job is now closed!');
        navigate(`/community/${communityId}`);
      }
      
  
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating.');
    }
  };

  
  if (!job) {
    return <div className="container mt-5">Loading work page...</div>;
  }

  return (
    <div className="container mt-5">
      <button className="btn btn-secondary mb-3" onClick={() => navigate(`/community/${communityId}`)}>
        ← Back to Community
      </button>

      <div className="card shadow-sm p-4">
        <h2 className="text-primary">{job.title}</h2>
        <p>{job.description}</p>
        <h5 className="text-muted">Pay: ${job.price}/hr</h5>

        <hr />

        {/* Messaging Section */}
        <div className="mt-4">
          {isPoster ? (
            <>
            <h5>Message {otherUserName}:</h5>

            {/* Chat With an employee Button */}
            <div className="mt-2">
              <button 
                className="btn btn-outline-primary"
                onClick={() => 
                  handleStartChat({
                    currentUserId,
                    otherUserId: chatTargetId,
                    jobTitle: job.title,
                  })
                }
              >
                Chat with Employee
              </button>
            </div>
            </>
          ) : isWorker ? (
            <>
            <h5>Message {otherUserName}:</h5>

            {/* Chat With Employer Button */}
            <div className="mt-2">
              <button 
                className="btn btn-outline-primary"
                onClick={() =>
                  handleStartChat({
                    currentUserId,
                    otherUserId: job.employerId,
                    jobTitle: job.title,
                  })
                }
              >
                Chat with Employer
              </button>
            </div>
            </>
          ) : (
            <div className="alert alert-warning">
              ⚠️ You are neither the poster nor the accepted worker for this job.
            </div>
          )}
        </div>

        <hr />

        {/* Payment Section */}
        {/* Payment Section */}
        <div className="mt-4">
          {isPoster ? (
            <>
              {job.paymentConfirmation?.posterConfirmed ? (
                <div className="alert alert-success">✅ You have confirmed sending the payment.</div>
              ) : (
                <>
                  <p>After sending payment to the worker, please click below to confirm:</p>
                  <button className="btn btn-success" onClick={handleConfirmPayment}>
                    Confirm Payment Sent
                  </button>
                </>
              )}
            </>
          ) : isWorker ? (
            <>
              {job.paymentConfirmation?.workerConfirmed ? (
                <div className="alert alert-success">✅ You have confirmed receiving the payment.</div>
              ) : (
                <>
                  <p>After you receive payment, please click below to confirm:</p>
                  <button className="btn btn-success" onClick={handleConfirmPayment}>
                    Confirm Payment Received
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="alert alert-warning">
              ⚠️ You are neither the poster nor the accepted worker for this job.
            </div>
          )}
        </div>

        {/* ✅ Show message when both confirmed */}
        {job.paymentConfirmation?.posterConfirmed && job.paymentConfirmation?.workerConfirmed && (
          <div className="alert alert-primary mt-3">
            🎉 Both sides have confirmed payment. Job is complete!
          </div>
        )}

        <hr />

        {/* Rating Section */}
        <div className="mt-4">
          <h5>Rate your experience:</h5>
          {ratingSubmitted ? (
            <div className="alert alert-info">
              ⭐ You rated this job {rating} out of 5.
            </div>
          ) : (
            <>
              <div className="d-flex gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`btn ${rating === num ? 'btn-warning' : 'btn-outline-warning'}`}
                    onClick={() => setRating(num)}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" onClick={handleSubmitRating}>
                Submit Rating
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkPage;
