import { createStackNavigator } from '@react-navigation/stack';
import ProfileScreen from './ProfileScreen';


const Stack = createStackNavigator();

export default function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerTitle: 'My Profile' }}
      />
    </Stack.Navigator>
  );
}
