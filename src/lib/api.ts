import { Briefing, SearchParams } from './types';

const USE_MOCK = true; // Switch to false when backend is ready
const API_BASE_URL = 'http://localhost:8787/api/v1';

// Mock data for development
const mockBriefing: Briefing = {
  summary: "Clear skies with good air quality. Light traffic expected. Metro is your best option today.",
  weather: {
    temp: 18,
    feels_like: 16,
    condition: 'clear',
    pop: 0.1,
    wind_speed: 12,
    humidity: 65,
    hourly: [
      { time: '09:00', temp: 16, pop: 0.05, condition: 'clear' },
      { time: '10:00', temp: 17, pop: 0.05, condition: 'clear' },
      { time: '11:00', temp: 18, pop: 0.1, condition: 'cloudy' },
      { time: '12:00', temp: 19, pop: 0.1, condition: 'cloudy' },
      { time: '13:00', temp: 20, pop: 0.15, condition: 'cloudy' },
      { time: '14:00', temp: 20, pop: 0.15, condition: 'cloudy' },
      { time: '15:00', temp: 19, pop: 0.2, condition: 'rain' },
      { time: '16:00', temp: 18, pop: 0.3, condition: 'rain' },
    ],
  },
  air: {
    pm10: 28,
    pm25: 15,
    grade: 'good',
    advice: 'Air quality is excellent. Perfect day for outdoor activities.',
  },
  traffic: {
    eta: {
      car: 45,
      metro: 32,
      bike: 55,
    },
    recommend: 'metro',
    notes: 'Downtown congestion expected. Metro includes 6min walking transfer at City Hall station.',
  },
};

export async function getBriefing(params: SearchParams): Promise<Briefing> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    return mockBriefing;
  }

  const queryParams = new URLSearchParams({
    from: params.from,
    to: params.to,
    time: params.time,
    mode: params.mode,
  });

  const response = await fetch(`${API_BASE_URL}/briefing?${queryParams}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || 'Failed to fetch briefing');
  }

  return response.json();
}
