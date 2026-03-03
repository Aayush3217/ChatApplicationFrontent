import React, { useState } from 'react'
import chatIcon from '../assets/chat.png'
import toast from 'react-hot-toast';
import { createRoomApi, joinChatApi } from '../services/RoomServices';
import useChatContext from '../context/ChatContext';
import { useNavigate } from 'react-router';

const JoinCreateChat = () => {

    const [detail, setDeatil] = useState({
        roomId : "",
        userName : "",
    });

    const {roomId, userName, setRoomId, setCurrentUser, connected, setConnected} = useChatContext();
    const navigate = useNavigate();

    function handleFormInputChange(event){
        setDeatil({
            ...detail,
            [event.target.name] : event.target.value
        })
    }

    function validateForm(){
        if(detail.roomId=="" || detail.userName==""){
            toast.error("Invalid input !!")
            return false;
        }
        return true;
    }

    async function joinChat(){
        if(validateForm()){
            // join chat
            try{
            const room = await joinChatApi(detail.roomId);
            toast.success("joined..");
            setCurrentUser(detail.userName);
            setRoomId(room.roomId);
            setConnected(true);
            navigate("/chat")
            }catch(error){
                if(error.status == 400){
                    toast.error(error.response.data);
                }else{
                    toast.error("Error in joining room")
                }
                console.log(error);
            }
        }
    }

    async function createRoom() {
        if(validateForm()){
            // createRoom
            console.log(detail);
            // call api to create room on backend
            try{
                const response = await createRoomApi(detail.roomId);
                console.log(response);
                toast.success("Room Created Sucessfully !!");
                setCurrentUser(detail.userName);
                setRoomId(response.roomId);
                setConnected(true);
                // joinChat();
                
                //forward to chat page
                navigate('/chat')
            }catch(error) {
                console.log(error);
                if(error.status == 400){
                    toast.error("Room is already exists !!")
                }else{
                    toast.error("Error in creating room");
                }
            }
        }
    }

    return (
        <div className='min-h-screen flex items-center justify-center'>
            <div className='p-10 dark:border-gray-700 border w-ful flex flex-col gap-5 max-w-md rounded dark:bg-gray-900 shadow'>

                <div className='w-24 mx-auto'>
                    <img src={chatIcon} alt="chatIcon" />
                </div>

                <h1 className='text-2xl font-semibold text-center'>
                    Join Room / Create Room
                </h1>
                {/* name div */}
                <div>
                    <label htmlFor="name" className='block font-medium mb-2'>
                        Your name
                    </label>
                    <input onChange={handleFormInputChange}
                        value={detail.userName}
                        name = "userName"
                        type="text"
                        id="name"
                        placeholder='Enter the name'
                        className='w-full dark:bg-gray-600 px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                    />
                </div>
                {/* room  id div */}
                <div>
                    <label htmlFor="name" className='block font-medium mb-2'>
                        Room ID / New Room ID
                    </label>
                    <input 
                        onChange={handleFormInputChange}
                        value = {detail.roomId}
                        name = "roomId" // roomId matched Object field
                        type="text"
                        id="name"
                        placeholder='Enter the room id'
                        className='w-full dark:bg-gray-600 px-4 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                    />
                </div>
                {/* button */}
                <div className='flex justify-center gap-2 mt-2'>
                    <button onClick={joinChat} className='px-3 py-2 dark:bg-blue-500 hover:dark:bg-blue-800 rounded'>
                        Join Room
                    </button>
                    <button onClick={createRoom} className='px-3 py-2 dark:bg-orange-500 hover:dark:bg-orange-800 rounded'>
                        Create Room
                    </button>
                </div>
            </div>
        </div>
    )
}

export default JoinCreateChat
