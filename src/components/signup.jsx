import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      // Step 1: Create user in Firebase Auth
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // Step 2: Update Firebase Auth profile with display name
      await updateProfile(userCred.user, {
        displayName: `${first} ${last}`,
      });

      const user = userCred.user; // simplify the reference

      // Step 3: Check if this user already exists in Firestore
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // Step 4: If not, add them to Firestore with additional profile data
        await setDoc(userRef, {
          firstName: first,
          lastName: last,
          fullName: `${first} ${last}`,
          email: user.email
        });
        
      }

      console.log('User created:', userCred.user);
      navigate('/');
    } catch (error) {
      console.error('Signup error:', error.message);
      alert(`Signup error: ${error.message}`);
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '100vh', width: '100vw', padding: '1rem' }}
    >
      <div className="card p-4 shadow" style={{ width: '360px' }}>
        <h2 className="text-center mb-4">Create Account</h2>

        <form onSubmit={handleSignup}>
          <div className="mb-3">
            <label className="form-label">First Name</label>
            <input
              type="text"
              className="form-control"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="Enter your first name"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Last Name</label>
            <input
              type="text"
              className="form-control"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Enter your last name"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <div className="d-grid">
            <button type="submit" className="btn btn-primary">
              SIGN UP
            </button>
          </div>
        </form>

        <p className="text-center mt-3">
          Already have an account?{' '}
          <a href="/" className="text-decoration-none">
            Login
          </a>
        </p>
      </div>
    </div>
  );
};

export default Signup;
