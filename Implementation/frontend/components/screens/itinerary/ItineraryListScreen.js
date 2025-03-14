import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import API_BASE_URL from '../../../config';
import { database } from '../../../firebase';
import SafeAreaWrapper from '../SafeAreaWrapper';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';

const ItineraryListScreen = () => {
    const navigation = useNavigation();
    const [ownedItineraries, setOwnedItineraries] = useState([]);
    const [sharedItineraries, setSharedItineraries] = useState([]);
    const [pendingInvites, setPendingInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);

    const [index, setIndex] = useState(0);
    const [routes] = useState([
        { key: 'personal', title: 'Personal' }, 
        { key: 'shared', title: 'Shared Itineraries' }  
    ]);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                console.log("🔄 Loading user data from AsyncStorage...");
                const storedUser = await AsyncStorage.getItem('user');
                if (!storedUser) {
                    console.error("❌ No user found in AsyncStorage!");
                    setLoading(false);
                    return;
                }

                const userData = JSON.parse(storedUser);
                setUserId(String(userData.id));

                console.log("📥 Fetching owned itineraries from PostgreSQL...");
                fetchOwnedItineraries(userData.id);
                fetchSharedItineraries(userData.id);
                fetchPendingInvites(userData.id);
            } catch (error) {
                console.error("❌ Error loading user data:", error);
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    // ✅ Fetch Owned Itineraries from PostgreSQL
    const fetchOwnedItineraries = async (userId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/itineraries/users/${userId}/itineraries`);
            if (response.status === 200) {
                setOwnedItineraries(response.data);
            }
        } catch (error) {
            console.error("❌ Error fetching owned itineraries:", error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Fetch Shared Itineraries from Firebase Realtime Database
    const fetchSharedItineraries = (userId) => {
        database()
            .ref('/live_itineraries')
            .on('value', (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const filteredSharedItineraries = Object.values(data).filter(itinerary => 
                        itinerary.collaborators && itinerary.collaborators.includes(userId)
                    );
                    setSharedItineraries(filteredSharedItineraries);
                }
            });
    };

    // ✅ Fetch Pending Invitations from Firebase
    const fetchPendingInvites = (userId) => {
        database()
            .ref('/invitations/invitee')
            .child(userId)
            .on('value', (snapshot) => {
                if (snapshot.exists()) {
                    const invitesData = Object.values(snapshot.val());
                    setPendingInvites(invitesData);
                }
            });
    };

    useFocusEffect(
        useCallback(() => {
            if (userId) {
                console.log("🔄 Refetching itineraries and invitations...");
                fetchOwnedItineraries(userId);
                fetchSharedItineraries(userId);
                fetchPendingInvites(userId);
            }
        }, [userId])
    );

    const handleSelectItinerary = (itinerary) => {
        navigation.navigate('ItineraryDetail', { itineraryId: itinerary.id });
    };

    const handleAddItinerary = () => {
        navigation.navigate('ItineraryForm', { userId });
    };

    // ✅ Render Pending Invites List with Accept/Decline Buttons
    const renderInviteItem = ({ item }) => (
        <View style={styles.inviteCard}>
            <Text style={styles.inviteText}>
                {item.inviterName} ({item.inviterEmail}) invited you to plan {item.tripName}
            </Text>

            {/* ✅ Buttons for Accept/Decline */}
            <View style={styles.inviteButtonsContainer}>
                <TouchableOpacity 
                    style={styles.acceptButton} 
                    onPress={() => Alert.alert("Coming Soon", "Accept feature will be implemented soon.")}
                >
                    <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.declineButton} 
                    onPress={() => Alert.alert("Coming Soon", "Decline feature will be implemented soon.")}
                >
                    <Text style={styles.buttonText}>Decline</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // ✅ Render Shared Itinerary List
    const renderItineraryItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.itineraryCard} 
            onPress={() => handleSelectItinerary(item)}
        >
            <Text style={styles.itineraryName}>{item.name}</Text>
            <Text style={styles.itineraryDestination}>{item.destination}</Text>
            <Text style={styles.itineraryDate}>
                {new Date(item.start_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} 
                - 
                {new Date(item.end_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
            </Text>
        </TouchableOpacity>
    );

    // ✅ Define the Shared Itineraries Tab
    const SharedItineraries = () => (
        <View>
            {/* ✅ Pending Invitations List */}
            {pendingInvites.length > 0 && (
                <FlatList 
                    data={pendingInvites}
                    renderItem={renderInviteItem}
                    keyExtractor={(item, index) => `invite-${index}`}
                    contentContainerStyle={styles.listContainer}
                />
            )}

            {/* ✅ Shared Itineraries List */}
            <FlatList 
                data={sharedItineraries}
                renderItem={renderItineraryItem}
                keyExtractor={(item, index) => item.id ? item.id.toString() : `shared-${index}`}
                contentContainerStyle={styles.listContainer}
            />
        </View>
    );

    const renderScene = SceneMap({
        personal: () => (
            <FlatList 
                data={ownedItineraries}
                renderItem={renderItineraryItem}
                keyExtractor={(item, index) => item.id ? item.id.toString() : `owned-${index}`}
                contentContainerStyle={styles.listContainer}
            />
        ),
        shared: SharedItineraries,
    });

    return (
        <SafeAreaWrapper>
            <View style={styles.container}>
                <Text style={styles.activeTabTitle}>
                    {index === 0 ? 'Personal Itineraries' : 'Shared Itineraries'}
                </Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#007bff" />
                ) : (
                    <TabView
                        navigationState={{ index, routes }}
                        renderScene={renderScene} 
                        onIndexChange={setIndex}
                        initialLayout={{ width: Dimensions.get('window').width }}
                        renderTabBar={props => (
                            <TabBar
                                {...props}
                                indicatorStyle={styles.indicatorStyle}
                                style={styles.tabBar}
                                renderLabel={({ route, focused }) => (
                                    <Text style={[styles.tabLabel, focused && styles.activeTabLabel]}>
                                        {route.title}
                                    </Text>
                                )}
                            />
                        )}
                    />
                )}

                {/* ✅ Add Itinerary Button */}
                <TouchableOpacity style={styles.addButton} onPress={handleAddItinerary}>
                    <Text style={styles.addButtonText}>+ Create New Itinerary</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaWrapper>
    );
};


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginVertical: 20 },
    tabBar: { backgroundColor: '#fff', elevation: 3 },
    tabLabel: { color: '#333', fontWeight: 'bold' },
    listContainer: { paddingVertical: 10 },
    itineraryCard: {
        padding: 15,
        marginVertical: 10,
        marginHorizontal: 20,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    itineraryName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    itineraryDestination: { fontSize: 14, color: '#666' },
    itineraryDate: { fontSize: 12, fontWeight: '600', color: '#007bff' },
    addButton: { margin: 20, padding: 15, backgroundColor: '#007bff', borderRadius: 8, alignItems: 'center' },
    addButtonText: { color: '#fff', fontSize: 14 },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: 200, // Adjust as needed
    },
    noItineraries: { 
        textAlign: 'center', 
        fontSize: 16, 
        color: '#888', 
        marginVertical: 10 
    },
    tabBar: {
        backgroundColor: '#fff',  // ✅ White background for clean UI
        elevation: 3,  // ✅ Adds shadow effect for better separation
        height: 50, // ✅ Slightly increased height for visibility
    },
    tabLabel: {
        color: '#888',  // ✅ Default gray color for inactive tab
        fontSize: 16,
        fontWeight: '500', 
    },
    activeTabLabel: {
        color: '#007bff',  // ✅ Blue color for active tab
        fontWeight: 'bold',  // ✅ Bold text for active tab
    },
    indicatorStyle: {
        backgroundColor: '#007bff', // ✅ Blue underline indicator
        height: 4, // ✅ Thicker for better visibility
        borderRadius: 2, // ✅ Slightly rounded for a smooth look
    },
    activeTabTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',  // ✅ Darker color for emphasis
        textAlign: 'center',
        marginBottom: 10,  // ✅ Adds spacing above the tabs
    },
    inviteCard: {
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 15,
        marginVertical: 8,
        borderLeftWidth: 5,
        borderLeftColor: '#007bff',
    },
    inviteText: {
        fontSize: 16,
        color: '#333',
    },
    inviteButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    acceptButton: {
        flex: 1,
        padding: 10,
        backgroundColor: '#28a745',  // Green for Accept
        borderRadius: 5,
        alignItems: 'center',
        marginRight: 5,
    },
    declineButton: {
        flex: 1,
        padding: 10,
        backgroundColor: '#dc3545',  // Red for Decline
        borderRadius: 5,
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    

});

export default ItineraryListScreen;
