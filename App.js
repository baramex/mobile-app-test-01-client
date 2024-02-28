import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReactNativeModal from 'react-native-modal';
import { Button, TextInput } from 'react-native-web';
import { io } from 'socket.io-client';

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

            <ConnectToClient socket={socket} />

            <StatusBar style="auto" />
        </View>
    );
}

function ConnectToClient({ socket }) {
    const [socketId, setSocketId] = useState('');
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [requested, setRequested] = useState(false);
    const [error, setError] = useState(null);
    const [request, setRequest] = useState(null);

    useEffect(() => {
        if (!socket) return;

        socket.on("connectionRequested", (data) => {
            console.log('Connection requested', data);
            setConnecting(false);
            setRequested(true);
            setConnected(false);
            setError(null);
        });
        socket.on("connectionCreated", (data) => {
            console.log('Connection created', data);
            setRequested(false);
            setConnected(data);
            setConnecting(false);
            setError(null);
        });
        socket.on("connectionRejected", (error) => {
            console.log('Connection error', error);
            setRequested(false);
            setConnecting(false);
            setError(error.message);
            setConnected(false);
        });
        socket.on("connectionRequest", data => {
            setRequest(data);
        });

        return () => {
            socket.off("connectionRequested");
            socket.off("connectionCreated");
            socket.off("connectionRejected");
            socket.off("connectionRequest");
        }
    }, [socket]);

    return <View>
        <Text>Share live location to another client</Text>
        <View>
            {connected ? <Text>Connected to {connected.id}</Text> : <>
                <TextInput disabled={connected || connecting || requested} placeholder="Socket ID" value={socketId} onChangeText={setSocketId} />
                <Button disabled={connected || connecting || requested} onPress={() => { setConnected(true); createConnection(socketId, socket); }} title="Start sharing" />
            </>}
            {error ? <Text>{error}</Text> : null}
            {connecting ? <Text>Connecting...</Text> : null}
            {requested ? <Text>Connection requested, awaiting reply...</Text> : null
            }<ReactNativeModal
                isVisible={!!request}>
                <View>
                    <Text>Request from {request?.id}</Text>
                    <Button title="Accept" onPress={() => { acceptConnection(request?.id, socket); setRequest(null); }} />
                    <Button title="Reject" onPress={() => { rejectConnection(request?.id, socket); setRequest(null); }} />
                    <View style={{ marginTop: 150 }}>
                        <Button title="Hide modal" onPress={setRequest} />
                    </View>
                </View>
            </ReactNativeModal>
        </View>
    </View>
}

function createConnection(socketId, socket) {
    socket.emit('createConnection', { id: socketId });
}

function acceptConnection(socketId, socket) {
    socket.emit('acceptConnection', { id: socketId });
}

function rejectConnection(socketId, socket) {
    socket.emit('rejectConnection', { id: socketId });
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
