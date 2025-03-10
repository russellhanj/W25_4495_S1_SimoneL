import React, { useState, useEffect } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import API_BASE_URL from '../../../config';
import SafeAreaWrapper from '../SafeAreaWrapper';

const ItineraryDayScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { itineraryId, dayId } = route.params;

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newActivity, setNewActivity] = useState({
        time: '',
        name: '',
        location: '',
        notes: '',
        estimated_cost: '',
    });
    const sortActivitiesByTime = (activities) => {
        return activities.sort((a, b) => {
            const parseTime = (time) => {
                const match = time.match(/^(\d+):?(\d*)\s*(AM|PM)$/i);
                if (!match) return 0; // If time is invalid, push it to the end
                let hours = parseInt(match[1], 10);
                let minutes = match[2] ? parseInt(match[2], 10) : 0;
                const period = match[3].toUpperCase();
    
                if (period === "PM" && hours !== 12) hours += 12;
                if (period === "AM" && hours === 12) hours = 0;
    
                return hours * 60 + minutes; // Convert to minutes for easy comparison
            };
    
            return parseTime(a.time) - parseTime(b.time);
        });
    };

    // ✅ Fetch Activities from PostgreSQL
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/itineraries/${itineraryId}/days/${dayId}`);
                if (response.status === 200) {
                    setActivities(sortActivitiesByTime(response.data.activities)); // ✅ Sort activities
                }
            } catch (error) {
                console.error("❌ Error fetching activities:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, [itineraryId, dayId]);

    // ✅ Handle Add Activity Modal
    const handleOpenModal = () => setModalVisible(true);
    const handleCloseModal = () => setModalVisible(false);

    const validateTimeFormat = (time) => {
        // ✅ Regex to ensure format is `HH:MM AM/PM` or `H AM/PM`
        const timeRegex = /^(0?[1-9]|1[0-2]):?([0-5][0-9])? (AM|PM)$/i;
        return timeRegex.test(time);
    };
    
    const handleSaveActivity = async () => {
        if (!newActivity.name || !newActivity.time) {
            Alert.alert("Missing Fields", "Please enter both time and activity name.");
            return;
        }
    
        // ✅ Ensure time format is correct before saving
        if (!validateTimeFormat(newActivity.time)) {
            Alert.alert("Invalid Time Format", "Please enter time in the format HH:MM AM/PM (e.g., 8:30 AM).");
            return;
        }
    
        const activityData = {
            itinerary_day_id: dayId, 
            time: newActivity.time,
            name: newActivity.name,
            location: newActivity.location || "",
            notes: newActivity.notes || "",
            estimated_cost: newActivity.estimated_cost !== "" ? parseFloat(newActivity.estimated_cost) : 0.0,
        };
    
        console.log("📤 Sending activity data:", JSON.stringify(activityData, null, 2));
    
        try {
            const response = await axios.post(
                `${API_BASE_URL}/itineraries/${itineraryId}/days/${dayId}/activities/`,
                activityData,
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
    
            if (response.status === 200) {
                // ✅ Sort activities before updating the state
                const updatedActivities = sortActivitiesByTime([...activities, response.data]);
    
                setActivities(updatedActivities); // ✅ Ensure activities are sorted instantly
                setModalVisible(false);
                setNewActivity({ time: '', name: '', location: '', notes: '', estimated_cost: '' });
            }
        } catch (error) {
            console.error("❌ Error adding activity:", error);
    
            if (error.response) {
                console.log("🔥 Full Response Error:", JSON.stringify(error.response.data, null, 2));
                Alert.alert("Error", `Failed to add activity: ${JSON.stringify(error.response.data, null, 2)}`);
            } else {
                Alert.alert("Error", "Failed to add activity. Unknown issue.");
            }
        }
    };
    
    
    
    

    // ✅ Render Activity Item
    const renderItem = ({ item }) => (
        <TouchableOpacity 
            style={{
                backgroundColor: '#f8f9fa',
                padding: 15,
                borderRadius: 8,
                marginBottom: 15,
                width: '100%',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
            }}
        >
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#222' }}>{item.name}</Text>
            <Text style={{ fontSize: 14, color: '#007bff', marginTop: 5 }}>🕒 {item.time}</Text>
            <Text style={{ fontSize: 14, color: '#555', marginTop: 5 }}>📍 {item.location}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaWrapper>
            <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>
                    Day Activities
                </Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#007bff" />
                ) : activities.length > 0 ? (
                    <FlatList 
                        data={activities}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                    />
                ) : (
                    <Text style={{ textAlign: 'center', fontSize: 16, color: '#888', marginTop: 20 }}>
                        No activities planned.
                    </Text>
                )}

                {/* ✅ Add Activity Button */}
                <TouchableOpacity 
                    style={{
                        position: 'absolute', 
                        bottom: 20, 
                        left: 20, 
                        right: 20, 
                        padding: 15, 
                        backgroundColor: '#007bff', 
                        borderRadius: 8, 
                        alignItems: 'center',
                    }} 
                    onPress={handleOpenModal}
                >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>+ Add Activity</Text>
                </TouchableOpacity>

                {/* ✅ Modal for Adding Activity */}
                <Modal visible={modalVisible} animationType="slide" transparent={true}>
                    <View style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    }}>
                        <View style={{
                            width: '80%',
                            backgroundColor: '#fff',
                            padding: 20,
                            borderRadius: 10,
                        }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
                                Add New Activity
                            </Text>

                            <TextInput 
                                placeholder="Time (e.g., 8AM, 10:30AM)"
                                style={{ borderBottomWidth: 1, marginBottom: 10, padding: 5 }}
                                value={newActivity.time}
                                onChangeText={(text) => setNewActivity({ ...newActivity, time: text })}
                            />
                            <TextInput 
                                placeholder="Activity Name"
                                style={{ borderBottomWidth: 1, marginBottom: 10, padding: 5 }}
                                value={newActivity.name}
                                onChangeText={(text) => setNewActivity({ ...newActivity, name: text })}
                            />
                            <TextInput 
                                placeholder="Location (optional)"
                                style={{ borderBottomWidth: 1, marginBottom: 10, padding: 5 }}
                                value={newActivity.location}
                                onChangeText={(text) => setNewActivity({ ...newActivity, location: text })}
                            />
                            <TextInput 
                                placeholder="Estimated Cost (optional)"
                                style={{ borderBottomWidth: 1, marginBottom: 10, padding: 5 }}
                                keyboardType="numeric"
                                value={newActivity.estimated_cost}
                                onChangeText={(text) => setNewActivity({ 
                                    ...newActivity, 
                                    estimated_cost: text !== "" ? parseFloat(text) : 0.0 
                                })}                                
                            />

                            <TouchableOpacity 
                                style={{ backgroundColor: '#007bff', padding: 10, borderRadius: 5, alignItems: 'center' }}
                                onPress={handleSaveActivity}
                            >
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Save</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleCloseModal}>
                                <Text style={{ textAlign: 'center', color: '#007bff', marginTop: 10 }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        </SafeAreaWrapper>
    );
};

export default ItineraryDayScreen;
