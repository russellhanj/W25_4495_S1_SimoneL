/**
 * @format
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App'; // ✅ Correct path to App.js
import { name as appName } from './app.json';


AppRegistry.registerComponent(appName, () => App);
