import React, { useEffect, useRef, useState } from 'react'
import { MdAttachFile, MdSend } from 'react-icons/md'
import useChatContext from '../context/ChatContext';
import { useNavigate } from 'react-router';
import { baseURL } from '../config/AxiosHelper';
import toast from 'react-hot-toast';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { getMessages } from '../services/RoomServices';
import { timeAgo } from '../config/helper';

const ChatPage1 = () => {

    const { roomId, currentUser, connected, setConnected, setRoomId, setCurrentUser } = useChatContext();
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
    const [file, setfile] = useState(null);
    const fileInputRef = useRef(null);
    const [typingUser, setTypingUser] = useState(null);
    const typingTimeoutRef = useRef(null);
    const [previwImage, setpreviewImage] = useState(null);
    // const [roomId, setRoomId] = useState(""); 
    // const [currentUser] = useState("Aayush");

    //page init:
    //message ko load karna hoga
    useEffect(() => {
        async function loadMessage() {
            try {
                const message = await getMessages(roomId);
                setMessages(message)
            } catch (error) {

            }
        }
        if (connected) {
            loadMessage();
        }
    }, [])

    // scroll down
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scroll({
                top: chatBoxRef.current.scrollHeight,
                behavior: 'smooth'
            })
        }
    }, [messages])

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
                // client.subscribe(`/topic/room/${roomId}`, (message) => {
                //     console.log(message);
                //     const newMessage = JSON.parse(message.body);
                //     setMessages((prev) => [...prev, newMessage]);
                // })

                client.subscribe(`/topic/room/${roomId}`, (message)=>{
                    const newMessage = JSON.parse(message.body);
                    setMessages((prev)=>{
                        const exists = prev.find(m=>m.id == newMessage.id);

                        // UPDATE existing message (delete/update)
                        if(exists){
                            return prev.map(m=> m.id == newMessage.id ? newMessage : m);
                        }

                        // ADD new message
                        return[...prev, newMessage];
                    }) 
                })

                client.subscribe(`/topic/typing/${roomId}`, (msg) => {
                    // console.log("Typing recevied: ", msg.body);
                    const sender = msg.body;
                    if(sender != currentUser){
                        setTypingUser(sender);
                        clearTimeout(typingTimeoutRef.current);

                        typingTimeoutRef.current = setTimeout(()=>{
                            setTypingUser(null);
                        },2000);
                    }
                })

            })
        }
        if (connected) {
            connectWebSocket();
        }
    }, [roomId])


    // send message handle
    const sendMessage = async () => {
        if(!stompClient || !connected) return;
        let messageData = null;

        //If file exists -> upload file
        if(file){
            const fileUrl = await uploadFile();
            if(!fileUrl) return;
            messageData = {
                sender : currentUser,
                content : fileUrl,
                roomId : roomId,
                type : file.type.startsWith("image") ? "IMAGE" : "FILE"
            };
            setfile(null);
        }

        // If noraml text message
        else if(input.trim()){
            messageData = {
                sender: currentUser,
                content: input,
                roomId: roomId,
                type: "TEXT"
            };
            setInput("");
        }

        if(messageData){
            stompClient.send(`/app/sendMessage/${roomId}`,{}, JSON.stringify(messageData));
        }
    }

    //handle logout
    function handleLogOut() {
        stompClient.disconnect()
        setConnected(false)
        setRoomId("")
        setCurrentUser("")
        navigate('/')
    }

    //upload file function
    const uploadFile = async () =>{
        if(!file) return null;

        const formData = new FormData(); 
        formData.append("file", file);


        try{
            const res = await fetch(`${baseURL}/api/files/upload`,{
                method : "POST",
                body : formData
            });
            const data = await res.json();
            return data.url;
        }catch(error){
            toast.error("File upload failed");
            return null;
        }
    }

    // delete message 
    const deleteMessage = (messageId) => {
        if(!stompClient) return;
        stompClient.send(`/app/delete/${roomId}`,{},JSON.stringify({messageId}))
    }


    return (
        <div className='flex flex-col h-screen overflow-hidden'>
            {/* this is a header portion */}
            <header className='w-full shrink-0 dark:bg-gray-900 py-5 shadow flex justify-around items-center'>
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
            <main ref={chatBoxRef} className='flex-1 px-10 w-2/3 dark:bg-slate-600 mx-auto overflow-y-auto'>
                {
                    messages.map((message, index) => (
                        <div key={index} className={`flex w-full ${message.sender == currentUser ? "justify-end" : "justify-start"}`}>
                            <div className={`relative group my-2 ${message.sender == currentUser ? "bg-purple-700" : "bg-gray-400"} p-2 max-w-xs rounded overflow-hidden`}>

                                {/* DELETE BUTTON */}
                                {message.sender == currentUser && !message.deleted && (
                                    <button 
                                        className='absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white bg-black/30 hover:bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs'
                                        onClick={()=> deleteMessage(message.id)}
                                    >
                                        ❌
                                    </button>
                                )}

                                <div className='flex flex-row gap-2'>
                                    <img className='h-10 w-10' src={"https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka"} alt="" />
                                    <div className='flex flex-col gap=1'>


                                        {/* SHOW DELETED MESSAGE */}
                                        {message.deleted ? (
                                            <p className='italoc text-gray-300'>
                                                This message was deleted
                                            </p>
                                        ) : (
                                            <>
                                        {message.type == "IMAGE" && (
                                            <img src = {message.content} 
                                            onClick={()=> setpreviewImage(message.content)}
                                            className='max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-80 transition'/>
                                        )}
                                        {message.type == "FILE" && (
                                            <a href={message.content} target='_blank' className='underline'>Download File</a>
                                        )}
                                        {message.type == "TEXT" && (
                                            <p className='text-sm font-bold'>{message.content}</p>
                                        )}
                                        </>
                                        )}
                                        <p>{message.sender}</p>
                                       <p className='text-xs text-gray-200'>{timeAgo(message.timestamp)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                }

                {/* typing show */}
                {typingUser && (
                    <div className='flex justify-start px-4'>
                        <div className='bg-gray-500 text-white px-3 py-2 rounded-lg text-sm italic animate-pulse'>
                            {typingUser} is typing...
                        </div>
                    </div>
                )}
            </main>

            {/* IMAGE PREVIEW MODAL — ADD HERE */}
            {previwImage && (
                <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50'
                    onClick={()=>setpreviewImage(null)}
                >
                    <div
                        className='w-1/2 h-1/2 bg-black rounded-lg flex items-center justify-center relative'
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button onClick={()=>setpreviewImage(null)}  className="absolute top-3 right-3 text-white text-xl">
                            ❌
                        </button>
                        <img src={previwImage} className='max-w-full max-h-full object-contain rounded'/>
                    </div>
                    
                </div>
            )}

            {/* input message container */}
            <div className='w-full shrink-0 py-4'>
                <div className='h-full pr-5 gap-4 flex items-center justify-between dark:bg-gray-900 rounded-full w-1/2 mx-auto'>
                    <input
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);

                            // typing indicater
                            if(stompClient){
                                stompClient.send(`/app/typing/${roomId}`,{},JSON.stringify({sender:currentUser}));
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key == "Enter") {
                                sendMessage();
                            }
                        }}
                        type="text" placeholder='Type your message here...'
                        className='w-full dark:bg-gray-800 border dark:gb-gray-800 rounded-full px-5 py-2 h-full focus:outline-none'
                    />
                    <div className='flex gap-1'>
                        <button
                            onClick={()=> fileInputRef.current.click()}
                            className='dark:bg-purple-600 h-10 w-10 flex justify-center items-center rounded-full'
                        >
                            <MdAttachFile size={20} />
                        </button>
                        <input type="file" ref={fileInputRef} hidden onChange={(e)=>setfile(e.target.files[0])}/>
                        <button onClick={sendMessage} className='dark:bg-green-600 h-10 w-10 flex justify-center items-center rounded-full'>
                            <MdSend size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
    
}

export default ChatPage1
