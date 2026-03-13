import { httpClient, baseURL } from "../config/AxiosHelper";

export const createRoomApi = async (roomDetails) => {
    const response = await httpClient.post(`/api/v1/rooms`, roomDetails);
    return response.data;
};

export const joinChatApi = async (roomId) => {
    const response = await httpClient.get(`/api/v1/rooms/${roomId}`);
    return response.data;
};

export const getMessages = async (roomId, size = 50, page = 0) => {
    const response = await httpClient.get(`/api/v1/rooms/${roomId}/messages?size=${size}&page=${page}`);
    return response.data;
};

export const getPinnedMessages = async (roomId) => {
    const response = await httpClient.get(`/api/v1/rooms/${roomId}/pinned`);
    return response.data;
};

export const searchMessagesApi = async (roomId, query) => {
    const response = await httpClient.get(`/api/v1/rooms/${roomId}/messages/search?query=${encodeURIComponent(query)}`);
    return response.data;
};

export const getRoomStats = async (roomId) => {
    const response = await httpClient.get(`/api/v1/rooms/${roomId}/stats`);
    return response.data;
};

export const uploadFileApi = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${baseURL}/api/files/upload`, {
        method: "POST",
        body: formData,
    });
    if (!response.ok) throw new Error("Upload failed");
    return response.json();
};
