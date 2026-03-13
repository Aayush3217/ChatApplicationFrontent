import React, { useState } from "react";
import chatIcon from "../assets/chat.png";
import toast from "react-hot-toast";
import { createRoomApi, joinChatApi } from "../services/RoomServices";
import useChatContext from "../context/ChatContext";
import { useNavigate } from "react-router";

const JoinCreateChat = () => {
    const [detail, setDetail] = useState({ roomId: "", userName: "" });
    const [loading, setLoading] = useState(null); // "join" | "create" | null
    const { setRoomId, setCurrentUser, setConnected } = useChatContext();
    const navigate = useNavigate();

    const handleChange = (e) => setDetail({ ...detail, [e.target.name]: e.target.value });

    const validate = () => {
        if (!detail.roomId.trim() || !detail.userName.trim()) {
            toast.error("Please enter both name and room ID");
            return false;
        }
        return true;
    };

    const joinChat = async () => {
        if (!validate() || loading) return;
        setLoading("join");
        try {
            const room = await joinChatApi(detail.roomId);
            toast.success("Joined room!");
            setCurrentUser(detail.userName);
            setRoomId(room.roomId);
            setConnected(true);
            navigate("/chat");
        } catch (error) {
            toast.error(error?.response?.data?.error || error?.response?.data || "Room not found");
        } finally {
            setLoading(null);
        }
    };

    const createRoom = async () => {
        if (!validate() || loading) return;
        setLoading("create");
        try {
            // Updated to send CreateRoomRequest object
            const response = await createRoomApi({
                roomId: detail.roomId,
                roomName: detail.roomId,
                createdBy: detail.userName,
            });
            toast.success("Room created!");
            setCurrentUser(detail.userName);
            setRoomId(response.roomId);
            setConnected(true);
            navigate("/chat");
        } catch (error) {
            toast.error(error?.response?.data?.error || "Room already exists");
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 flex flex-col gap-5">

                <div className="w-16 mx-auto">
                    <img src={chatIcon} alt="Chat" className="w-full" />
                </div>

                <h1 className="text-2xl font-bold text-center text-white">Join or Create Room</h1>

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
                        <input
                            name="userName"
                            value={detail.userName}
                            onChange={handleChange}
                            onKeyDown={(e) => e.key === "Enter" && joinChat()}
                            type="text"
                            placeholder="Enter your name"
                            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Room ID</label>
                        <input
                            name="roomId"
                            value={detail.roomId}
                            onChange={handleChange}
                            onKeyDown={(e) => e.key === "Enter" && joinChat()}
                            type="text"
                            placeholder="Enter room ID"
                            className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-1">
                    <button
                        onClick={joinChat}
                        disabled={!!loading}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition">
                        {loading === "join" ? "Joining..." : "Join Room"}
                    </button>
                    <button
                        onClick={createRoom}
                        disabled={!!loading}
                        className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition">
                        {loading === "create" ? "Creating..." : "Create Room"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinCreateChat;
