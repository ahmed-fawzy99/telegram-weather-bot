import configDotenv from 'dotenv';
configDotenv.config();
export async function getWhetherDetails(latitude: number, longitude: number, temperatureMetric: 'C' | 'F' | undefined): Promise<string> {
    return new Promise((resolve, reject) => {
        fetch(`http://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHER_API_KEY}&q=${latitude},${longitude}&days=1&aqi=no&alerts=no`)
            .then((response) => response.json()).then((data) => {
            let res = `
        *Weather Today (${data.forecast.forecastday[0].date}) ⛅*\n\n*City*: ${data.location.name} (${data.location.region}), ${data.location.country}.\n*Condition*: ${data.forecast.forecastday[0].day.condition.text}.\n*Max Temperature 🌡️*: ${temperatureMetric === 'F' ? data.forecast.forecastday[0].day.maxtemp_f : data.forecast.forecastday[0].day.maxtemp_c}°${temperatureMetric ?? 'C'}.\n*Min Temperature 🌡️*: ${temperatureMetric === 'F' ? data.forecast.forecastday[0].day.mintemp_f : data.forecast.forecastday[0].day.mintemp_c}°${temperatureMetric ?? 'C'}.\n*Average Humidity 💧*:${data.forecast.forecastday[0].day.avghumidity}%.\n*Rain Chance 🌧️*: ${data.forecast.forecastday[0].day.daily_chance_of_rain}%.\n*Snow Chance ❄️*: ${data.forecast.forecastday[0].day.daily_chance_of_snow}%.\n
      `
            resolve(res);
        }).catch((error) => {
            reject(error);
        });
    });
}