// Central API base URL.
// In production, set the VITE_API_URL environment variable to your backend URL.
// e.g. https://your-app.onrender.com
// Locally it falls back to http://localhost:5000
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default API;
