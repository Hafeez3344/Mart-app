import api from '../lib/api';

/**
 * Standardized HTTP GET request helper
 * @param {string} endpoint - API URL path (e.g. '/patients')
 * @param {object} params - Query parameters object
 */
export const getApi = async (endpoint, params = {}) => {
  try {
    const response = await api.get(endpoint, { params });
    return response.data;
  } catch (error) {
    console.error(`GET ${endpoint} Error:`, error);
    throw error;
  }
};

/**
 * Standardized HTTP POST request helper
 * @param {string} endpoint - API URL path
 * @param {object} data - Payload body
 */
export const postApi = async (endpoint, data = {}) => {
  try {
    const response = await api.post(endpoint, data);
    return response.data;
  } catch (error) {
    console.error(`POST ${endpoint} Error:`, error);
    throw error;
  }
};

/**
 * Standardized HTTP PUT request helper
 * @param {string} endpoint - API URL path
 * @param {object} data - Payload body
 */
export const putApi = async (endpoint, data = {}) => {
  try {
    const response = await api.put(endpoint, data);
    return response.data;
  } catch (error) {
    console.error(`PUT ${endpoint} Error:`, error);
    throw error;
  }
};

/**
 * Standardized HTTP DELETE request helper
 * @param {string} endpoint - API URL path
 */
export const deleteApi = async (endpoint) => {
  try {
    const response = await api.delete(endpoint);
    return response.data;
  } catch (error) {
    console.error(`DELETE ${endpoint} Error:`, error);
    throw error;
  }
};

export default {
  getApi,
  postApi,
  putApi,
  deleteApi
};
