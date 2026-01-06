import {View,Text,Image,TouchableOpacity,StyleSheet,ActivityIndicator,} from "react-native";
import React, { useState, useEffect } from 'react'
import circle from "../assets/sos.png"
import * as Font from "expo-font";
import { Audio } from 'expo-av';
import audio from "../assets/eas.mp3"
import { useNavigation } from '@react-navigation/native';
import * as Battery from "expo-battery";
import * as Network from "expo-network";
import * as Location from "expo-location";
import * as Linking from "expo-linking";


const Body = ({ handleChange }) => {
    const [fontsLoaded, setFontsLoaded] = useState(false);
    const [sound, setSound] = useState(null)
    const navigation = useNavigation();

    const playSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(audio)
            setSound(sound)

            await sound.playAsync()
        } catch (error) {
            console.log(error)
        }
    }

    const stopSound = async () => {
        if (sound) {
            await sound.stopAsync();
        }
    };

    // const onSOS = () => {
    //     const phn = "tel:112"

    //     Linking.openURL(phn)
    // }

    useEffect(() => {
        async function loadFonts() {
            await Font.loadAsync({
                "Poppins": require("../assets/fonts/Poppins-Regular.ttf"),
                "Kanit": require("../assets/fonts/Kanit-Bold.ttf"),
            });
            setFontsLoaded(true);
        }

        loadFonts();
    }, []);

    if (!fontsLoaded) {
        return <ActivityIndicator size="large" style={s.loader} />;
    }




// ✅ ADD FUNCTIONS HERE (STEP 3)
const getSOSDetails = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission not granted");
  }

  const location = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = location.coords;

  const batteryLevel = await Battery.getBatteryLevelAsync();
  const batteryPercent = Math.round(batteryLevel * 100);

  const networkState = await Network.getNetworkStateAsync();

  return {
    latitude,
    longitude,
    batteryPercent,
    networkType: networkState.type,
    isConnected: networkState.isConnected,
  };
};

const createSOSMessage = (data) => {
  return `
🚨 RAKSHANET SOS 🚨

📍 Location:
https://maps.google.com/?q=${data.latitude},${data.longitude}

🔋 Battery: ${data.batteryPercent}%
📶 Network: ${data.networkType}

⏰ ${new Date().toLocaleString()}
`;
};

const sendSOS = async () => {
  try {
    const data = await getSOSDetails();
    const message = createSOSMessage(data);

    const phoneNumber = "91XXXXXXXXXX"; // replace with real number
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      alert("WhatsApp is not installed on this device");
    }
  } catch (err) {
    console.log("SOS failed:", err.message);
  }
};


    return (
        <View style={s.container}>
            <View style={s.c1}>
                <View style={s.r1}>
                    <Text style={s.title}>Are you in an Emergency?</Text>
                    <Text style={s.desc}>Press the SOS button we are here to help you!</Text>
                </View>
            </View>
            <View style={s.c2}>
                <TouchableOpacity
                    style={s.btn}
                    onPress={async () => {
                        playSound();
                        handleChange(true);

                        await sendSOS();   // 🔥 THIS WAS MISSING

                        setTimeout(() => {
                        handleChange(false);
                        stopSound();
                        navigation.navigate('Location');
                        }, 5000);
                    }}
                    >

                    <Image source={circle} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    {/* <View style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',position:'absolute'}}>
                        <FontAwesome name="bell" size={24} color="white" />
                        <Text style={s.sos}>SOS</Text>
                    </View> */}
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default Body

const s = StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    c1: {
        width: "100%",
        height: '30%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    c2: {
        width: "100%",
        height: '70%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    r1: {
        width: "100%",
        height: '100%',
        justifyContent: 'center',
        backgroundColor:'rgba(215, 210, 210, 0.97)',
        borderRadius:20,
        padding:20
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        fontFamily: 'Kanit'
    },
    desc: {
        fontSize: 16,
        fontFamily: 'Poppins'
    },
    sos: {
        position: 'absolute',
        fontWeight: 'bold',
        fontSize: 80,
        color: 'white',
        fontFamily: 'Kanit'
    },
    btn: {
        width: "100%",
        height: "100%",
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    loader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
})