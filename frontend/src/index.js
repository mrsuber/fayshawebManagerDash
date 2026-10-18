import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import axios from 'axios';
import App from './App';

// Admin pages call the API with plain axios. Send the signed-in user's JWT with every request to
// this site's API (relative /api URLs, or REACT_APP_API_URL / the local dev API).
const API_PREFIXES = ['/api', process.env.REACT_APP_API_URL, 'http://localhost:5001/api'].filter(Boolean);
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  const url = config.url || '';
  if (token && !config.headers?.Authorization && API_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
