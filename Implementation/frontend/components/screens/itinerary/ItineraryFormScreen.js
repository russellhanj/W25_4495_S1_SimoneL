import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';
import API_BASE_URL from '../../../config';
import SafeAreaWrapper from '../SafeAreaWrapper';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '@env';
import 'react-native-get-random-values';

const ItineraryFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, itineraryId } = route.params || {};

  // State
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [markedDates, setMarkedDates] = useState({});
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // For destination overlay
  const [showDestinationModal, setShowDestinationModal] = useState(false);

  // Fetch itinerary details if editing
  useEffect(() => {
    if (itineraryId) {
      fetchItineraryDetails();
    }
  }, [itineraryId]);

  const fetchItineraryDetails = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/itineraries/${itineraryId}`);
      if (response.status === 200) {
        const itinerary = response.data;
        setName(itinerary.name);
        setDestination(itinerary.destination);
        setBudget(itinerary.budget ? itinerary.budget.toString() : '');
        setStartDate(itinerary.start_date.split('T')[0]);
        setEndDate(itinerary.end_date.split('T')[0]);

        // Marked dates
        const range = getMarkedDates(
          itinerary.start_date.split('T')[0],
          itinerary.end_date.split('T')[0]
        );
        setMarkedDates(range);
      }
    } catch (error) {
      console.error("❌ Error fetching itinerary:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to load itinerary details.");
    }
  };

  // Handle date selection
  const handleDateSelect = (day) => {
    const selectedDate = day.dateString;

    if (!startDate || (startDate && endDate)) {
        // Reset previous selection & set new start date
        setStartDate(selectedDate);
        setEndDate(null);

        setMarkedDates({
            [selectedDate]: {
                selected: true,
                color: '#007bff', // ✅ Ensure it's blue
                textColor: 'white', // ✅ Ensure text is white
                startingDay: true, 
                endingDay: true, // ✅ So it fully highlights as a single selection
            },
        });
    } else {
        if (new Date(selectedDate) < new Date(startDate)) {
            Alert.alert("Invalid Date", "End date cannot be before start date.");
            return;
        }
        setEndDate(selectedDate);

        // Mark the full range between start and end date
        const range = getMarkedDates(startDate, selectedDate);
        setMarkedDates(range);
        setCalendarVisible(false); // Close calendar after selecting end date
    }
};


  // Generate date range markers
  const getMarkedDates = (start, end) => {
    let range = {};
    let currentDate = new Date(start);
    let endDate = new Date(end);

    while (currentDate <= endDate) {
        let dateString = currentDate.toISOString().split('T')[0];

        range[dateString] = {
            color: '#007bff',
            textColor: 'white',
            ...(dateString === start ? { startingDay: true } : {}),
            ...(dateString === end ? { endingDay: true } : {}),
        };

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return range;
};

  // Handle form submission (Create or Edit)
  const handleSubmit = async () => {
    if (!name || !destination || !startDate || !endDate) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        id: itineraryId,
        name,
        destination,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        created_by: userId,
        budget: budget ? parseFloat(budget) : 0,
        last_updated_by: userId,
      };

      let response;
      const config = {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
      };

      if (itineraryId) {
        response = await axios.put(`${API_BASE_URL}/itineraries/${itineraryId}`, requestData, config);
      } else {
        response = await axios.post(`${API_BASE_URL}/itineraries/`, requestData, config);
      }

      if (response.status === 200) {
        const newItineraryId = response.data.itinerary_id || response.data.id;
        Alert.alert(
          "Success",
          itineraryId ? "Itinerary updated successfully!" : "Itinerary created successfully!"
        );
        navigation.replace("ItineraryDetail", { itineraryId: newItineraryId });
      }
    } catch (error) {
      console.error("❌ Error saving itinerary:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to save itinerary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>
          {itineraryId ? "Edit Itinerary" : "Create Itinerary"}
        </Text>

        {/* Trip Name */}
        <TextInput
          style={styles.input}
          placeholder="Enter Trip Name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />

        {/* Destination (Pressable to open bottom overlay) */}
        <View style={styles.destinationContainer}>
            {/* Clickable Area to Open Modal (90%) */}
            <Pressable style={styles.destinationInput} onPress={() => setShowDestinationModal(true)}>
                <Text style={destination ? styles.inputText : styles.placeholderText}>
                    {destination || "Enter Destination"}
                </Text>
            </Pressable>

            {/* "X" Button for Clearing Input (10%) */}
            {destination !== '' && (
                <TouchableOpacity style={styles.clearButton} onPress={() => setDestination('')}>
                    <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* Date Selection */}
        <Pressable style={styles.input} onPress={() => setCalendarVisible(!calendarVisible)}>
          <Text style={styles.inputText}>
            {startDate ? startDate : "Select Start Date"} -{" "}
            {endDate ? endDate : "Select End Date"}
          </Text>
        </Pressable>

        {calendarVisible && (
          <Calendar
            markingType="period"
            markedDates={markedDates}
            onDayPress={handleDateSelect}
            style={styles.calendar}
          />
        )}

        {/* Budget */}
        <TextInput
          style={styles.input}
          placeholder="Enter Budget (Optional)"
          placeholderTextColor="#999"
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
        />

        {/* Submit Button */}
        {loading ? (
          <ActivityIndicator size="large" color="#007bff" />
        ) : (
          <Pressable onPress={handleSubmit} style={styles.submitButton}>
            <Text style={styles.submitText}>
              {itineraryId ? "Save Changes" : "Create Itinerary"}
            </Text>
          </Pressable>
        )}
      </View>

        {/* Destination Modal (Bottom Overlay) */}
        <Modal
    visible={showDestinationModal}
    animationType="slide"
    transparent={true}
    onRequestClose={() => setShowDestinationModal(false)}
>
    <View style={styles.modalBackground}>
        {/* KeyboardAvoidingView ensures the input doesn't get covered by the keyboard */}
        <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Search Destination</Text>

            <GooglePlacesAutocomplete
                placeholder="Type a place"
                onPress={(data, details = null) => {
                    if (details) {
                        setDestination(details.formatted_address);
                    } else {
                        setDestination(data.description);
                    }
                    setShowDestinationModal(false);
                }}
                query={{
                    key: GOOGLE_PLACES_API_KEY,
                    language: 'en',
                    types: '(regions)',
                }}
                fetchDetails={true}
                styles={{
                    textInputContainer: {
                        width: '100%',
                        backgroundColor: '#fff',
                        borderRadius: 8,
                        borderColor: '#ddd',
                        // borderWidth: 1,
                        paddingHorizontal: 10,
                    },
                    textInput: {
                        height: 50,
                        fontSize: 16,
                        color: '#333',
                        borderRadius: 8,
                        borderColor: '#ddd',
                        borderWidth: 1,
                        paddingHorizontal: 10,
                    },
                    listView: {
                        backgroundColor: '#fff',
                        borderRadius: 8,
                        borderColor: '#ddd',
                        borderWidth: 1,
                        marginTop: 5,
                        elevation: 3,
                        zIndex: 9999,
                    },
                }}
            />

            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowDestinationModal(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
        </View>
    </View>
</Modal>

    </SafeAreaWrapper>
  );
};

const styles = StyleSheet.create({
  /* Container for the entire screen */
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  /* Screen Title */
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
    textAlign: 'center',
  },
  /* Large Rounded Input */
  input: {
    height: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 15,
    paddingHorizontal: 20, // Ensures left padding is consistent
    marginBottom: 15,
    backgroundColor: '#fff',
    fontSize: 16, // Set uniform font size
    justifyContent: 'center', // Centers text inside the field
    },
  /* Text inside the input */
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  /* Placeholder-like text for Pressable fields */
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  /* Calendar Style */
  calendar: {
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  /* Submit Button */
  submitButton: {
    height: 60,
    borderRadius: 15,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  /* Submit Button Text */
  submitText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  /* Modal overlay background */
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)', // Semi-transparent background
    justifyContent: 'flex-end', // Ensures modal starts from the bottom
},

modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    height: '85%', // Makes sure the modal covers enough space
    justifyContent: 'flex-start',
},

modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
},

closeButton: {
    marginTop: 15,
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
},

closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
},
destinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 15,
    paddingHorizontal: 20, // Matches other inputs
    marginBottom: 15,
    backgroundColor: '#fff',
    height: 60, // Same height as other inputs
},

destinationInput: {
    flex: 9, 
    height: '100%',
    justifyContent: 'center',
    fontSize: 16, // Same font size as other inputs
},

clearButton: {
    flex: 1, // 10% space for the "X" button
    alignItems: 'center',
    justifyContent: 'center',
},

clearButtonText: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
},


});

export default ItineraryFormScreen;
