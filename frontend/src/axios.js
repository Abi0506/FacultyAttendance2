import axios from 'axios';

const instance = axios.create({
   baseURL: process.env.NODE_ENV === 'development'
    ? 'http://bio.psgitech.ac.in:5050/api'
    : 'http://bio.psgitech.ac.in:5050/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

instance.interceptors.response.use(
  (response) => response, 
  (error) => {
    console.error('Axios error:', error.response || error.message); // Log the error for debugging
    return Promise.reject(error);
  }
);


export default instance;
