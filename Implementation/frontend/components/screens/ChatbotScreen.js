import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Image, Platform } from "react-native";
import axios from "axios";
import styles from "../../styles/ChatbotScreenStyles";
import API_BASE_URL from "../../config";  
import SafeAreaWrapper from "./SafeAreaWrapper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MarkdownDisplay from "react-native-markdown-display";
import database from '@react-native-firebase/database'; 

const ChatbotScreen = () => {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  //const [messages, setMessages] = useState([{role: "assistant", content: "Hi! My name is WayPointer, your personal travel assistant! Ask me for recommendations and i'll provide suggestions based on your travel style"}]);
  const [input, setInput] = useState("");
  const [travelStyle, setTravelStyle] = useState(null);
  const [isTyping, setIsTyping] = useState(false); // Track when bot is typing
  const [typingDots, setTypingDots] = useState("");
  const inputRef = useRef(null);
  const [profileImage, setProfileImage] = useState(null);


  // ✅ Fetch User & Travel Style on Component Mount
  useEffect(() => {
    const fetchUserTravelStyle = async () => {
      try {
        console.log("🔄 Fetching user data from AsyncStorage...");
        const storedUser = await AsyncStorage.getItem("user");

        const storedImage = await AsyncStorage.getItem('profileImage');
          if (storedImage) {
              setProfileImage(storedImage);
          }
  
        if (!storedUser) {
          console.error("❌ No user found in AsyncStorage!");
          setTravelStyle("general");
          return;
        }
  
        const userData = JSON.parse(storedUser);
        setUser(userData);
        console.log("📥 Retrieved Travel Style ID:", userData.travel_style_id);
  
        if (userData.travel_style_id && userData.travel_style_id !== 4) {
          await fetchTravelStyle(userData.travel_style_id);
        } else {
          setTravelStyle("general");
        }
      } catch (error) {
        console.error("❌ Error loading user data:", error);
        setTravelStyle("general");
      }
    };
  
    fetchUserTravelStyle();
  }, []);
  
  useEffect(() => {
    if (!isTyping) return;

    const interval = setInterval(() => {
      setTypingDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500); // Updates every 500ms

    return () => clearInterval(interval);
  }, [isTyping]);

  // Delayed Initial Message
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages([
        { role: "assistant", content: "Hi! My name is WayPointer, your personal travel assistant! Ask me for recommendations and I'll provide suggestions based on your travel style." }
      ]);
    }, 1000);

    return () => clearTimeout(timer); // Cleanup timeout if component unmounts
  }, []);

  // ✅ Fetch Travel Style Name from Backend
  const fetchTravelStyle = async (travelStyleId) => {
    try {
      console.log(`🔄 Fetching travel style details for ID: ${travelStyleId}`);
      const response = await axios.get(`${API_BASE_URL}/travel-styles/${travelStyleId}`);

      if (response.status === 200 && response.data) {
        console.log("✅ Travel Style Retrieved:", response.data.name);
        setTravelStyle(response.data.name.toLowerCase()); // Ensure lowercase for API
      } else {
        console.warn("⚠️ Travel Style API response missing data.");
        setTravelStyle("general");
      }
    } catch (error) {
      console.error("❌ Error fetching travel style:", error.response?.data || error.message);
      setTravelStyle("general");
    }
  };

  const sendMessage = async () => {
    if (!input || !input.trim()) return; //checking for null, undefined and empty string or empty result

    if (!travelStyle) {
      console.log("⚠️ Travel style not ready yet, waiting...");
      return;
    }

    const userMessage = { role: "user", content: input };
    if (user?.id) {
      const usedChatRef = database().ref(`/users/${user.id}/onboarding/used_chat`);
      usedChatRef.set(true);
    }
    setMessages((prevMessages) => [
      { role: "assistant", content: "..." }, // typing indicator
      userMessage,
      ...prevMessages
    ]);
    
    setInput("");

    if (inputRef.current) {
      inputRef.current.clear();
    }

    // Show animated ellipses while waiting for response
    setIsTyping(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/chatbot/`, { user_message: input, travel_style: travelStyle });

      setIsTyping(false); // Stop typing indicator

      const botReply = { role: "assistant", content: response.data.response };
      setMessages((prevMessages) => [botReply, ...prevMessages.filter(msg => msg.content !== "...")]); // Remove typing indicator
    } catch (error) {
      console.error("Chatbot API Error:", error);
      setIsTyping(false);
      setMessages((prevMessages) => [
        { role: "assistant", content: "Sorry, I couldn't process that request." },
        ...prevMessages.filter(msg => msg.content !== "...")
      ]);
    }
  };

  return (
    //prevents keyboard from covering the input field on ios
    <SafeAreaWrapper>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>WayPointer</Text>
            <Text style={styles.headerAvatar}>💬</Text>
          </View>

          {/* Chat Display */}
          <FlatList
            data={messages} //messages array to display a chat history
            keyExtractor={(item, index) => index.toString()} //each message has a unique key
            renderItem={({ item }) => (
              <View style={[styles.messageContainer, item.role === "user" ? styles.userMessageContainer : styles.botMessageContainer]}>

                {/* Chatbot Avatar */}
                {item.role === "assistant" && (
                  <Image source={require("../../assets/images/chatbot.png")} style={styles.botAvatar} />
                )}

                {/* User Message */}
                {item.role === "user" && (
                <>
                  <View style={item.role === "user" ? styles.userMessage : styles.botMessage}>
                    <Text style={[styles.messageText, item.role === "user" ? { color: "#fff" } : { color: "#000" }]}>
                      {item.content === "..." ? typingDots : item.content}
                    </Text>
                  </View>
                  <Image
                    source={profileImage ? { uri: profileImage } : require("../../assets/images/woman.png")}
                    style={styles.userAvatar}
                  />
                </>
              )}


                {/* Bot Message */}
                {item.role === "assistant" && (
                  <View style={styles.botMessage}>
                    <MarkdownDisplay style={styles.messageText}>{item.content === "..." ? typingDots : item.content}</MarkdownDisplay>
                  </View>
                )}

              </View>
            )}
            inverted
          />

          {/* Input Field & Send Button */}
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Ask about travel..."
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendMessage} //submits when enter is pressed
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
};

export default ChatbotScreen;
