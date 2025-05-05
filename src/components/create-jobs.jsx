import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { addDoc, collection } from 'firebase/firestore';
import { availableTags } from '../constants';

const CreateJobs = () => {
    const { communityId } = useParams();
    const navigate = useNavigate();

    const [title, setJobTitle] = useState('');
    const [description, setJobDescription] = useState('');
    const [price, setJobPrice] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [loading, setLoading] = useState(false);

    const toggleTag = (tag) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const handleCreateJob = async (e) => {
        e.preventDefault();
        if (selectedTags.length === 0) {
            setLoading(false);
            return;
        }
        if (loading) return;

        setLoading(true);

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("User not authenticated");

            const jobData = {
                title,
                description,
                price,
                tags: selectedTags,
                createdAt: new Date(),
                employerId: user.uid,
                acceptedApplicantIds: [],
            };

            await addDoc(collection(db, 'communities', communityId, 'jobs'), jobData);

            alert('Job created successfully~');
            navigate(`/community/${communityId}`);
        } catch (error) {
            console.error('Error creating job: ', error);
            alert('Failed to create job.')
        } finally {
            setLoading(false);
        }
    };

    const goBackToCommunity = () => {
        navigate(`/community/${communityId}`);
    }

    return (
        <div className="container py-5">
            {/* Navigate back to Community's main page */}
            <div className="mb-4">
                <button className="btn btn-secondary" onClick={goBackToCommunity}>
                    ← Return to Community
                </button>
            </div>

            <div className="card shadow-sm p-4">
                <h4>Create a Job Posting</h4>
                {/* Job Creation Form */}
                <form onSubmit={handleCreateJob}>
                    {/* Job Title */}
                    <div className="mb-3">
                        <label className="form-label">Job Title</label>
                        <input
                            type="text"
                            className="form-control"
                            value={title}
                            onChange={(e) => setJobTitle(e.target.value)}
                            required
                        />
                    </div>

                    {/* Job Description */}
                    <div className="mb-3">
                        <label className="form-label">Job Description</label>
                        <textarea
                            className="form-control"
                            rows="3"
                            value={description}
                            onChange={(e) => setJobDescription(e.target.value)}
                            required
                        />
                    </div>

                    {/* Job Price */}
                    <div className="mb-3">
                        <label className="form-label">Price ($/hr)</label>
                        <input
                            type="number" 
                            min="0.01"
                            step="0.01"
                            className="form-control" 
                            value={price}
                            onChange={(e) => setJobPrice(e.target.value)}
                            required
                        />
                    </div>

                    {/* Skill tags needed to apply*/}
                    <div className="mb-3">
                        <label className="form-label">Required Skills</label>
                        <div className="d-flex flex-wrap gap-2">
                            {availableTags.map(tag => (
                            <button
                                type="button"
                                key={tag}
                                className={`btn btn-outline-primary ${selectedTags.includes(tag) ? 'active' : ''}`}
                                onClick={() => toggleTag(tag)}
                            >
                                {tag}
                            </button>
                            ))}
                        </div>
                        {selectedTags.length === 0 && <div className="text-danger mt-1">Please select at least one skill</div>}
                    </div>

                    {/* Submit Job creation button */}
                    <button 
                        type="submit" 
                        class="btn btn-primary mb-3"
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Job'} {/* if loading, show 'Creating', else show 'Create Job' */}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateJobs;