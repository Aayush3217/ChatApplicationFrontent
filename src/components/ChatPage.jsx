import React, { useEffect, useRef, useState } from 'react'
import { MdAttachFile, MdSend } from 'react-icons/md'
import useChatContext from '../context/chatContext';
import { useNavigate } from 'react-router';
import { baseURL } from '../config/AxiosHelper';
import toast from 'react-hot-toast';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { getMessages } from '../services/RoomServices';
import { timeAgo } from '../config/helper';

const ChatPage = () => {

    const { roomId, currentUser, connected, setConnected, setRoomId, setCurrentUser} = useChatContext();
    // console.log(roomId);
    // console.log(currentUser);
    // console.log(connected);

    const navigate = useNavigate();
    useEffect(() => {
        if (!connected) navigate("/");
    }, [connected, roomId, currentUser])


    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("")
    const inputRef = useRef(null)
    const chatBoxRef = useRef(null)
    const [stompClient, setStompClient] = useState(null);
    // const [roomId, setRoomId] = useState(""); 
    // const [currentUser] = useState("Aayush");

    //page init:
    //message ko load karna hoga
    useEffect(()=>{
        async function loadMessage(){
            try{
                const message = await getMessages(roomId);
                setMessages(message)
            }catch(error){

            }
        }
        if(connected){
            loadMessage();
        }
    },[])

    // scroll down
    useEffect(()=>{
        if(chatBoxRef.current){
            chatBoxRef.current.scroll({
                top : chatBoxRef.current.scrollHeight,
                behavior:'smooth'               
            })
        }
    },[messages])

    //stompClient ko init karna hoga
    // subscribe -> receving message from backend
    useEffect(() => {
        const connectWebSocket = () => {
            // SockJS
            const socket = new SockJS(`${baseURL}/chat`);
            const client = Stomp.over(socket);
            client.connect({}, () => {
                setStompClient(client);
                toast.success("connected");
                client.subscribe(`/topic/room/${roomId}`, (message) => {
                    console.log(message);
                    const newMessage = JSON.parse(message.body);
                    setMessages((prev) => [...prev, newMessage]);
                })
            })
        }
        if(connected){
            connectWebSocket();
        }
    }, [roomId])


    // send message handle
    const sendMessage = async () => {
        if (stompClient && connected && input.trim()) {
            console.log(input)

            const message = {
                sender : currentUser,
                content : input,
                roomId : roomId
            }

            stompClient.send(`/app/sendMessage/${roomId}`,{},JSON.stringify(message));
            setInput("")
        }
    }

    //handle logout
    function handleLogOut(){
        stompClient.disconnect()
        setConnected(false)
        setRoomId("")
        setCurrentUser("")
        navigate('/')
    }


    return (
        <div className=''>
            {/* this is a header portion */}
            <header className='dark:border-gray-700 fixed w-full dark:bg-gray-900 py-5 shadow flex justify-around items-center'>
                {/* room name container*/}
                <div>
                    <h1 className='text-xl font-semibold'>
                        Room : <span>{roomId}</span>
                    </h1>
                </div>
                {/* username container  */}
                <div>
                    <h1 className='text-xl font-semibold'>
                        User : <span>{currentUser}</span>
                    </h1>
                </div>
                {/* button : leave room */}
                <div>
                    <button onClick={handleLogOut} className='dark:bg-red-500 dark:hover:bg-red-700 px-3 py-2 rounded-full'>
                        Leave Room
                    </button>
                </div>
            </header>

            {/* content */}
            <main ref={chatBoxRef} className='py-20 px-10 w-2/3 dark:bg-slate-600 mx-auto h-screen overflow-auto'>
                {
                    messages.map((message, index) => (
                        <div key={index} className={`flex ${message.sender == currentUser ? "justify-end" : "justify-start"}`}>
                            <div className={`my-2 ${message.sender == currentUser ? "bg-purple-700" : "bg-gray-400"} p-2 max-w-xs rounded`}>
                                <div className='flex flex-row gap-2'>
                                    <img className='h-10 w-10' src={"https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka"} alt="" />
                                    <div className='flex flex-col gap=1'>
                                        <p className='text-sm font-bold'>{message.content}</p>
                                        <p>{message.sender}</p>
                                        <p className='text-xs text-gray-200'>{timeAgo(message.timestamp)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                }
            </main>

            {/* input message container */}
            <div className='fixed bottom-4 w-full h-13'>
                <div className='h-full pr-5 gap-4 flex items-center justify-between dark:bg-gray-900 rounded-full w-1/2 mx-auto'>
                    <input
                        value = {input}
                        onChange={(e)=>{
                            setInput(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if(e.key == "Enter"){
                                sendMessage();
                            }
                        }}
                        type="text" placeholder='Type your message here...'
                        className='w-full dark:bg-gray-800 border dark:gb-gray-800 rounded-full px-5 py-2 h-full focus:outline-none'
                    />
                    <div className='flex gap-1'>
                        <button className='dark:bg-purple-600 h-10 w-10 flex justify-center items-center rounded-full'>
                            <MdAttachFile size={20} />
                        </button>
                        <button onClick={sendMessage} className='dark:bg-green-600 h-10 w-10 flex justify-center items-center rounded-full'>
                            <MdSend size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChatPage
