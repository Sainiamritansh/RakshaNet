import { View, Text, StyleSheet, Image, StatusBar } from 'react-native';
import React, { useEffect, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MarkersContext } from '../context/MarkersContext';

const Weather = () => {
  const [weather, setWeather] = React.useState(null);
  const { location } = useContext(MarkersContext);

  useEffect(() => {
    const { lat, lon } = location;
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=5959878efacce36551495a8059ae2d77&units=metric`)
      .then((response) => response.json())
      .then((data) => {
        setWeather(data);
      });
  }, [location]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Weather</Text>
        <Text style={styles.headerTitle}>Current Conditions</Text>
      </View>

      {weather ? (
        <View style={styles.content}>
          {/* Main Weather Card */}
          <View style={styles.mainCard}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={18} color="#E53935" />
              <Text style={styles.locationName}>{weather.name}</Text>
            </View>

            <Image
              style={styles.icon}
              source={{ uri: `http://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png` }}
            />

            <Text style={styles.temp}>{Math.round(weather.main.temp)}°</Text>
            <Text style={styles.feelsLike}>Feels like {Math.round(weather.main.feels_like)}°C</Text>
            <View style={styles.descriptionBadge}>
              <Text style={styles.descriptionText}>
                {weather.weather[0].description}
              </Text>
            </View>
          </View>

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <View style={[styles.detailIconBg, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="water" size={22} color="#1E88E5" />
              </View>
              <Text style={styles.detailValue}>{weather.main.humidity}%</Text>
              <Text style={styles.detailLabel}>Humidity</Text>
            </View>

            <View style={styles.detailItem}>
              <View style={[styles.detailIconBg, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="leaf" size={22} color="#43A047" />
              </View>
              <Text style={styles.detailValue}>{weather.wind.speed} m/s</Text>
              <Text style={styles.detailLabel}>Wind</Text>
            </View>

            <View style={styles.detailItem}>
              <View style={[styles.detailIconBg, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="speedometer" size={22} color="#FB8C00" />
              </View>
              <Text style={styles.detailValue}>{weather.main.pressure}</Text>
              <Text style={styles.detailLabel}>Pressure</Text>
            </View>
          </View>

          {/* Safety Tip */}
          <View style={styles.tipCard}>
            <Ionicons name="shield-checkmark" size={20} color="#E53935" />
            <Text style={styles.tipText}>
              Weather data helps RakshaNet provide better emergency assistance in your area.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingPulse}>
            <Ionicons name="cloudy" size={40} color="#E53935" />
          </View>
          <Text style={styles.loadingText}>Loading weather data...</Text>
        </View>
      )}
    </View>
  );
};

export default Weather;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    paddingTop: 55,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  headerLabel: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  icon: {
    width: 120,
    height: 120,
  },
  temp: {
    fontSize: 64,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: -8,
  },
  feelsLike: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  descriptionBadge: {
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: '#616161',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailsGrid: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  detailIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  detailLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    fontWeight: '500',
    marginTop: 4,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#616161',
    lineHeight: 19,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#616161',
    fontWeight: '600',
  },
});