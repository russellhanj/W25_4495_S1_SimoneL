import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Image, FlatList, Modal, TouchableOpacity } from 'react-native';
import { database } from '../../firebase';        // Make sure this matches your Firebase import
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../../styles/AchievementScreenStyles'
import SafeAreaWrapper from './SafeAreaWrapper';
import * as Progress from 'react-native-progress';
import { Dimensions } from 'react-native';

const trophyImages = {
    park: {
        Bronze: require('../../assets/achievements/park/bronze_park.png'),
        Silver: require('../../assets/achievements/park/silver_park.jpeg'),
        Gold: require('../../assets/achievements/park/gold_park.jpeg'),
    },
    bar: {
        Bronze: require('../../assets/achievements/bar/bronze_bar.jpeg'),
        Silver: require('../../assets/achievements/bar/silver_bar.png'),
        Gold: require('../../assets/achievements/bar/gold_bar.jpeg'),
    },
    museum: {
        Bronze: require('../../assets/achievements/museum/bronze_museum.jpeg'),
        Silver: require('../../assets/achievements/museum/silver_museum.jpeg'),
        Gold: require('../../assets/achievements/museum/gold_museum.jpeg'),
    },
};
const specialBadges = {
    onboarding: require('../../assets/achievements/badge_onboarding_completed.png'),
};


const ALL_CATEGORIES = ['park', 'bar', 'museum'];

// Helper to determine badge based on check-in count
function getBadge(count) {
    if (count >= 20) return 'Gold';
    if (count >= 10) return 'Silver';
    return 'Bronze';
}

// To return trophy image based on category and badge
function getBadgeImage(category, badge) {
    return trophyImages[category] && trophyImages[category][badge]
        ? trophyImages[category][badge]
        : null;
}

// Calculate progress to next achievement
function getProgress(count) {
    if (count < 5) return count / 5;
    else if (count < 10) return (count - 5) / 5;
    else if (count < 20) return (count - 10) / 10;
    else return 1;
}

function getProgressText(count) {
    if (count < 5) return `${count}/5`;
    else if (count < 10) return `${count - 5}/5`;
    else if (count < 20) return `${count - 10}/10`;
    else return `Achieved`;
}

const AchievementsScreen = () => {
    const [loading, setLoading] = useState(true);
    const [achievements, setAchievements] = useState([]);
    const [error, setError] = useState(null);
    const screenWidth = Dimensions.get('window').width;
    const progressBarWidth = screenWidth * 0.7 - 40;

    // modal
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedAchievement, setSelectedAchievement] = useState(null);
    const [specialAchievement, setSpecialAchievement] = useState(null);


    useEffect(() => {
        fetchAchievements();
    }, []);

    const fetchAchievements = async () => {
        setLoading(true);
        setError(null);

        try {
            // Get the current user from AsyncStorage
            const storedUser = await AsyncStorage.getItem('user');
            if (!storedUser) {
                setError("User not logged in.");
                setLoading(false);
                return;
            }
            const userData = JSON.parse(storedUser);
            const userId = userData.id;

            // Read from Firebase: /game/userId
            const snapshot = await database().ref(`/game/${userId}`).once('value');
            const data = snapshot.val() || {};

            const results = ALL_CATEGORIES.map((category) => {
                const checkInsObj = data[category] || {};
                const checkInCount = Object.keys(checkInsObj).length;
                return {
                    category,
                    count: checkInCount,
                    badge: getBadge(checkInCount),
                };
            });
            // ✅ Check if onboarding is complete
            const onboardingSnap = await database().ref(`/users/${userId}/onboarding/onboarding_complete`).once('value');
            const onboardingComplete = onboardingSnap.val() === true;
            let specialBadge = null;

            // if (onboardingComplete === true) {
            //     const onboardingBadge = {
            //         category: 'onboarding',
            //         count: 1,
            //         badge: 'Completed',
            //         isSpecial: true,
            //     };
            //     results.splice(3, 0, onboardingBadge);
            //   }
            if (onboardingComplete) {
                results.push({
                    category: 'onboarding',
                    count: 1,
                    badge: 'Completed',
                    isSpecial: true,
                });
            }

            // Now sort the results array:
            results.sort((a, b) => {
                // Always show the onboarding badge first.
                if (a.category === 'onboarding' && b.category !== 'onboarding') return -1;
                if (b.category === 'onboarding' && a.category !== 'onboarding') return 1;

                // For non-onboarding achievements, consider complete if count >= 5.
                const aComplete = a.category === 'onboarding' || a.count >= 5;
                const bComplete = b.category === 'onboarding' || b.count >= 5;
                if (aComplete && !bComplete) return -1;
                if (!aComplete && bComplete) return 1;

                // Prioritize badge levels (Completed > Gold > Silver > Bronze)
                const badgePriority = { 'Completed': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
                const aPriority = badgePriority[a.badge] || 0;
                const bPriority = badgePriority[b.badge] || 0;
                if (aPriority !== bPriority) {
                    return bPriority - aPriority;
                }

                // If same level, sort by check-in count (higher count first)
                return b.count - a.count;
            });

            setAchievements(results);
        } catch (err) {
            console.error("Error fetching achievements:", err);
            setError("Failed to fetch achievements.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" />
                <Text>Loading Achievements...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <Text style={{ color: 'red' }}>{error}</Text>
            </View>
        );
    }

    const openModal = async (achievement) => {
        setSelectedAchievement(achievement);
        setModalVisible(true);

        try {
            const storedUser = await AsyncStorage.getItem('user');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                const userId = user.id;
                await database().ref(`/users/${userId}/onboarding/viewed_achievements`).set(true);
            }
        } catch (err) {
            console.error("Error logging viewed achievement:", err);
        }
    };


    const closeModal = () => {
        setModalVisible(false);
        setSelectedAchievement(null);
    };

    // Renders each achievement as a grid item
    const renderAchievementItem = ({ item }) => {
        const isSpecial = item.category === 'onboarding';
        const trophyImage = isSpecial
            ? specialBadges.onboarding
            : getBadgeImage(item.category, item.badge);

        return (
            <TouchableOpacity style={styles.gridItem} onPress={() => openModal(item)}>
                <Image
                    source={trophyImage}
                    style={[
                        styles.badgeImage,
                        !isSpecial && item.count < 5 && { opacity: 0.3 },
                    ]}
                />
                {!isSpecial && (
                    <Progress.Bar
                        progress={getProgress(item.count)}
                        width={null}
                        height={10}
                        borderWidth={0}
                        unfilledColor="#EEE"
                        color="#1E3A8A"
                        style={styles.gridProgressBar}
                    />
                )}
                {isSpecial && (
                    <Text style={{ marginTop: 4, fontSize: 12, color: '#4B5563' }}>Onboarding</Text>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaWrapper>
            <View style={styles.container}>
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Achievements</Text>
                    <View style={styles.borderShadow} />
                </View>

                <FlatList
                    data={achievements}
                    keyExtractor={(item) => item.category}
                    numColumns={3}
                    renderItem={renderAchievementItem}
                    columnWrapperStyle={styles.columnWrapper}
                    contentContainerStyle={styles.gridContainer}
                />


                {/* MODAL: displays when user taps a grid item */}
                <Modal
                    visible={modalVisible}
                    animationType="slide"
                    transparent={true}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            {/* Close button */}
                            <Text
                                style={styles.modalCloseButton}
                                onPress={closeModal}
                            >
                                X
                            </Text>

                            {selectedAchievement && (
                                selectedAchievement.category === 'onboarding' ? (
                                    <>
                                        <Image
                                            source={specialBadges.onboarding}
                                            style={styles.modalTrophyImage}
                                        />
                                        <Text style={styles.modalCategoryText}>Onboarding Completed</Text>
                                        <Text style={styles.modalDescription}>
                                            You completed all checklist tasks and earned this badge!
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Image
                                            source={getBadgeImage(selectedAchievement.category, selectedAchievement.badge)}
                                            style={styles.modalTrophyImage}
                                        />
                                        <Text style={styles.modalCategoryText}>
                                            {selectedAchievement.category.toUpperCase()}
                                        </Text>

                                        <View style={{ marginHorizontal: 20, width: [progressBarWidth], alignItems: 'center' }}>
                                            <Progress.Bar
                                                progress={getProgress(selectedAchievement.count)}
                                                width={progressBarWidth}
                                                borderWidth={0}
                                                borderRadius={0}
                                                unfilledColor="#EEE"
                                                color="#1E3A8A"
                                                style={styles.modalProgressBar}
                                            />
                                        </View>
                                        <Text style={styles.modalProgressText}>
                                            {getProgressText(selectedAchievement.count)} to next tier
                                        </Text>

                                        <Text style={styles.modalDescription}>
                                            Check in at a {selectedAchievement.category} to earn this achievement. 5 = Bronze, 10 = Silver, 20 = Gold.
                                        </Text>

                                        <View style={styles.modalTiersRow}>
                                            <Image
                                                source={getBadgeImage(selectedAchievement.category, 'Bronze')}
                                                style={styles.modalTierIcon}
                                            />
                                            <Image
                                                source={getBadgeImage(selectedAchievement.category, 'Silver')}
                                                style={styles.modalTierIcon}
                                            />
                                            <Image
                                                source={getBadgeImage(selectedAchievement.category, 'Gold')}
                                                style={styles.modalTierIcon}
                                            />
                                        </View>
                                    </>
                                )
                            )}
                        </View>
                    </View>
                </Modal>
            </View>
        </SafeAreaWrapper>
    );
};

export default AchievementsScreen;