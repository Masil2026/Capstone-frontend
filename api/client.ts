import axios from 'axios';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_SERVER_IP}`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getApiBaseUrl = () => API_BASE_URL;
