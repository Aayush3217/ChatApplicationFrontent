// import {useWebSocket } from "../hook/useWebSocket";


import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  MdAttachFile, MdSend, MdSearch, MdClose, MdPushPin,
  MdBarChart, MdLogout, MdEdit, MdCheck, MdReply,
  MdPeople, MdEmojiEmotions, MdDownload, MdContentCopy,
  MdDone, MdDoneAll, MdKeyboardArrowDown, MdImage,
  MdInsertDriveFile, MdDelete, MdSchedule
} from "react-icons/md";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import useChatContext from "../context/ChatContext";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  getMessages, getPinnedMessages, searchMessagesApi,
  getRoomStats, uploadFileApi
} from "../services/RoomServices";
import { timeAgo, getAvatarUrl, formatFileSize } from "../config/helper";
import { baseURL } from "../config/AxiosHelper";

/* ══════════════════════════════════════════════════════════
   STYLES  — injected once into <head>
══════════════════════════════════════════════════════════ */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=Nunito:wght@300;400;500;600&display=swap');

:root {
  --bg:        #111118;
  --bg2:       #18181f;
  --bg3:       #1f1f28;
  --surface:   #26262f;
  --border:    rgba(255,255,255,0.07);
  --accent:    #f5a623;
  --accent2:   #e8852a;
  --own-start: #c96a1e;
  --own-end:   #e8852a;
  --text:      #f0ede8;
  --text2:     rgba(240,237,232,0.55);
  --text3:     rgba(240,237,232,0.28);
  --green:     #4ade80;
  --red:       #f87171;
  --blue:      #60a5fa;
  --r:         16px;
}

.cr { font-family:'Nunito',sans-serif; background:var(--bg); color:var(--text); }

/* scrollbar */
.cs::-webkit-scrollbar        { width:3px; }
.cs::-webkit-scrollbar-track  { background:transparent; }
.cs::-webkit-scrollbar-thumb  { background:rgba(255,255,255,0.08); border-radius:99px; }

/* animations */
@keyframes fadeUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
@keyframes fadeLeft  { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
@keyframes popIn     { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
@keyframes shimmer   { 0%,100%{opacity:.4} 50%{opacity:1} }
@keyframes blink     { 0%,100%{transform:scaleY(1);opacity:.4} 50%{transform:scaleY(1.6);opacity:1} }
@keyframes glow      { 0%,100%{box-shadow:0 0 0 0 rgba(245,166,35,.3)} 50%{box-shadow:0 0 0 5px rgba(245,166,35,0)} }
@keyframes highlight { 0%,100%{background:transparent} 40%,60%{background:rgba(245,166,35,.13)} }

.b-own   { animation:fadeRight .2s cubic-bezier(.34,1.56,.64,1) both; }
.b-other { animation:fadeLeft  .2s cubic-bezier(.34,1.56,.64,1) both; }
.pop-in  { animation:popIn .15s cubic-bezier(.34,1.56,.64,1) both; }
.fade-up { animation:fadeUp .18s ease both; }
.dot1    { animation:blink 1.1s .0s infinite; }
.dot2    { animation:blink 1.1s .18s infinite; }
.dot3    { animation:blink 1.1s .36s infinite; }
.glow-pulse { animation:glow 2s infinite; }
.msg-hl  { animation:highlight 1.6s ease; border-radius:var(--r); }

/* action toolbar — hidden until hover */
.act  { opacity:0; pointer-events:none; transform:translateY(3px);
        transition:opacity .14s,transform .14s; }
.msg-wrap:hover .act { opacity:1; pointer-events:auto; transform:translateY(0); }

/* sidebar slide in */
@keyframes slideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
.side-in { animation:slideIn .2s cubic-bezier(.4,0,.2,1) both; }

/* tab nav */
.tab-on  { background:rgba(245,166,35,.15); color:var(--accent); }
.tab-off { color:var(--text3); }
.tab-off:hover { background:rgba(255,255,255,.05); color:var(--text2); }

/* character counter ring color */
.cc-warn { color:#fb923c; }
.cc-over { color:var(--red); }

/* badge */
@keyframes badgePop { from{transform:scale(0)} to{transform:scale(1)} }
.badge { animation:badgePop .2s cubic-bezier(.34,1.56,.64,1) both; }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || document.getElementById("cr-styles")) return;
  const el = document.createElement("style");
  el.id = "cr-styles"; el.textContent = STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
}

/* ══════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
══════════════════════════════════════════════════════════ */
const PALETTE = ["#f5a623","#4ade80","#60a5fa","#f472b6","#a78bfa","#2dd4bf","#fb923c","#e879f9"];
const EMOJIS  = ["👍","❤️","😂","🔥","😮","😢","🎉","👏","💯","🤔"];
const MAX_CHARS = 1000;

function userColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function isSameDay(a, b) {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth()    === d2.getMonth() &&
         d1.getDate()     === d2.getDate();
}

function formatDay(ts) {
  const d = new Date(ts), now = new Date();
  if (isSameDay(ts, now)) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (isSameDay(ts, y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
}

function shortTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });
}

/* ══════════════════════════════════════════════════════════
   useWebSocket
══════════════════════════════════════════════════════════ */
function useWebSocket(roomId, currentUser, connected, onMessage) {
  const [stompClient, setStompClient] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const timers = useRef({});

  useEffect(() => {
    if (!connected || !roomId) return;
    const sock   = new SockJS(`${baseURL}/chat`);
    const client = Stomp.over(sock);
    client.debug = () => {};

    client.connect({}, () => {
      setStompClient(client);

      client.subscribe(`/topic/room/${roomId}`,     m => onMessage(JSON.parse(m.body)));
      client.subscribe(`/topic/typing/${roomId}`,   m => {
        const { sender, isTyping } = JSON.parse(m.body);
        if (sender === currentUser) return;
        setTypingUsers(prev => {
          const next = { ...prev };
          if (isTyping === true || isTyping === "true") {
            next[sender] = true;
            clearTimeout(timers.current[sender]);
            timers.current[sender] = setTimeout(() => {
              setTypingUsers(p => { const n={...p}; delete n[sender]; return n; });
            }, 2500);
          } else { delete next[sender]; }
          return next;
        });
      });
      client.subscribe(`/topic/presence/${roomId}`, m => {
        const { sender, online } = JSON.parse(m.body);
        setOnlineUsers(prev => ({ ...prev, [sender]: online===true||online==="true" }));
      });

      client.send(`/app/presence/${roomId}`, {}, JSON.stringify({ sender:currentUser, online:"true" }));
    });

    return () => {
      if (client.connected) {
        client.send(`/app/presence/${roomId}`, {}, JSON.stringify({ sender:currentUser, online:"false" }));
        client.disconnect();
      }
    };
  }, [roomId, connected]);

  const tx = (dest, body) => stompClient?.connected && stompClient.send(dest,{},JSON.stringify(body));
  return {
    typingUsers, onlineUsers,
    sendMessage:    d      => tx(`/app/sendMessage/${roomId}`, d),
    sendTyping:     t      => tx(`/app/typing/${roomId}`,     { sender:currentUser, isTyping:t }),
    deleteMessage:  id     => tx(`/app/delete/${roomId}`,    { messageId:id, sender:currentUser }),
    editMessage:    (id,c) => tx(`/app/edit/${roomId}`,      { roomId, messageId:id, sender:currentUser, newContent:c }),
    reactToMessage: (id,e) => tx(`/app/react/${roomId}`,     { roomId, messageId:id, sender:currentUser, emoji:e }),
    pinMessage:     id     => tx(`/app/pin/${roomId}`,       { messageId:id, sender:currentUser }),
    markSeen:       id     => tx(`/app/seen/${roomId}`,      { messageId:id, sender:currentUser }),
    disconnect:     ()     => {
      if (stompClient?.connected) {
        tx(`/app/presence/${roomId}`, { sender:currentUser, online:"false" });
        stompClient.disconnect();
      }
    },
  };
}

/* ══════════════════════════════════════════════════════════
   AVATAR
══════════════════════════════════════════════════════════ */
function Avatar({ name, size=32, online }) {
  const c = userColor(name);
  return (
    <div className="relative shrink-0" style={{ width:size, height:size }}>
      <img src={getAvatarUrl(name)} alt={name}
        className="w-full h-full rounded-full object-cover"
        style={{ border:`2px solid ${c}`, boxSizing:"border-box" }} />
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2`}
          style={{
            width:10, height:10, borderColor:"var(--bg)",
            background: online ? "var(--green)" : "var(--surface)"
          }} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   EMOJI PICKER
══════════════════════════════════════════════════════════ */
function EmojiPicker({ onSelect, onClose }) {
  return (
    <div className="pop-in absolute z-50 flex gap-1 px-2 py-2 rounded-2xl shadow-2xl"
      style={{ bottom:"calc(100% + 8px)", left:0, background:"var(--bg2)", border:"1px solid var(--border)" }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => { onSelect(e); onClose(); }}
          className="text-lg w-8 h-8 flex items-center justify-center rounded-xl hover:scale-125 transition-transform"
          style={{ background:"transparent" }}>{e}</button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DATE DIVIDER
══════════════════════════════════════════════════════════ */
function DateDivider({ ts }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ background:"var(--border)" }} />
      <span className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full"
        style={{ background:"var(--surface)", color:"var(--text3)", fontFamily:"'Syne',sans-serif", letterSpacing:"0.1em" }}>
        {formatDay(ts)}
      </span>
      <div className="flex-1 h-px" style={{ background:"var(--border)" }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MESSAGE BUBBLE
══════════════════════════════════════════════════════════ */
function MessageBubble({ message, isOwn, currentUser, onlineUsers, prevMessage, onDelete, onEdit, onReact, onPin, onReply, onMarkSeen, onJump, onImagePreview }) {
  const [showEmoji, setShowEmoji]  = useState(false);
  const [editMode, setEditMode]    = useState(false);
  const [editText, setEditText]    = useState(message.content || "");
  const [copied, setCopied]        = useState(false);

  useEffect(() => { if (!isOwn && !message.deleted) onMarkSeen(message.id); }, []);

  const saveEdit = () => {
    if (editText.trim() && editText !== message.content) onEdit(message.id, editText.trim());
    setEditMode(false);
  };

  const copyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  // Group adjacent messages from same sender within 3 minutes
  const grouped = prevMessage &&
    prevMessage.sender === message.sender &&
    Math.abs(new Date(message.timestamp) - new Date(prevMessage.timestamp)) < 180000;

  const totalReactions = Object.values(message.reactions || {}).reduce((s,u) => s+u.length, 0);
  const senderColor    = userColor(message.sender);

  if (message.type === "SYSTEM") {
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs px-4 py-1.5 rounded-full"
          style={{ background:"var(--surface)", color:"var(--text3)", fontFamily:"'Syne',sans-serif" }}>
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`msg-wrap flex w-full ${isOwn ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-4"}`}>
      <div className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : "flex-row"}`} style={{ maxWidth:"72%" }}>

        {/* Avatar — only show on first message in group */}
        {!isOwn && (
          <div className="self-end mb-1" style={{ width:32, flexShrink:0 }}>
            {!grouped
              ? <Avatar name={message.sender} size={32} online={onlineUsers?.[message.sender]} />
              : <div style={{ width:32 }} />
            }
          </div>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} gap-0.5`}>

          {/* Sender name — only first in group */}
          {!isOwn && !grouped && (
            <span className="text-xs font-semibold ml-1 mb-0.5" style={{ color:senderColor, fontFamily:"'Syne',sans-serif" }}>
              {message.sender}
            </span>
          )}

          {/* Reply preview */}
          {message.replyToMessageId && (
            <div onClick={() => onJump(message.replyToMessageId)}
              className="cursor-pointer flex gap-2 px-3 py-1.5 rounded-xl mb-1 max-w-full"
              style={{ background:"rgba(255,255,255,0.05)", borderLeft:`3px solid ${userColor(message.replyToSenderName||"")}` }}>
              <div className="min-w-0">
                <span className="text-xs font-semibold block" style={{ color:userColor(message.replyToSenderName||"") }}>
                  {message.replyToSenderName}
                </span>
                <span className="text-xs truncate block" style={{ color:"var(--text3)" }}>
                  {message.replyToContentPreview}
                </span>
              </div>
            </div>
          )}

          {/* Bubble + actions */}
          <div className="relative">

            {/* Floating action toolbar */}
            <div className={`act absolute z-30 flex items-center gap-1 top-0 ${isOwn ? "right-full mr-2" : "left-full ml-2"}`}>
              <ActionBtn onClick={() => setShowEmoji(v => !v)} title="React"><MdEmojiEmotions size={14}/></ActionBtn>
              <ActionBtn onClick={() => onReply(message)} title="Reply"><MdReply size={14}/></ActionBtn>
              <ActionBtn
                onClick={() => onPin(message.id)}
                title={message.pinned ? "Unpin" : "Pin"}
                active={message.pinned}
                activeColor="var(--accent)">
                <MdPushPin size={14}/>
              </ActionBtn>
              {message.type === "TEXT" && !message.deleted && (
                <ActionBtn onClick={copyText} title="Copy">
                  {copied ? <MdDone size={14} style={{color:"var(--green)"}}/> : <MdContentCopy size={14}/>}
                </ActionBtn>
              )}
              {isOwn && !message.deleted && (
                <>
                  {message.type === "TEXT" && (
                    <ActionBtn onClick={() => setEditMode(true)} title="Edit"><MdEdit size={14}/></ActionBtn>
                  )}
                  <ActionBtn onClick={() => onDelete(message.id)} title="Delete" danger>
                    <MdDelete size={14}/>
                  </ActionBtn>
                </>
              )}
            </div>

            {/* Emoji picker */}
            {showEmoji && (
              <EmojiPicker onSelect={e => onReact(message.id, e)} onClose={() => setShowEmoji(false)} />
            )}

            {/* Bubble */}
            <div
              className={isOwn ? "b-own" : "b-other"}
              style={{
                padding: message.type === "IMAGE" ? "4px" : "10px 14px",
                borderRadius: isOwn
                  ? grouped ? "18px 18px 4px 18px" : "18px 4px 18px 18px"
                  : grouped ? "18px 18px 18px 4px" : "4px 18px 18px 18px",
                background: isOwn
                  ? "linear-gradient(135deg, var(--own-start), var(--own-end))"
                  : "var(--bg3)",
                border: isOwn ? "none" : "1px solid var(--border)",
                boxShadow: isOwn ? "0 4px 20px rgba(232,133,42,.2)" : "0 2px 8px rgba(0,0,0,.2)",
              }}>

              {message.deleted ? (
                <p className="text-sm italic" style={{ color:"rgba(255,255,255,.35)" }}>Message deleted</p>
              ) : editMode ? (
                <div className="flex gap-2 items-center" style={{ minWidth:200 }}>
                  <input autoFocus value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if(e.key==="Enter") saveEdit(); if(e.key==="Escape") setEditMode(false); }}
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none pb-0.5"
                    style={{ borderBottom:"1px solid rgba(255,255,255,.4)" }} />
                  <button onClick={saveEdit}><MdCheck size={17} style={{color:"var(--green)"}}/></button>
                  <button onClick={() => setEditMode(false)}><MdClose size={17} style={{color:"var(--text3)"}}/></button>
                </div>
              ) : (
                <>
                  {message.type === "IMAGE" && (
                    <img src={message.fileUrl || message.content} alt="img"
                      onClick={() => onImagePreview(message.fileUrl || message.content)}
                      className="block rounded-2xl object-cover cursor-zoom-in hover:opacity-90 transition"
                      style={{ maxWidth:260, maxHeight:260 }} />
                  )}
                  {message.type === "FILE" && (
                    <a href={message.content} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 py-1 no-underline">
                      <div className="rounded-xl flex items-center justify-center shrink-0"
                        style={{ width:40, height:40, background:"rgba(255,255,255,.1)" }}>
                        <MdInsertDriveFile size={20} style={{color:"rgba(255,255,255,.8)"}}/>
                      </div>
                      <div style={{ minWidth:0 }}>
                        <p className="text-sm font-medium text-white truncate" style={{ maxWidth:160 }}>
                          {message.fileName || "File"}
                        </p>
                        <p className="text-xs" style={{ color:"rgba(255,255,255,.5)" }}>
                          {formatFileSize(message.fileSize)}
                        </p>
                      </div>
                      <MdDownload size={18} style={{color:"rgba(255,255,255,.5)"}}/>
                    </a>
                  )}
                  {(message.type === "TEXT" || !message.type) && (
                    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap" style={{ color:"var(--text)" }}>
                      {message.content}
                    </p>
                  )}
                </>
              )}

              {/* Meta */}
              {!message.deleted && (
                <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                  {message.pinned && (
                    <MdPushPin size={10} style={{ color: isOwn ? "rgba(255,255,255,.6)" : "var(--accent)" }} />
                  )}
                  <span className="text-[10px]" style={{ color: isOwn ? "rgba(255,255,255,.5)" : "var(--text3)" }}>
                    {shortTime(message.timestamp)}
                  </span>
                  {message.edited && (
                    <span className="text-[10px] italic" style={{ color:"rgba(255,255,255,.3)" }}>edited</span>
                  )}
                  {isOwn && (
                    <span style={{ color: message.seenBy?.length > 0 ? "var(--blue)" : "rgba(255,255,255,.4)" }}>
                      {message.seenBy?.length > 0 ? <MdDoneAll size={12}/> : <MdDone size={12}/>}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Reactions row */}
            {totalReactions > 0 && (
              <div className={`flex flex-wrap gap-1 mt-1.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                {Object.entries(message.reactions || {}).map(([emoji, users]) =>
                  users.length > 0 && (
                    <button key={emoji} onClick={() => onReact(message.id, emoji)}
                      title={users.join(", ")}
                      className="pop-in flex items-center gap-1 text-xs px-2 py-0.5 rounded-full hover:scale-105 transition-transform"
                      style={{
                        background: users.includes(currentUser) ? "rgba(245,166,35,.2)" : "var(--surface)",
                        border: users.includes(currentUser) ? "1px solid rgba(245,166,35,.5)" : "1px solid var(--border)",
                        color:"var(--text)"
                      }}>
                      <span>{emoji}</span>
                      <span style={{ fontFamily:"monospace", fontSize:10 }}>{users.length}</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── small action button ── */
function ActionBtn({ children, onClick, title, danger, active, activeColor }) {
  return (
    <button onClick={onClick} title={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center hover:scale-110 transition-transform"
      style={{
        background: active ? `${activeColor}22` : danger ? "rgba(248,113,113,.12)" : "var(--surface)",
        color: active ? activeColor : danger ? "var(--red)" : "var(--text2)",
        border:"1px solid var(--border)"
      }}>
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════ */
function Sidebar({ tab, roomId, onlineUsers, onClose, onJump }) {
  const [q, setQ]         = useState("");
  const [results, setRes] = useState([]);
  const [loading, setLd]  = useState(false);
  const [pinned, setPinned] = useState([]);
  const [stats, setStats]   = useState(null);

  useEffect(() => {
    if (tab === "pinned") getPinnedMessages(roomId).then(setPinned).catch(()=>{});
    if (tab === "stats")  getRoomStats(roomId).then(setStats).catch(()=>{});
  }, [tab]);

  const search = async e => {
    e.preventDefault();
    if (!q.trim()) return;
    setLd(true);
    try { setRes(await searchMessagesApi(roomId, q)); }
    catch { toast.error("Search failed"); }
    finally { setLd(false); }
  };

  const onlineList  = Object.entries(onlineUsers).filter(([,v])=>v);
  const offlineList = Object.entries(onlineUsers).filter(([,v])=>!v);

  const TITLES = { search:"Search", pinned:"Pinned", members:"Members", stats:"Stats" };

  return (
    <aside className="side-in flex flex-col h-full rounded-2xl overflow-hidden shrink-0"
      style={{ width:280, background:"var(--bg2)", border:"1px solid var(--border)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom:"1px solid var(--border)" }}>
        <span className="font-semibold text-sm" style={{ fontFamily:"'Syne',sans-serif", color:"var(--text)" }}>
          {TITLES[tab]}
        </span>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          style={{ color:"var(--text3)" }}>
          <MdClose size={17}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto cs p-3">

        {/* ── Search ── */}
        {tab === "search" && (
          <>
            <form onSubmit={search} className="flex gap-2 mb-3">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search messages…"
                className="flex-1 text-sm rounded-xl px-3 py-2 focus:outline-none"
                style={{ background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text)" }}/>
              <button type="submit" className="px-3 py-2 rounded-xl text-sm font-semibold transition hover:opacity-80"
                style={{ background:"var(--accent)", color:"var(--bg)", fontFamily:"'Syne',sans-serif" }}>
                {loading ? "…" : "Go"}
              </button>
            </form>
            {!loading && q && results.length === 0 && (
              <EmptyState icon="🔍" text="No results found"/>
            )}
            {results.map(msg => (
              <SideCard key={msg.id} onClick={() => onJump(msg.id)}>
                <span className="text-xs font-semibold" style={{ color:userColor(msg.sender) }}>{msg.sender}</span>
                <p className="text-sm line-clamp-2" style={{ color:"var(--text2)" }}>{msg.content}</p>
                <span className="text-[10px]" style={{ color:"var(--text3)" }}>{timeAgo(msg.timestamp)}</span>
              </SideCard>
            ))}
          </>
        )}

        {/* ── Pinned ── */}
        {tab === "pinned" && (
          pinned.length === 0
            ? <EmptyState icon="📌" text="No pinned messages yet"/>
            : pinned.map(msg => (
                <SideCard key={msg.id} onClick={() => onJump(msg.id)}
                  accent={userColor(msg.sender)}>
                  <span className="text-xs font-semibold" style={{ color:userColor(msg.sender) }}>{msg.sender}</span>
                  <p className="text-sm line-clamp-2" style={{ color:"var(--text2)" }}>{msg.content}</p>
                  <span className="text-[10px]" style={{ color:"var(--text3)" }}>
                    pinned by {msg.pinnedBy} · {timeAgo(msg.pinnedAt)}
                  </span>
                </SideCard>
              ))
        )}

        {/* ── Members ── */}
        {tab === "members" && (
          onlineList.length === 0 && offlineList.length === 0
            ? <EmptyState icon="👥" text="No members tracked yet"/>
            : <>
                {onlineList.length > 0 && (
                  <SectionLabel>{onlineList.length} Online</SectionLabel>
                )}
                {onlineList.map(([name]) => (
                  <div key={name} className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1 hover:bg-white/5 transition">
                    <Avatar name={name} size={30} online={true}/>
                    <span className="text-sm font-medium" style={{ color:"var(--text)" }}>{name}</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background:"rgba(74,222,128,.15)", color:"var(--green)" }}>live</span>
                  </div>
                ))}
                {offlineList.length > 0 && (
                  <SectionLabel className="mt-3">{offlineList.length} Offline</SectionLabel>
                )}
                {offlineList.map(([name]) => (
                  <div key={name} className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1 hover:bg-white/5 transition">
                    <Avatar name={name} size={30} online={false}/>
                    <span className="text-sm" style={{ color:"var(--text3)" }}>{name}</span>
                  </div>
                ))}
              </>
        )}

        {/* ── Stats ── */}
        {tab === "stats" && (
          stats
            ? <div className="grid grid-cols-2 gap-2">
                {[
                  { label:"Messages",   val:stats.totalMessages,  icon:"💬", color:"var(--blue)" },
                  { label:"Online",     val:stats.onlineMembers,  icon:"🟢", color:"var(--green)" },
                  { label:"Images",     val:stats.imageMessages,  icon:"🖼️", color:"#f472b6" },
                  { label:"Pinned",     val:stats.pinnedMessages, icon:"📌", color:"var(--accent)" },
                  { label:"Edited",     val:stats.editedMessages, icon:"✏️", color:"#fb923c" },
                  { label:"Top Sender", val:stats.topSender,      icon:"🏆", color:"#a78bfa", full:true },
                ].map(s => (
                  <div key={s.label} className={s.full ? "col-span-2" : ""}
                    style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"12px 14px" }}>
                    <p className="text-xs mb-1" style={{ color:"var(--text3)" }}>{s.icon} {s.label}</p>
                    <p className="text-xl font-bold" style={{ color:s.color, fontFamily:"'Syne',sans-serif" }}>
                      {s.val ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            : <EmptyState icon="📊" text="Loading stats…" shimmer/>
        )}
      </div>
    </aside>
  );
}

function SideCard({ children, onClick, accent }) {
  return (
    <div onClick={onClick}
      className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl mb-1 cursor-pointer hover:bg-white/5 transition"
      style={accent ? { borderLeft:`2px solid ${accent}`, paddingLeft:10 } : {}}>
      {children}
    </div>
  );
}

function SectionLabel({ children, className="" }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-widest px-2 mb-2 ${className}`}
      style={{ color:"var(--text3)", fontFamily:"'Syne',sans-serif", letterSpacing:"0.12em" }}>
      {children}
    </p>
  );
}

function EmptyState({ icon, text, shimmer }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <span className="text-3xl" style={{ animation: shimmer ? "shimmer 1.5s infinite" : "none" }}>{icon}</span>
      <p className="text-sm text-center" style={{ color:"var(--text3)" }}>{text}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LIGHTBOX
══════════════════════════════════════════════════════════ */
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const handler = e => { if(e.key==="Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background:"rgba(0,0,0,.94)" }}
      onClick={onClose}>
      <button className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background:"var(--surface)", color:"var(--text2)" }}>
        <MdClose size={20}/>
      </button>
      <img src={src} onClick={e=>e.stopPropagation()}
        className="object-contain rounded-2xl"
        style={{ maxWidth:"92vw", maxHeight:"90vh" }}/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN CHATPAGE
══════════════════════════════════════════════════════════ */
const ChatPage1 = () => {
  injectStyles();
  const { roomId, currentUser, connected, setConnected, setRoomId, setCurrentUser } = useChatContext();
  const navigate = useNavigate();

  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [file, setFile]                 = useState(null);
  const [replyTo, setReplyTo]           = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [sideTab, setSideTab]           = useState(null);
  const [highlightId, setHighlightId]   = useState(null);
  const [previewSrc, setPreviewSrc]     = useState(null);
  const [atBottom, setAtBottom]         = useState(true);
  const [unread, setUnread]             = useState(0);

  const scrollRef  = useRef(null);
  const fileRef    = useRef(null);
  const typingRef  = useRef(null);
  const msgRefs    = useRef({});

  useEffect(() => { if (!connected) navigate("/"); }, [connected]);

  const handleIncoming = useCallback(msg => {
    setMessages(prev => {
      const exists = prev.find(m => m.id === msg.id);
      const next = exists ? prev.map(m => m.id===msg.id ? msg : m) : [...prev, msg];
      if (!exists && msg.sender !== currentUser) {
        setAtBottom(ab => { if (!ab) setUnread(u => u+1); return ab; });
      }
      return next;
    });
  }, [currentUser]);

  const ws = useWebSocket(roomId, currentUser, connected, handleIncoming);

  useEffect(() => {
    if (connected) getMessages(roomId).then(setMessages).catch(() => toast.error("Failed to load"));
  }, []);

  // Auto-scroll only when at bottom
  useEffect(() => {
    if (atBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:"smooth" });
      setUnread(0);
    }
  }, [messages, atBottom]);

  const handleScroll = () => {
    const el = scrollRef.current; if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const bottom = dist < 60;
    setAtBottom(bottom);
    if (bottom) setUnread(0);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:"smooth" });
    setAtBottom(true); setUnread(0);
  };

  const handleSend = async () => {
    if (uploading) return;
    let data = null;

    if (file) {
      setUploading(true);
      try {
        const res = await uploadFileApi(file);
        data = {
          sender:currentUser, content:res.url, roomId,
          type: res.type || (file.type.startsWith("image/") ? "IMAGE" : "FILE"),
          fileUrl:res.url, fileName:res.fileName, fileSize:res.fileSize, fileMimeType:res.mimeType,
        };
        setFile(null);
      } catch { toast.error("Upload failed"); return; }
      finally { setUploading(false); }
    } else if (input.trim() && input.length <= MAX_CHARS) {
      data = { sender:currentUser, content:input.trim(), roomId, type:"TEXT" };
      setInput("");
    }

    if (!data) return;
    if (replyTo) { data.replyToMessageId = replyTo.id; setReplyTo(null); }
    ws.sendMessage(data);
  };

  const handleTyping = e => {
    setInput(e.target.value);
    ws.sendTyping(true);
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => ws.sendTyping(false), 1500);
  };

  const handleLogout = () => {
    ws.disconnect();
    setConnected(false); setRoomId(""); setCurrentUser("");
    navigate("/");
  };

  const jumpToMessage = id => {
    setSideTab(null);
    setHighlightId(id);
    setTimeout(() => msgRefs.current[id]?.scrollIntoView({ behavior:"smooth", block:"center" }), 60);
    setTimeout(() => setHighlightId(null), 2200);
  };

  const toggleTab = t => setSideTab(p => p===t ? null : t);
  const onlineCount = Object.values(ws.onlineUsers).filter(Boolean).length;
  const typingList  = Object.keys(ws.typingUsers);
  const charCount   = input.length;
  const overLimit   = charCount > MAX_CHARS;

  // Build message list with date dividers
  const renderedMessages = useMemo(() => {
    const items = [];
    messages.forEach((msg, i) => {
      const prev = messages[i-1];
      if (!prev || !isSameDay(prev.timestamp, msg.timestamp)) {
        items.push({ type:"divider", ts:msg.timestamp, key:`d-${msg.timestamp}-${i}` });
      }
      items.push({ type:"msg", msg, prev: prev && isSameDay((prev.timestamp||0), (msg.timestamp||0)) ? prev : null });
    });
    return items;
  }, [messages]);

  const NAV_ITEMS = [
    { id:"search",  icon:<MdSearch size={17}/>,   label:"Search" },
    { id:"pinned",  icon:<MdPushPin size={17}/>,  label:"Pinned" },
    { id:"members", icon:<MdPeople size={17}/>,   label:"Members" },
    { id:"stats",   icon:<MdBarChart size={17}/>, label:"Stats" },
  ];

  return (
    <div className="cr flex flex-col h-screen overflow-hidden">
      {previewSrc && <Lightbox src={previewSrc} onClose={() => setPreviewSrc(null)}/>}

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3"
        style={{ background:"var(--bg2)", borderBottom:"1px solid var(--border)" }}>

        {/* Room info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shrink-0"
            style={{ background:"var(--accent)", color:"var(--bg)", fontFamily:"'Syne',sans-serif" }}>
            {roomId.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-bold leading-tight" style={{ fontFamily:"'Syne',sans-serif", color:"var(--text)", fontSize:15 }}>
              # {roomId}
            </h1>
            <p className="text-xs" style={{ color:"var(--text3)" }}>
              {onlineCount > 0
                ? <><span style={{ color:"var(--green)" }}>●</span> {onlineCount} online · </>
                : null
              }
              {currentUser}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button key={id} onClick={() => toggleTab(id)} title={label}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${sideTab===id ? "tab-on" : "tab-off"}`}
              style={{ fontFamily:"'Syne',sans-serif" }}>
              {icon}
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
          <div className="w-px h-5 mx-1" style={{ background:"var(--border)" }}/>
          <button onClick={handleLogout} title="Leave"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all tab-off hover:bg-red-500/10"
            style={{ color:"var(--red)", fontFamily:"'Syne',sans-serif" }}>
            <MdLogout size={17}/> <span className="hidden md:inline">Leave</span>
          </button>
        </nav>
      </header>

      {/* ── BODY ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Messages pane */}
        <div className="flex flex-col flex-1 overflow-hidden relative">

          {/* Scroll area */}
          <div ref={scrollRef} onScroll={handleScroll}
            className="flex-1 overflow-y-auto cs px-5 py-2"
            style={{ background:"var(--bg)" }}>
            {renderedMessages.map(item =>
              item.type === "divider"
                ? <DateDivider key={item.key} ts={item.ts}/>
                : (
                  <div key={item.msg.id}
                    ref={el => (msgRefs.current[item.msg.id] = el)}
                    className={highlightId === item.msg.id ? "msg-hl" : ""}>
                    <MessageBubble
                      message={item.msg}
                      isOwn={item.msg.sender === currentUser}
                      currentUser={currentUser}
                      onlineUsers={ws.onlineUsers}
                      prevMessage={item.prev}
                      onDelete={ws.deleteMessage}
                      onEdit={ws.editMessage}
                      onReact={ws.reactToMessage}
                      onPin={ws.pinMessage}
                      onReply={setReplyTo}
                      onMarkSeen={ws.markSeen}
                      onJump={jumpToMessage}
                      onImagePreview={setPreviewSrc}
                    />
                  </div>
                )
            )}

            {/* Typing */}
            {typingList.length > 0 && (
              <div className="flex items-center gap-2.5 mt-3 mb-1 px-1">
                <div className="flex -space-x-2">
                  {typingList.slice(0,3).map(u => <Avatar key={u} name={u} size={24}/>)}
                </div>
                <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-bl-md"
                  style={{ background:"var(--bg3)", border:"1px solid var(--border)" }}>
                  {[1,2,3].map(i => (
                    <div key={i} className={`dot${i} w-1.5 h-1.5 rounded-full`}
                      style={{ background:"var(--text3)" }}/>
                  ))}
                </div>
                <span className="text-xs" style={{ color:"var(--text3)" }}>
                  {typingList.length === 1 ? `${typingList[0]} is typing` : `${typingList.length} typing`}
                </span>
              </div>
            )}

            <div style={{ height:8 }}/>
          </div>

          {/* Scroll-to-bottom FAB */}
          {!atBottom && (
            <button onClick={scrollToBottom}
              className="badge absolute right-5 bottom-28 w-9 h-9 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              style={{ background:"var(--accent)", color:"var(--bg)", zIndex:10 }}>
              {unread > 0
                ? <span className="text-xs font-bold" style={{ fontFamily:"'Syne',sans-serif" }}>
                    {unread > 99 ? "99+" : unread}
                  </span>
                : <MdKeyboardArrowDown size={22}/>
              }
            </button>
          )}

          {/* ── INPUT AREA ─────────────────────────────────────── */}
          <div className="shrink-0 px-4 pb-4 pt-2"
            style={{ background:"var(--bg)", borderTop:"1px solid var(--border)" }}>

            {/* Reply strip */}
            {replyTo && (
              <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl fade-up"
                style={{ background:"var(--surface)", borderLeft:`3px solid ${userColor(replyTo.sender)}` }}>
                <MdReply size={16} style={{ color:userColor(replyTo.sender), flexShrink:0 }}/>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color:userColor(replyTo.sender) }}>{replyTo.sender}</p>
                  <p className="text-xs truncate" style={{ color:"var(--text3)" }}>{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} style={{ color:"var(--text3)", flexShrink:0 }}>
                  <MdClose size={15}/>
                </button>
              </div>
            )}

            {/* File preview */}
            {file && (
              <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl fade-up"
                style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background:"var(--bg3)" }}>
                  {file.type.startsWith("image/")
                    ? <img src={URL.createObjectURL(file)} className="w-full h-full object-cover"/>
                    : <MdInsertDriveFile size={22} style={{ color:"var(--text3)" }}/>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color:"var(--text)" }}>{file.name}</p>
                  <p className="text-xs" style={{ color:"var(--text3)" }}>{formatFileSize(file.size)}</p>
                </div>
                <button onClick={() => setFile(null)} style={{ color:"var(--text3)" }}>
                  <MdClose size={18}/>
                </button>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">
              <button onClick={() => fileRef.current.click()}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:opacity-70 transition"
                style={{ background:"var(--surface)", color:"var(--text3)", border:"1px solid var(--border)" }}>
                <MdAttachFile size={19}/>
              </button>
              <input type="file" ref={fileRef} hidden onChange={e => setFile(e.target.files[0])}/>

              <div className="flex-1 relative">
                <textarea
                  rows={1}
                  value={input}
                  onChange={handleTyping}
                  onKeyDown={e => { if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleSend(); }}}
                  placeholder={replyTo ? `Reply to ${replyTo.sender}…` : "Message…"}
                  className="w-full text-sm resize-none rounded-xl px-4 py-2.5 focus:outline-none transition"
                  style={{
                    background:"var(--surface)",
                    border: overLimit ? "1px solid var(--red)" : "1px solid var(--border)",
                    color:"var(--text)",
                    lineHeight:1.5,
                    maxHeight:120,
                    boxShadow: "none",
                    fontFamily:"'Nunito',sans-serif",
                  }}/>
                {/* Character counter */}
                {charCount > MAX_CHARS * 0.75 && (
                  <span className={`absolute right-3 bottom-2.5 text-[10px] font-bold ${overLimit ? "cc-over" : "cc-warn"}`}
                    style={{ fontFamily:"monospace" }}>
                    {MAX_CHARS - charCount}
                  </span>
                )}
              </div>

              <button onClick={handleSend} disabled={uploading || overLimit || (!input.trim() && !file)}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95"
                style={{
                  background: (input.trim() || file) && !uploading && !overLimit ? "var(--accent)" : "var(--surface)",
                  color: (input.trim() || file) && !uploading && !overLimit ? "var(--bg)" : "var(--text3)",
                  border:"1px solid var(--border)",
                  boxShadow: (input.trim()||file) && !uploading && !overLimit ? "0 4px 16px rgba(245,166,35,.3)" : "none",
                }}>
                {uploading
                  ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"/>
                  : <MdSend size={18}/>
                }
              </button>
            </div>

            {/* Hint */}
            <p className="text-center mt-1.5 text-[10px]" style={{ color:"var(--text3)" }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* ── SIDEBAR ────────────────────────────────────────────── */}
        {sideTab && (
          <div className="shrink-0 p-3 pl-0" style={{ background:"var(--bg)" }}>
            <Sidebar
              tab={sideTab}
              roomId={roomId}
              onlineUsers={ws.onlineUsers}
              onClose={() => setSideTab(null)}
              onJump={jumpToMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage1;
