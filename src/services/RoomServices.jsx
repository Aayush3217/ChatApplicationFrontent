import { httpClient } from "../config/AxiosHelper";

export const createRoomApi = async(roomDetails)=>{
    const response = await httpClient.post(`/api/v1/rooms`, roomDetails);
    return response.data;
}

export const joinChatApi = async(roomId)=>{
    const response = await httpClient.get(`/api/v1/rooms/${roomId}`);
    return response.data;
}

export const getMessages = async(roomId, size=50, page=0)=>{
    const respone = await httpClient(`/api/v1/rooms/${roomId}/messages?size=${size}&page=${page}`);
    return respone.data;
}