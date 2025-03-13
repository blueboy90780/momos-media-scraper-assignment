import React, { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import styles from '../app/page.module.css';

export default function LoginForm({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset loading state on mount
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      setError('Username and password are required');
      return;
    }
    
    setLoading(true);
    setError(''); // Clear any previous errors
    
    try {
      await onLogin(credentials);
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please check your credentials.');
      setLoading(false); // Ensure loading is set to false on error
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  return (
    <div className={styles.loginContainer}>
      <h1>Login</h1>
      {error && <div className={styles.errorMessage}>{error}</div>}
      <form onSubmit={handleLogin} className={styles.form}>
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={credentials.username}
          onChange={handleInputChange}
          required
          disabled={loading}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={credentials.password}
          onChange={handleInputChange}
          required
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={loading || !credentials.username || !credentials.password}
        >
          {loading ? <FaSpinner className={styles.spinner} /> : 'Login'}
        </button>
      </form>
    </div>
  );
}