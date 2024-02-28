import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReactNativeModal from 'react-native-modal';
import { Button, TextInput } from 'react-native-web';
import { io } from 'socket.io-client';
import * as Location from 'expo-location';

export default function App() {
    const [connected, setConnected] = useState(null);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const newSocket = io('http://localhost:3000');
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to the server');
            setConnected(true);
        });

        newSocket.on("disconnect", () => {
            console.log('Disconnected from the server');
            setConnected(false);
        });

        return () => newSocket.close() && setSocket(null);
    }, []);

    return (
        <View style={styles.container}>
            <Text>{connected !== null ? connected ? "Connected to the server" : "Disconnected from the server" : "Connecting to the server..."}</Text>
            {socket?.id ? <Text>{socket.id}</Text> : null}

            {connected && socket ? <ConnectToClient socket={socket} /> : null}

            <StatusBar style="auto" />
        </View>
    );
}

function ConnectToClient({ socket }) {
    const [state, setState] = useState('idle');
    const [error, setError] = useState(null);
    const [socketId, setSocketId] = useState('');
    const [locationStatus, requestPermission] = Location.useForegroundPermissions();
    const [location, setLocation] = useState(null);

    useEffect(() => {
        socket.on("connectionRequested", (data) => {
            console.log('Connection requested', data);
            setState('awaiting');
        });
        socket.on("connectionCreated", (data) => {
            console.log('Connection created', data);
            setState('connected');
            setError(null);
        });
        socket.on("connectionRejected", (error) => {
            console.log('Connection error', error);
            setState('idle');
            setError(error.message);
            setSocketId('');
        });
        socket.on("connectionRequest", data => {
            setState('requested');
            setSocketId(data.id);
        });
        socket.on("location", data => {
            console.log('Location received', data);
            setLocation(data.location);
        });

        return () => {
            socket.off("connectionRequested");
            socket.off("connectionCreated");
            socket.off("connectionRejected");
            socket.off("connectionRequest");
        }
    }, [socket]);

    useEffect(() => {
        if (state === "connected" && socketId) {
            let interval = setInterval(async () => {
                const location = await Location.getLastKnownPositionAsync() || await Location.getCurrentPositionAsync();
                console.log('Sending location', location);
                socket.emit('location', { id: socketId, location });
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [state, socketId]);

    async function checkLocationPermission() {
        if (locationStatus.status === 'granted') {
            return true;
        }
        const { status } = await requestPermission();
        return status === 'granted';
    }

    async function request() {
        if (!await checkLocationPermission()) {
            setError('Location permission is required');
            return;
        }
        setState('requesting');
        setSocketId(socketId);
        setError(null);
        socket.emit('createConnection', { id: socketId });
    }

    async function accept() {
        if (!await checkLocationPermission()) {
            setError('Location permission is required');
            return;
        }
        socket.emit('acceptConnection', { id: socketId });
    }

    function reject() {
        setSocketId('');
        setState('idle');
        socket.emit('rejectConnection', { id: socketId });
    }

    return <View>
        <View>
            {state === "connected" ? <Text>Connected to {socketId}</Text> : <>
                <Text>Share live location to another client</Text>
                <TextInput disabled={state !== "idle"} placeholder="Socket ID" value={socketId} onChangeText={setSocketId} />
                <Button disabled={state !== "idle"} onPress={request} title="Start sharing" />
            </>}
            {error ? <Text>{error}</Text> : null}
            {state === "requesting" ? <Text>Connection request sent...</Text> : null}
            {state === "awaiting" ? <Text>Connection requested, awaiting reply...</Text> : null}
            {state === "connected" && location ? <Text>
                Latitude: {location.coords.latitude}<br />
                Longitude: {location.coords.longitude}
            </Text> : null}
            <ReactNativeModal
                isVisible={state === "requested"}>
                <View>
                    <Text>Request from {socketId}</Text>
                    <Button title="Accept" onPress={accept} />
                    <Button title="Reject" onPress={reject} />
                    <View style={{ marginTop: 150 }}>
                        <Button title="Hide modal" onPress={reject} />
                    </View>
                </View>
            </ReactNativeModal>
        </View>
    </View>
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
