import { useEffect, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import { baseURL } from "../config/AxiosHelper";
import toast from "react-hot-toast";

export function useWebSocket(roomId, currentUser, connected, onMessage) {
    const [stompClient, setStompClient] = useState(null);
    const [typingUser, setTypingUser] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState({});
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        if (!connected || !roomId) return;

        const socket = new SockJS(`${baseURL}/chat`);
        const client = Stomp.over(socket);
        client.debug = () => {}; // silence logs

        client.connect({}, () => {
            setStompClient(client);
            toast.success("Connected to room");

            // Room messages (new + updates)
            client.subscribe(`/topic/room/${roomId}`, (msg) => {
                const newMessage = JSON.parse(msg.body);
                onMessage(newMessage);
            });

            // Typing indicator
            client.subscribe(`/topic/typing/${roomId}`, (msg) => {
                const { sender, isTyping } = JSON.parse(msg.body);
                if (sender !== currentUser) {
                    if (isTyping === true || isTyping === "true") {
                        setTypingUser(sender);
                        clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2500);
                    } else {
                        setTypingUser(null);
                    }
                }
            });

            // Presence
            client.subscribe(`/topic/presence/${roomId}`, (msg) => {
                const { sender, online } = JSON.parse(msg.body);
                setOnlineUsers((prev) => ({ ...prev, [sender]: online === true || online === "true" }));
            });

            // Announce self as online
            client.send(`/app/presence/${roomId}`, {}, JSON.stringify({ sender: currentUser, online: "true" }));
        });

        return () => {
            if (client.connected) {
                client.send(`/app/presence/${roomId}`, {}, JSON.stringify({ sender: currentUser, online: "false" }));
                client.disconnect();
            }
        };
    }, [roomId, connected]);

    const sendMessage = (messageData) => {
        if (!stompClient?.connected) return;
        stompClient.send(`/app/sendMessage/${roomId}`, {}, JSON.stringify(messageData));
    };

    const sendTyping = (isTyping) => {
        if (!stompClient?.connected) return;
        stompClient.send(`/app/typing/${roomId}`, {}, JSON.stringify({ sender: currentUser, isTyping }));
    };

    const deleteMessage = (messageId) => {
        if (!stompClient?.connected) return;
        stompClient.send(`/app/delete/${roomId}`, {}, JSON.stringify({ messageId, sender: currentUser }));
    };

    const editMessage = (messageId, newContent) => {
        if (!stompClient?.connected) return;
        stompClient.send(`/app/edit/${roomId}`, {}, JSON.stringify({ roomId, messageId, sender: currentUser, newContent }));
    };

    const reactToMessage = (messageId, emoji) => {
        if (!stompClient?.connected) return;
        stompClient.send(`/app/react/${roomId}`, {}, JSON.stringify({ roomId, messageId, sender: currentUser, emoji }));
    };

    const pinMessage = (messageId) => {
        if (!stompClient?.connected) return;
        stompClient.send(`/app/pin/${roomId}`, {}, JSON.stringify({ messageId, sender: currentUser }));
    };

    const markSeen = (messageId) => {
        if (!stompClient?.connected) return;
        stompClient.send(`/app/seen/${roomId}`, {}, JSON.stringify({ messageId, sender: currentUser }));
    };

    const disconnect = () => {
        if (stompClient?.connected) {
            stompClient.send(`/app/presence/${roomId}`, {}, JSON.stringify({ sender: currentUser, online: "false" }));
            stompClient.disconnect();
        }
    };

    return { stompClient, typingUser, onlineUsers, sendMessage, sendTyping, deleteMessage, editMessage, reactToMessage, pinMessage, markSeen, disconnect };
}
