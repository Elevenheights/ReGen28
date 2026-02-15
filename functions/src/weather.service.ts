import axios from 'axios';

interface WeatherData {
	temperature: number;
	description: string;
	isDay: boolean; // 1 = day, 0 = night
	code: number;
}

/**
 * Get current weather for a location string (e.g. "City, Country")
 * using Open-Meteo free API
 */
export async function getWeatherForLocation(location: string): Promise<string> {
	if (!location || location === 'Unknown') return 'Unknown';

	try {
		// 1. Geocode the location
		const coords = await getCoordinates(location);
		if (!coords) return 'Unknown';

		// 2. Get Weather
		const weather = await getCurrentWeather(coords.lat, coords.lng);

		return `${weather.temperature}°C, ${weather.description}`;
	} catch (error) {
		console.error('Error fetching weather:', error);
		return 'Unknown';
	}
}

async function getCoordinates(location: string): Promise<{ lat: number, lng: number } | null> {
	try {
		// Extract city name if format is "City, Country"
		const city = location.split(',')[0].trim();

		const response = await axios.get(`https://geocoding-api.open-meteo.com/v1/search`, {
			params: {
				name: city,
				count: 1,
				language: 'en',
				format: 'json'
			}
		});

		if (response.data && response.data.results && response.data.results.length > 0) {
			const result = response.data.results[0];
			return {
				lat: result.latitude,
				lng: result.longitude
			};
		}
		return null;
	} catch (error) {
		console.error('Geocoding error:', error);
		return null;
	}
}

async function getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
	try {
		const response = await axios.get(`https://api.open-meteo.com/v1/forecast`, {
			params: {
				latitude: lat,
				longitude: lng,
				current: 'temperature_2m,weather_code,is_day',
				temperature_unit: 'celsius'
			}
		});

		const current = response.data.current;
		const code = current.weather_code;

		return {
			temperature: current.temperature_2m,
			description: getWeatherDescription(code),
			isDay: current.is_day === 1,
			code: code
		};

	} catch (error) {
		console.error('Open-Meteo API error:', error);
		throw error;
	}
}

function getWeatherDescription(code: number): string {
	// WMO Weather interpretation codes (WW)
	// https://open-meteo.com/en/docs
	switch (code) {
		case 0: return 'Clear sky';
		case 1: return 'Mainly clear';
		case 2: return 'Partly cloudy';
		case 3: return 'Overcast';
		case 45: return 'Fog';
		case 48: return 'Depositing rime fog';
		case 51: return 'Light drizzle';
		case 53: return 'Moderate drizzle';
		case 55: return 'Dense drizzle';
		case 56: return 'Light freezing drizzle';
		case 57: return 'Dense freezing drizzle';
		case 61: return 'Slight rain';
		case 63: return 'Moderate rain';
		case 65: return 'Heavy rain';
		case 66: return 'Light freezing rain';
		case 67: return 'Heavy freezing rain';
		case 71: return 'Slight snow fall';
		case 73: return 'Moderate snow fall';
		case 75: return 'Heavy snow fall';
		case 77: return 'Snow grains';
		case 80: return 'Slight rain showers';
		case 81: return 'Moderate rain showers';
		case 82: return 'Violent rain showers';
		case 85: return 'Slight snow showers';
		case 86: return 'Heavy snow showers';
		case 95: return 'Thunderstorm';
		case 96: return 'Thunderstorm with slight hail';
		case 99: return 'Thunderstorm with heavy hail';
		default: return 'Unknown';
	}
}
