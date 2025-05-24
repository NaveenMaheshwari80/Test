import axios from 'axios';
import { logger } from './logger';

// Simple client-side metrics tracking
const metrics = {
  requestDurations: [],
  requestCounts: {}
};

// Dummy metrics objects that won't throw errors in browser
export const httpRequestDurationMicroseconds = {
  labels: () => ({
    observe: (duration) => {
      metrics.requestDurations.push(duration);
    }
  })
};

export const httpRequestTotal = {
  labels: () => ({
    inc: () => {
      const key = 'total';
      metrics.requestCounts[key] = (metrics.requestCounts[key] || 0) + 1;
    }
  })
};

// Function to check server health
export const checkServerHealth = async () => {
  try {
    const response = await axios.get('http://localhost:9090/health');
    return response.data.status === 'ok';
  } catch (error) {
    logger.error('Health check failed', { error });
    return false;
  }
};

// Function to send metrics to server
export const sendMetrics = async () => {
  try {
    await axios.post('http://localhost:9090/update-metrics', metrics);
    // Clear local metrics after successful send
    metrics.requestDurations = [];
    metrics.requestCounts = {};
  } catch (error) {
    logger.error('Failed to send metrics', { error });
  }
};

// Function to get current metrics
export const getCurrentMetrics = () => {
  return { ...metrics };
}; 