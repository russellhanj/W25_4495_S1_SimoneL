import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { 
  View, Text, ActivityIndicator, Alert, StyleSheet, TouchableOpacity, Modal, TextInput, Pressable, Platform, Image, ImageBackground, ScrollView 
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API_BASE_URL from '../../../config';
import SafeAreaWrapper from '../SafeAreaWrapper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { Calendar } from 'react-native-calendars';
import Icon from 'react-native-vector-icons/FontAwesome';
import { database } from '../../../firebase';
// Using react-native-image-crop-picker for image selection and cropping
import ImagePicker from 'react-native-image-crop-picker';
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions";
import NotesModal from './NotesModal';
import PlacesModal from './PlacesModal';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import OtherCostsModal from './OtherCostsModal';


const DayCard = memo(({ item, onPress, onLongPress, onEdit, renderRightActions, onLayout }) => {
  const totalEstimatedCost = item.activities?.reduce((sum, activity) => {
    return sum + (activity.estimated_cost ? parseFloat(activity.estimated_cost) : 0);
  }, 0) || 0;
  return (
    <Swipeable
      overshootLeft={false}
      overshootRight={false}
      renderRightActions={() => renderRightActions(item.id)}
    >
      <TouchableOpacity 
        onPress={() => onPress(item.id)} 
        onLongPress={onLongPress} 
        style={styles.dayCard}
        onLayout={onLayout}
      >
        <Text style={styles.dayTitle}>{item.title}</Text>
        <Text style={styles.dayDate}>
          {new Date(item.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.totalCostText}>
          Est. Cost: ${totalEstimatedCost.toFixed(2)}
        </Text>
        
        {item.activities && item.activities.length > 0 ? (
          item.activities.map(activity => (
            <View key={activity.id} style={styles.activityCard}>
              <Text style={styles.activityTime}>{activity.time}</Text>
              <Text style={styles.activityName}>{activity.name}</Text>
              <Text style={styles.activityLocation}>📍 {activity.location}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.noActivities}>No activities planned.</Text>
        )}
        <TouchableOpacity 
          style={styles.editIconContainer}
          onPress={() => onEdit(item.id)}
        >
          <Icon name="pencil" size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
});

const ItineraryDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { itineraryId } = route.params;
  const [imageUrl, setImageUrl] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'overview', title: 'Overview' },
    { key: 'days', title: 'Days' }
  ]);

  const [itinerary, setItinerary] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]);
  const dayHeightsRef = useRef({});

  // Modal and Calendar state for Add/Edit day
  const [modalVisible, setModalVisible] = useState(false);
  const [dayTitle, setDayTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [owner, setOwner] = useState({ name: "", email: "" });
  const [editingDayId, setEditingDayId] = useState(null);

  // To view collaborators
  const [collaborators, setCollaborators] = useState([]);

  const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
  const [notesPreview, setNotesPreview] = useState('');
  const [isPlacesModalVisible, setIsPlacesModalVisible] = useState(false);
  const [placesList, setPlacesList] = useState([]);
  const [totalItineraryCost, setTotalItineraryCost] = useState(0);
  const [isOtherCostsModalVisible, setIsOtherCostsModalVisible] = useState(false);
  const [otherCosts, setOtherCosts] = useState([]);



  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error("Error retrieving user:", error);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!isNotesModalVisible) {
      const notesRef = database().ref(`/live_itineraries/${itineraryId}/notes`);
  
      notesRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
          setNotesPreview(snapshot.val().length > 300 
            ? snapshot.val().substring(0, 300) + '... Click to view more' 
            : snapshot.val());
        } else {
          setNotesPreview("Tap to add notes");
        }
      });
    }
  }, [isNotesModalVisible, itineraryId]);
  
  useEffect(() => {
    if (!isPlacesModalVisible) {
      const placesRef = database().ref(`/live_itineraries/${itineraryId}/places`);
  
      placesRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
          setPlacesList(snapshot.val());
        } else {
          setPlacesList([]);
        }
      });
    }
  }, [isPlacesModalVisible, itineraryId]);    
    

  const requestPhotoLibraryPermission = async () => {
    if (Platform.OS === "ios") {
      const result = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (result === RESULTS.DENIED) {
        const newResult = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
        if (newResult !== RESULTS.GRANTED) {
          Alert.alert("Permission Denied", "Please allow access to photos in settings.");
          return false;
        }
      }
    }
    return true;
  };

  // Crop to 1024x768 (4:3 ratio)
  const selectImage = async () => {
    const hasPermission = await requestPhotoLibraryPermission();
    if (!hasPermission) return;
    
    try {
      const image = await ImagePicker.openPicker({
        width: 1024,
        height: 768,
        cropping: true,
        compressImageQuality: 0.8,
      });
      if (image && image.path) {
        setSelectedImage(image.path);
        uploadImage(image.path);
      }
    } catch (error) {
      if (error.code === 'E_PICKER_CANCELLED') {
      } else {
        Alert.alert("Error", error.message || "Image picker error");
      }
    }
  };

  // Upload image using presigned URL (with itineraryId)
  const uploadImage = async (imageUri) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/generate-presigned-url/?itinerary_id=${itineraryId}`);
      const { presigned_url, image_url } = response.data;
      const imageResponse = await fetch(imageUri);
      const blob = await imageResponse.blob();
      await fetch(presigned_url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });
      setImageUrl(image_url);
    } catch (error) {
      console.error("Upload failed:", error);
      Alert.alert("Error", "Image upload failed.");
    }
  };
  const handleOtherCosts = () => {
    Alert.alert("Other Costs", "This section will track additional expenses.");
  };


  const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const sortActivitiesByTime = (activities) => {
    return activities.sort((a, b) => {
      const parseTime = (time) => {
        const match = time.match(/^(\d+):?(\d*)\s*(AM|PM)$/i);
        if (!match) return 0;
        let hours = parseInt(match[1], 10);
        let minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3].toUpperCase();
        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      return parseTime(a.time) - parseTime(b.time);
    });
  };

  const fetchItineraryDetails = async () => {
    try {
      console.log("Fetching itinerary details...");
      const response = await axios.get(`${API_BASE_URL}/itineraries/${itineraryId}`);
      if (response.status === 200) {
        console.log("✅ API Response:", response.data);

        // ✅ Ensure `estimated_cost` is included and not null
        const sortedDays = response.data.days.map(day => ({
            ...day,
            activities: day.activities
                ? sortActivitiesByTime(
                    day.activities.map(act => ({
                        ...act,
                        estimated_cost: act.estimated_cost ?? 0, 
                    }))
                )
                : []
        }));
        setItinerary(response.data);
        setDays(response.data.days);

        const totalCost = sortedDays.reduce((sum, day) => {
          const dayCost = day.activities.reduce((daySum, activity) => 
              daySum + (activity.estimated_cost ? parseFloat(activity.estimated_cost) : 0)
          , 0);
          return sum + dayCost;
        }, 0);

        setTotalItineraryCost(totalCost);
      
        
        // If extra_data has image_url, extract it.
        if (response.data.extra_data && response.data.extra_data.image_url) {
          setImageUrl(response.data.extra_data.image_url);
        }
        const ownerResponse = await axios.get(`${API_BASE_URL}/users/${response.data.created_by}`);
        if (ownerResponse.status === 200) {
          setOwner({
            name: ownerResponse.data.name,
            email: ownerResponse.data.email
          });
        }
      }
      
    } catch (error) {
      Alert.alert("Error", "Failed to load itinerary details.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchItineraryDetails();
    }, [itineraryId])
  );

  useEffect(() => {
    if (itinerary) {
      const collaboratorRef = database().ref(`/live_itineraries/${itineraryId}/collaborators`);
      const handleCollaboratorChange = async (snapshot) => {
        if (snapshot.exists()) {
          const collabData = snapshot.val();
          const userIds = Object.keys(collabData);
          const userSnapshot = await database().ref('/users').once('value');
          const usersData = userSnapshot.val();
          const collaboratorsList = userIds.map(userId => ({
            userId,
            name: usersData[userId]?.name || "Unknown",
            email: usersData[userId]?.email || "No Email",
          }));
  
          setCollaborators(collaboratorsList);
  
          // ✅ Check if the current user is in the collaborators list
          setIsCollaborator(userIds.includes(user?.id));
        } else {
          setCollaborators([]);
          setIsCollaborator(false); // ✅ Ensure it resets correctly
        }
      };
  
      collaboratorRef.on('value', handleCollaboratorChange);
      return () => {
        collaboratorRef.off('value', handleCollaboratorChange);
      };
    }
  }, [itineraryId, itinerary, user]);
    
  const handleDayPress = useCallback((dayId) => {
    navigation.navigate('ItineraryDay', { itineraryId, dayId });
  }, [itineraryId, navigation]);

  const handleDragEnd = useCallback(async ({ data }) => {
    setDays(data);
    const updatedOrder = data.map((day, index) => ({
      id: day.id,
      order_index: index
    }));
    try {
      await axios.patch(`${API_BASE_URL}/itineraries/${itineraryId}/days/reorder`, { days: updatedOrder });
      console.log("Days reordered successfully!");
    } catch (error) {
      console.error("Error updating order:", error);
      Alert.alert("Error", "Failed to save new order.");
    }
  }, [itineraryId]);

  const renderRightActions = useCallback((dayId) => (
    <TouchableOpacity 
      style={[styles.deleteDayButton, { height: dayHeightsRef.current[dayId] || 80 }]} 
      onPress={() => handleDeleteDay(dayId)}
    >
      <Text style={styles.deleteDayText}>Delete</Text>
    </TouchableOpacity>
  ), [handleDeleteDay]);

  const renderLeftActions = useCallback((dayId) => (
    <TouchableOpacity 
      style={[styles.editDayButton, { height: dayHeightsRef.current[dayId] || 80 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      onPress={() => {
        console.log("Edit pressed for day", dayId);
        handleEditDay(dayId);
      }}
    >
      <Text style={styles.editDayText}>Edit</Text>
    </TouchableOpacity>
  ), [handleEditDay]);

  const handleEditDay = useCallback((dayId) => {
    const dayToEdit = days.find(day => day.id === dayId);
    if (dayToEdit) {
      console.log("Editing day:", dayToEdit);
      setEditingDayId(dayId);
      setDayTitle(dayToEdit.title);
      setSelectedDate(new Date(dayToEdit.date).toISOString().split('T')[0]);
      setTimeout(() => {
        setModalVisible(true);
      }, 100);
    }
  }, [days]);

  const handleDeleteDay = useCallback(async (dayId) => {
    Alert.alert(
      "Delete Day",
      "Are you sure you want to delete this day? All activities will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const config = { headers: { "X-User-Id": user.id } };
              await axios.delete(`${API_BASE_URL}/itineraries/${itineraryId}/days/${dayId}`, config);
              Alert.alert("Success", "Day deleted successfully!");
              fetchItineraryDetails();
            } catch (error) {
              console.error("Error deleting day:", error.response?.data || error.message);
              Alert.alert("Error", "Failed to delete itinerary day.");
            }
          }
        }
      ]
    );
  }, [user, itineraryId]);

  const handleAddDay = async () => {
    if (!dayTitle.trim()) {
      Alert.alert("Missing Field", "Please enter a title for the day.");
      return;
    }
    if (!selectedDate) {
      Alert.alert("Missing Field", "Please select a date.");
      return;
    }
    try {
      const localDate = parseLocalDate(selectedDate);
      const response = await axios.post(
        `${API_BASE_URL}/itineraries/${itineraryId}/days/`,
        {
          date: localDate.toISOString(),
          title: dayTitle,
          itinerary_id: itineraryId,
        },
        {
          headers: {
            "X-User-Id": user.id,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.status === 200) {
        const newDayId = response.data.id;
        setModalVisible(false);
        fetchItineraryDetails();
        navigation.navigate('ItineraryDay', { itineraryId, dayId: newDayId, user });
      }
    } catch (error) {
      console.error("Error adding day:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to add itinerary day.");
    }
  };

  const handleUpdateDay = async () => {
    if (!dayTitle.trim()) {
      Alert.alert("Missing Field", "Please enter a title for the day.");
      return;
    }
    if (!selectedDate) {
      Alert.alert("Missing Field", "Please select a date.");
      return;
    }
    try {
      const localDate = parseLocalDate(selectedDate);
      const requestData = {
        date: localDate.toISOString(),
        title: dayTitle,
        itinerary_id: itineraryId,
      };
      const config = {
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
      };
      const response = await axios.put(
        `${API_BASE_URL}/itineraries/${itineraryId}/days/${editingDayId}`,
        requestData,
        config
      );
      if (response.status === 200) {
        Alert.alert("Success", "Day updated successfully!");
        setModalVisible(false);
        setEditingDayId(null);
        fetchItineraryDetails();
      }
    } catch (error) {
      console.error("Error updating day:", error.response?.data || error.message);
      Alert.alert("Error", "Failed to update itinerary day.");
    }
  };

  // OverviewRoute: if an image exists, use ImageBackground with overlay and white text/icon.
  const OverviewRoute = () => (
    <ScrollView style={styles.scrollContainer}>
        <View style={styles.overviewContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#007bff" />
          ) : (
            <>
              {selectedImage || imageUrl ? (
                <ImageBackground 
                  source={{ uri: selectedImage || imageUrl }} 
                  style={styles.overviewHeader} 
                  imageStyle={styles.backgroundImage}
                >
                  <View style={styles.overlay} />
                  <TouchableOpacity 
                    style={styles.cameraButton} 
                    onPress={selectImage}
                    activeOpacity={0.7}
                  >
                    <Icon name="camera" size={16} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.headerContent}>
                    <Text style={[styles.overviewTitle, { color: '#fff' }]}>{itinerary?.name}</Text>
                    <View style={styles.destinationContainer}>
                    <FontAwesome5 name="map-marker-alt" size={16} color="#fff" style={styles.locationIcon} />
                    <Text style={[styles.overviewSubtitle, { color: '#fff' }]}>{itinerary?.destination}</Text>
                    </View>

                    {/* <Text style={[styles.overviewSubtitle, { color: '#fff' }]}>{itinerary?.destination}</Text> */}
                    <Text style={[styles.overviewDates, { color: '#fff' }]}> 
                      {new Date(itinerary.start_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })} - {new Date(itinerary.end_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </ImageBackground>
              ) : (
                <View style={styles.overviewHeader}>
                  <TouchableOpacity 
                    style={styles.cameraButton} 
                    onPress={selectImage}
                    activeOpacity={0.7}
                  >
                    <Icon name="camera" size={24} color="#007bff" />
                  </TouchableOpacity>
                  <Text style={styles.overviewTitle}>{itinerary?.name}</Text>
                  <Text style={styles.overviewSubtitle}>{itinerary?.destination}</Text>
                  <Text style={styles.overviewDates}>
                    {new Date(itinerary.start_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })} - {new Date(itinerary.end_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              )}

              <View style={styles.overviewCollaborators}>
              <View style={styles.collaboratorsHeader}>
              <Text style={styles.overviewSectionTitle}>Collaborators</Text>
                {user?.id === itinerary?.created_by && (
                  <TouchableOpacity onPress={() => navigation.navigate('InviteCollaborators', { itinerary })}>
                    <FontAwesome5 name="pencil-alt" size={14} color="#007bff" style={styles.collaboratorEditIcon} />
                  </TouchableOpacity>
                )}
              </View>
                {collaborators.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collaboratorsList}>
                    {collaborators.map((collab) => (
                      <View key={collab.userId} style={styles.collaboratorCard}>
                        <Icon name="user" size={16} color="#007bff" style={styles.collaboratorIcon} />
                        <Text style={styles.collaboratorName}>{collab.name}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.noCollaboratorsText}>No collaborators yet.</Text>
                )}
              </View>

              <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  contentContainerStyle={styles.budgetContainer}
              >
                  <View style={styles.squarePanel}>
                      <Text style={styles.panelTitle}>Budget</Text>
                      <Text style={styles.panelValue}>
                          {itinerary?.budget ? `$${itinerary.budget.toLocaleString()}` : 'N/A'}
                      </Text>
                  </View>

                  <View style={styles.squarePanel}>
                      <Text style={styles.panelTitle}>Activities Cost</Text>
                      <Text style={styles.panelValue}>
                          {totalItineraryCost ? `$${totalItineraryCost.toLocaleString()}` : 'N/A'}
                      </Text>
                  </View>

                  {/* ✅ "Other Costs" Panel */}
                  <TouchableOpacity style={styles.squarePanel} onPress={() => setIsOtherCostsModalVisible(true)}>
                    <Text style={styles.panelTitle}>Other Costs</Text>
                    <Text style={styles.panelValue}>
                        {otherCosts.length > 0 
                            ? `$${otherCosts.reduce((sum, cost) => sum + parseFloat(cost.amount), 0).toLocaleString()}`
                            : 'N/A'}
                    </Text>
                  </TouchableOpacity>
              </ScrollView>

              <View style={styles.notesContainer}>
                <TouchableOpacity 
                  style={styles.notesPanel} 
                  onPress={() => setIsNotesModalVisible(true)}
                  activeOpacity={1} 
                >
                  <Text style={styles.panelTitle}>Notes</Text>

                  {/* Scrollable Preview Below Title */}
                  <ScrollView 
                    style={styles.notesScroll} 
                    nestedScrollEnabled={true} 
                    keyboardShouldPersistTaps="handled"
                  >
                    {notesPreview.trim() ? (
                      <Text style={styles.notesPreview}>{notesPreview}</Text>
                    ) : (
                      <Text style={styles.notesPlaceholder}>Tap to add notes</Text>
                    )}
                  </ScrollView>

                </TouchableOpacity>
              </View>

              <View style={styles.placesContainer}>
                <TouchableOpacity style={styles.placesPanel} onPress={() => setIsPlacesModalVisible(true)}>
                  {/* Title Positioned at the Top */}
                  <Text style={styles.placesTitle}>Places to Visit</Text>

                  {/* Content Wrapper to Ensure List is Below Title */}
                  <View style={styles.placesList}>
                    {placesList.length > 0 ? (
                      placesList.map((place, index) => (
                        <Text key={index} style={styles.placesItem}>• {place}</Text>
                      ))
                    ) : (
                      <Text style={styles.placesPlaceholder}>Tap to add places</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

            </>
          )}
        </View>
      </ScrollView>
  );
        
  const DaysRoute = () => (
    <View style={{ flex: 1, padding: 10 }}>
      {days.length === 0 ? (
        <>
          <Text style={styles.noDaysText}>No days planned yet.</Text>
          <TouchableOpacity
            style={styles.addDayButton}
            onPress={() => {
              setEditingDayId(null);
              setDayTitle('');
              setSelectedDate(new Date().toISOString().split('T')[0]);
              setModalVisible(true);
            }}
          >
            <Text style={styles.addDayButtonText}>+ Add Day</Text>
          </TouchableOpacity>
        </>
      ) : (
        <DraggableFlatList
          data={days}
          keyExtractor={(item) => item.id}
          renderItem={({ item, drag }) => (
            <DayCard
              item={item}
              onPress={handleDayPress}
              onLongPress={drag}
              onEdit={handleEditDay}
              renderRightActions={renderRightActions}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                dayHeightsRef.current[item.id] = height;
              }}
            />
          )}
          onDragEnd={handleDragEnd}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addDayButton}
              onPress={() => {
                setEditingDayId(null);
                setDayTitle('');
                setSelectedDate(new Date().toISOString().split('T')[0]);
                setModalVisible(true);
              }}
            >
              <Text style={styles.addDayButtonText}>+ Add Day</Text>
            </TouchableOpacity>
          }
        />
      )}
    </View>
  );
  
  const renderScene = SceneMap({
    overview: OverviewRoute,
    days: DaysRoute,
  });

  const handleDelete = async () => {
    Alert.alert(
      "Delete Itinerary",
      "Are you sure you want to delete this itinerary? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const config = { headers: { "X-User-Id": user.id } };
              await axios.delete(`${API_BASE_URL}/itineraries/${itineraryId}`, config);
              navigation.navigate("Itinerary");
            } catch (error) {
              console.error("Error deleting itinerary:", error.response?.data || error.message);
              Alert.alert("Error", "Failed to delete itinerary.");
            }
          }
        }
      ]
    );
  };

  const handleRemoveMyself = async () => {
    Alert.alert(
      "Leave Itinerary",
      "Are you sure you want to remove yourself from this itinerary? You will lose access.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await database().ref(`/live_itineraries/${itineraryId}/collaborators/${user.id}`).remove();
              console.log(`User ${user.id} removed from itinerary ${itineraryId}`);
              navigation.navigate('Itinerary');
            } catch (error) {
              console.error("Error removing user:", error);
              Alert.alert("Error", "Failed to remove yourself from the itinerary.");
            }
          }
        }
      ]
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaWrapper>
        <OtherCostsModal
            visible={isOtherCostsModalVisible}
            onClose={() => setIsOtherCostsModalVisible(false)}
            otherCosts={otherCosts} 
            setOtherCosts={setOtherCosts} 
        />
        <NotesModal
          visible={isNotesModalVisible}
          onClose={() => setIsNotesModalVisible(false)}
          itineraryId={itineraryId}
        />
        <PlacesModal
          visible={isPlacesModalVisible}
          onClose={() => setIsPlacesModalVisible(false)}
          itineraryId={itineraryId} // ✅ Pass itineraryId as a prop
        />
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: 360 }}
          renderTabBar={props => (
            <TabBar
              {...props}
              indicatorStyle={{
                height: 4,
                backgroundColor: '#1d3a8a',
                borderRadius: 2,
              }}
              style={{ backgroundColor: 'white', elevation: 0 }}
              labelStyle={{
                fontSize: 16,
                fontWeight: 'bold',
                textTransform: 'capitalize',
              }}
              activeColor="black"
              inactiveColor="gray"
            />
          )}
        />

        {modalVisible && (
          <Modal
            transparent
            animationType="slide"
            onRequestClose={() => {
              setModalVisible(false);
              setEditingDayId(null);
            }}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{editingDayId ? 'Edit Day' : 'Add a New Day'}</Text>
                <TextInput
                  placeholder="Enter day title"
                  style={styles.input}
                  value={dayTitle}
                  onChangeText={setDayTitle}
                />
                <TouchableOpacity style={styles.datePicker} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateText}>
                    {selectedDate ? parseLocalDate(selectedDate).toDateString() : "Select Date"}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <View style={styles.calendarContainer}>
                    <Calendar
                      onDayPress={(day) => {
                        setSelectedDate(day.dateString);
                        setShowDatePicker(false);
                      }}
                      markedDates={{
                        [selectedDate]: { selected: true, selectedColor: '#007bff' },
                      }}
                      theme={{
                        selectedDayBackgroundColor: '#007bff',
                        todayTextColor: '#F82E08',
                        arrowColor: '#007bff',
                      }}
                    />
                  </View>
                )}
                <Pressable style={styles.modalButton} onPress={editingDayId ? handleUpdateDay : handleAddDay}>
                  <Text style={styles.modalButtonText}>{editingDayId ? "Update Day" : "Add Day"}</Text>
                </Pressable>
                <Pressable style={[styles.modalButton, { backgroundColor: 'gray' }]} onPress={() => {
                  setModalVisible(false);
                  setEditingDayId(null);
                }}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('ItineraryForm', { itineraryId: itinerary.id, userId: itinerary.created_by })}
          >
            <Text style={styles.buttonText}>Edit</Text>
          </TouchableOpacity>
          {isCollaborator && user?.id !== itinerary?.created_by ? (
            <TouchableOpacity style={styles.removeButton} onPress={handleRemoveMyself}>
              <Text style={styles.buttonText}>Remove</Text>
            </TouchableOpacity>
          ) : (
            user?.id === itinerary?.created_by && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.buttonText}><Icon name="trash" size={20} color="white" /></Text>
              </TouchableOpacity>
            )
          )}
        </View>
        
      </SafeAreaWrapper>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginHorizontal: 10
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  detail: { fontSize: 14, marginBottom: 5, color: '#333' },
  listContainer: { flex: 1, paddingHorizontal: 8 },
  daysContainer: { flexGrow: 1, paddingBottom: 80 },
  dayCard: { 
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dayTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  dayDate: { fontSize: 14, color: '#555', marginBottom: 10 },
  deleteDayButton: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 8,
    marginLeft: 10,
  },
  totalCostText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 5,
  },
  deleteDayText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  activityCard: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
    borderLeftWidth: 5,
    borderLeftColor: '#007bff',
    width: '100%',
    alignSelf: 'center',
  },
  activityTime: { fontSize: 14, fontWeight: 'bold', color: '#007bff' },
  activityName: { fontSize: 16, fontWeight: '600', color: '#222' },
  activityLocation: { fontSize: 14, color: '#555' },
  noActivities: { fontSize: 14, color: '#888', fontStyle: 'italic' },
  noDaysText: { fontSize: 14, textAlign: 'center', color: '#888' },
  buttonContainer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    padding: 10, 
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  editButton: { 
    flex: 0.8, 
    padding: 15, 
    backgroundColor: '#007bff', 
    borderRadius: 8, 
    alignItems: 'center', 
    marginRight: 5,
  },
  deleteButton: {
    flex: 0.2,
    padding: 15,
    backgroundColor: 'red',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  buttonText: { color: '#fff', fontSize: 14 },
  addDayButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  addDayButtonText: { color: '#fff', fontSize: 14 },
  editDayButton: {
    backgroundColor: 'green',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 8,
    marginRight: 10,
  },
  editDayText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  inviteButton: {
    flex: 0.6,
    padding: 15,
    backgroundColor: '#28a745',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 5,
  },
  removeButton: {
    flex: 0.8,
    padding: 15,
    backgroundColor: 'gray',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    textAlign: 'center',
  },
  datePicker: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  dateText: { fontSize: 16, color: '#333' },
  calendarContainer: { marginBottom: 10 },
  modalButton: {
    width: '100%',
    padding: 12,
    backgroundColor: '#007bff',
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  editIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'green',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  overviewContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingBottom: 80,
  },
  // Fixed header size for a nice background look
  overviewHeader: {
    width: '100%',
    height: 250, 
    borderRadius: 0, 
    padding: 0, 
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: '100%', 
    resizeMode: 'cover', 
  },
  // Transparent black overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  // Header content container to ensure text/icon is above overlay
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  uploadIconContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 10,
  },
  overviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 8,
    textAlign: 'center',
  },
  overviewSubtitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  destinationContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
  },
  locationIcon: {
    marginRight: 5, 
    alignSelf: 'center',
    marginBottom: 8,
  },  
  overviewDates: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  overviewCollaborators: {
    marginTop: 10,
    paddingHorizontal: 10
  },
  collaboratorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaboratorEditContainer: {
    flexDirection: 'row',
    alignItems: 'center', 
  },
  overviewSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 10,
  },
  collaboratorEditIcon: {
    marginLeft: 10,
    alignSelf: 'center',
    marginBottom: 10
  },

  collaboratorsList: {
    flexDirection: 'row', 
    alignItems: 'center',
  },
  collaboratorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef7ff',
    padding: 8,
    borderRadius: 5,
    marginRight: 10,
    marginBottom: 10,
    minWidth: 100,
    justifyContent: 'center'
  },
  collaboratorIcon: {
    marginRight: 5,
  },
  collaboratorName: {
    fontSize: 12,
    color: '#007bff',
  },
  noCollaboratorsText: {
    fontSize: 16,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  cameraButton: { 
    position: 'absolute', 
    top: 10, 
    right: 10, 
    padding: 10,
    zIndex: 3 
  },
  imagePreview: { width: 200, height: 200, borderRadius: 10, marginBottom: 15 },
  placeholderImage: {
    width: 200, 
    height: 200, 
    backgroundColor: '#ddd', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 10
  },

  // BUDGET CONTAINER
  budgetContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10,
    marginLeft: 10
  },
  squarePanel: {
    width: 175, // ✅ Ensures uniform size for horizontal scrolling
    aspectRatio: 2.1,
    backgroundColor: '#eef7ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    padding: 10,
    marginRight: 10, // ✅ Adds space between panels
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  panelTitle: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  panelValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },

  scrollContainer: {
    flex: 1
  },

  notesContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  
  notesPanel: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    paddingTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    minHeight: 96, 
    maxHeight: 200, 
    overflow: 'hidden', 
    position: 'relative', 
  },
  
  notesScroll: {
    flexGrow: 1, 
    maxHeight: 180,
    marginTop: 30,
    width: '100%', 
  },
  
  notesPreview: {
    fontSize: 14,
    color: '#555',
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  notesPlaceholder: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  
  
  placesContainer: {
    marginTop: 20,
    paddingHorizontal: 10,
    minHeight: 96
  },

  placesPanel: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    minHeight: 50,
    flexGrow: 1, 
  },

  placesTitle: {
    fontSize: 16,
    color: '#007bff',
    marginBottom: 5,
  },

  placesList: {
    width: '100%',
    paddingTop: 5, 
  },

  placesItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 3, 
  },

  placesPlaceholder: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },

  
      
  
});

export default ItineraryDetailScreen;
