import React, { useState, useEffect } from 'react';
import {
    Image,
    Text,
    ScrollView,
    View,
    TextInput,
    TouchableOpacity,
    Alert,
    Dimensions
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../../firebase';
import Geolocation from 'react-native-geolocation-service';
import SafeAreaWrapper from './SafeAreaWrapper';
import HomeScreenStyles from '../../styles/HomeScreenStyle';
import LocationPermissions from './permissions/LocationPermissions';
import axios from 'axios';
import API_BASE_URL from '../../config';

const { width, height } = Dimensions.get('window');

function HomeScreen() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [trips, setTrips] = useState([
        { id: '1', tripName: 'Hiking Trip in Vancouver', date: 'March 20, 2025' },
        { id: '2', tripName: 'Staycation on Bowen Island', date: 'April 16, 2025' },
        { id: '3', tripName: 'Cafe Hopping', date: 'April 25, 2025' },
    ]);
    const [favorites, setFavorites] = useState([
        { id: '1', placeName: 'Banff National Park', location: 'Alberta, Canada' },
        { id: '2', placeName: 'Santorini', location: 'Greece' },
        { id: '3', placeName: 'Kyoto Temples', location: 'Japan' },
    ]);
    const [showQuizPrompt, setShowQuizPrompt] = useState(false);
    const [userId, setUserId] = useState(null);

    // WEATHER
    const [weather, setWeather] = useState(null);
    const [location, setLocation] = useState(null);
    const [hasLocationPermission, setHasLocationPermission] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            const fetchUserData = async () => {
                try {
                    const storedUser = await AsyncStorage.getItem('user');
                    if (!storedUser) return;

                    const user = JSON.parse(storedUser);
                    setUserId(String(user.id));

                    const userRef = database().ref(`/users/${user.id}`);
                    userRef.once('value', snapshot => {
                        const firebaseTravelStyleId = snapshot.val()?.travel_style_id ?? user.travel_style_id;
                        setShowQuizPrompt(firebaseTravelStyleId === 4);
                        user.travel_style_id = firebaseTravelStyleId;
                        AsyncStorage.setItem('user', JSON.stringify(user));
                    });

                } catch (error) {
                    console.error('❌ Error retrieving user data:', error);
                }
            };

            fetchUserData();
        }, [])
    );

    // WEATHER
    const fetchWeather = async (latitude, longitude) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/weather`, {
                params: {
                    latitude,
                    longitude
                }
            });

            if (response.data.status === "success") {
                const roundedTemperature = Math.round(response.data.data.temperature);
                setWeather({
                    ...response.data.data,
                    temperature: roundedTemperature, 
                });
            } else {
                console.log("Error fetching weather: ", response.data.detail);
            }
        }
        catch (err) {
            console.log("Error fetching weather data: ", err)
        }
    }

    const handleLocationGranted = (coords) => {
        console.log("Location received in HomeScreen:", coords);
        setLocation(coords);
        setHasLocationPermission(true);
        fetchWeather(coords.latitude, coords.longitude);
    };

    // ✅ Fetch weather when HomeScreen mounts & location exists
    useEffect(() => {
        if (location) {
            fetchWeather(location.latitude, location.longitude);
        }
    }, [location]); // ✅ Runs when `location` updates

    const handleQuizStart = () => {
        if (!userId) return;
        navigation.navigate('QuizScreen');
    };

    const handleTripClick = () => {
        Alert.alert("Feature is coming soon!");
    };

    const handleProfileClick = () => {
        navigation.navigate('Profile'); // temporarily used for itinerary to allow back swiping
    };

    const handleWeatherClick = () => {
        navigation.navigate('Location')
    }

    // Shows the LocationPermissions screen if not granted, once granted, proceed to homescreen.
    if (!hasLocationPermission) {
        return <LocationPermissions onLocationGranted={handleLocationGranted} />;
    }

    return (
        <SafeAreaWrapper>
            <View style={{ flex: 1, backgroundColor: 'white', padding: 15, marginBottom: 70 }}>

                {/* ✅ 1. HEADER SECTION (30% HEIGHT) */}
                <View
                    style={HomeScreenStyles.headerContainer}>
                    {/* Left: Take Quiz or WayPoint */}
                    <View style={{ width: '50%', height: '100%', justifyContent: 'center' }}>
                        {showQuizPrompt ? (
                            <TouchableOpacity style={HomeScreenStyles.takeQuizContainer} onPress={handleQuizStart}>
                                <Text style={HomeScreenStyles.takeQuizText}>Discover your travel style!</Text>
                                <TouchableOpacity style={HomeScreenStyles.takeQuizButton} onPress={handleQuizStart}>
                                    <Text style={HomeScreenStyles.takeQuizButtonText}>Start</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ) : (
                            <View style={HomeScreenStyles.brandContainer}>
                                <Image source={require("../../assets/images/logo.png")} style={HomeScreenStyles.logo} />
                                <Text style={HomeScreenStyles.waypointText}>WayPoint</Text>
                            </View>
                        )}
                    </View>

                    {/* Middle: 20% - Weather Placeholder */}

                    <View style={HomeScreenStyles.weatherBox}>
                        {weather ? (
                            <>
                                <View style={HomeScreenStyles.weatherHorizontal}>
                                    <Text style={HomeScreenStyles.weatherHorizontalText}>{weather.temperature}°C</Text>
                                    <Image
                                        source={{ uri: `https://openweathermap.org/img/wn/${weather.weather_icon}@2x.png` }}
                                        style={HomeScreenStyles.weather_icon} />
                                </View>
                                <Text style={HomeScreenStyles.weatherText}>{weather.weather_main}</Text>

                            </>
                        ) : (
                            <Text style={HomeScreenStyles.weatherText}>Fetching weather...</Text>
                        )}
                    </View>



                    {/* Right: 20% - Profile Clickable Circle */}
                    <TouchableOpacity style={HomeScreenStyles.profileButton} onPress={handleProfileClick}>
                        <Text style={HomeScreenStyles.profileIcon}>👤</Text>
                    </TouchableOpacity>
                </View>

                {/* ✅ 2. SEARCH BAR */}
                <View style={HomeScreenStyles.searchContainer}>
                    <TextInput
                        style={HomeScreenStyles.searchInput}
                        placeholder="Search..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {/* ✅ 3. TITLE SECTION (5% HEIGHT) */}
                <View style={HomeScreenStyles.titleContainer}>
                    <Text style={HomeScreenStyles.titleText}>Trip Plans</Text>
                </View>

                {/* ✅ 4. TRIPS LIST */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
                    style={HomeScreenStyles.tripScrollView}
                >
                    {trips.map((trip) => (
                        <TouchableOpacity
                            key={trip.id}
                            onPress={handleTripClick}
                            style={HomeScreenStyles.tripCard}
                        >
                            <Text style={HomeScreenStyles.tripTitle}>{trip.tripName}</Text>
                            <Text style={HomeScreenStyles.tripDate}>{trip.date}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>


                {/* ✅ 5. CURRENT FAVORITE DESTINATIONS (20% HEIGHT) */}
                <Text style={HomeScreenStyles.favoriteTitle}>Current Favorite Destinations</Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    contentContainerStyle={{ paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}
                    style={HomeScreenStyles.favoriteScrollView}
                >
                    {favorites.map((fav) => (
                        <TouchableOpacity
                            key={fav.id}
                            onPress={handleTripClick}
                            style={HomeScreenStyles.favoriteCard}
                        >
                            <Text style={HomeScreenStyles.favoritePlace}>{fav.placeName}</Text>
                            <Text style={HomeScreenStyles.favoriteLocation}>{fav.location}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </SafeAreaWrapper>
    );
}

export default HomeScreen;
