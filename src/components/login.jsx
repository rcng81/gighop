import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase';
import '../css/login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent! Check your inbox.');
    } catch (err) {
      console.error('Password reset error:', err.message);
      setError('Failed to send reset email. Try again.');
    }
  };

  const handleLogin = async () => {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;

    try {
      await setPersistence(auth, persistence);
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      console.log('Logged in as:', userCred.user.email);
      navigate('/community');
    } catch (err) {
      console.error('Login error:', err.message);
      setError('Invalid email or password');
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '100vh', width: '100vw', padding: '1rem' }}
    >
      <div className="card p-4 shadow" style={{ width: '360px' }}>
        <h2 className="text-center mb-4">Login</h2>

        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            value={email}
            placeholder="Enter your email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            value={password}
            placeholder="Enter your password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="remember">
            Remember Me
          </label>
        </div>

        <div className="text-end mb-3">
          <button type="button" className="btn btn-link p-0 text-decoration-underline" onClick={handleForgotPassword}>
            Forgot Password?
          </button>
        </div>

        {error && <p className="text-danger text-center mb-3">{error}</p>}

        <div className="d-grid">
          <button className="btn btn-primary" onClick={handleLogin}>
            LOGIN
          </button>
        </div>

        <p className="text-center mt-3">
          <Link to="/signup" className="text-decoration-none">
            Don't have an account?
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
