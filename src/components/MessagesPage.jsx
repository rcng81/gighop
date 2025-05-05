import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from "../firebase";
import { addDoc, doc, getDoc, getDocs, collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import UsrIcon from '../assets/usrIcon.png';
import { deleteChat } from '../utils/deleteChat';

const MessagesPage = () => {
   const [activeChatId, setActiveChatId] = useState(null);
   const [newMessage, setNewMessage] = useState("");
   const [chatList, setChatList] = useState([]);
   const [messages, setMessages] = useState([]);
   const messagesEndRef = useRef(null);
   const { chatId } = useParams();
   const [currentUser, setCurrentUser] = useState(null);
   const [hasNotification, setHasNotification] = useState(false);
   const [chatListExpanded, setChatListExpanded] = useState(true);
   const [communitiesExpanded, setCommunitiesExpanded] = useState(false);
   const [myCommunities, setMyCommunities] = useState([]);

   // FUNCTIONS:
   const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
   };
   
   const navigate = useNavigate();
   
   // HOOKS:
   // automatically scroll to the most recent message:
   useEffect(() => {
      if (activeChatId && messages.length > 0) {
         scrollToBottom();
      }
   }, [messages, activeChatId]);

   // activeChatId is automatically set and the messages for that chat are fetched immediately:
   useEffect(() => {
      if (chatId) {
        setActiveChatId(chatId);
      }
   }, [chatId]);

   // fetch the messages from each chat:
   useEffect(() => {
      if (!activeChatId) return;

      const messagesRef = collection(db, "chats", activeChatId, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
         const fetchedMessages = [];
         querySnapshot.forEach((doc) => {
            fetchedMessages.push({ id: doc.id, ...doc.data() });
         });
         
         setMessages(fetchedMessages);
      });

      return () => unsubscribe();
   }, [activeChatId]);

   // Get current user:
   useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
         if (user) {
            setCurrentUser(user);
         }
      });
      return () => unsubscribe();
   }, []);

   // fetch chats from FireStore (only those the current user is a participant of):
   useEffect(() => {
      if (!currentUser) return;

      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("participants", "array-contains", currentUser.uid));

      const unsubscribe = onSnapshot(q, (snapshot) => {
         const chats = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
         }));
         setChatList(chats);
      });

      return () => unsubscribe();
   }, [currentUser]);    

   // display notification on user icon:
   useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
         if (user) {
            setCurrentUser(user);
            const notifSnap = await getDocs(collection(db, "users", user.uid, "notifications"));
            const hasUnread = notifSnap.docs.some(doc => doc.data().read === false);
            setHasNotification(hasUnread);
         }
      });
      return () => unsubscribe();
   }, []);

   // fetch communities current user is a memebr of (using the id of the currentUser):
   useEffect(() => {
      if (!currentUser) return;
      
      const fetchUserCommunities = async () => {
         const userCommRef = collection(db, "users", currentUser.uid, "user_communities");
         const snapshot = await getDocs(userCommRef);
         
         const communityRefs = snapshot.docs.map(doc => doc.id);
         
         const communityPromises = communityRefs.map(async (id) => {
            const commDoc = await getDoc(doc(db, "communities", id));
            return { id, ...commDoc.data() };
         });
         
         const fullData = await Promise.all(communityPromises);
         const validCommunities = fullData.filter(comm => comm && comm.name);
         setMyCommunities(validCommunities);
      };
       
      
      fetchUserCommunities();
   }, [currentUser]);
    
   // RETURN:
   return (
      <div className="d-flex" style={{ height: "100vh" }}>
         {/* Sidebar */}
         <div className="bg-white d-flex flex-column shadow p-3 border-end" style={{ width: "300px", overflowY: "auto" }}>
            <h5 className="p-3 border-bottom">Chats</h5>

            {/*Chat List */}
            {/* Collapse chats */}
            <div className="d-flex justify-content-between align-items-center mb-2">
               <h6 className="mb-0">Chats</h6>
               <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setChatListExpanded(!chatListExpanded)}
               >
                  {chatListExpanded ? "▲" : "▼"}
               </button>
            </div>

            <div
               style={{
                  maxHeight: chatListExpanded ? "300px" : "0",
                  overflowY: "auto",
                  transition: "max-height 0.3s ease",
               }}
            >
               {chatList
               .filter(chat => !chat.deletedFor?.includes(currentUser?.uid))
               .map((chat) => (
                  <div
                     key={chat.id}
                     className={`p-3 border-bottom chat-item d-flex justify-content-between align-items-center ${
                        chat.id === activeChatId ? 'bg-light' : ''
                     }`}
                     style={{ cursor: "pointer" }}
                  >
                     <span onClick={() => {
                        setActiveChatId(chat.id);
                        navigate(`/messages/${chat.id}`);
                     }}>
                        {Object.values(chat.participantNames || {})
                           .filter(name => name !== currentUser?.displayName)
                           .sort()
                           .join(" and ") || "Unnamed Chat"}
                     </span>

                     <button
                     className="btn btn-sm btn-outline-danger"
                     onClick={async (e) => {
                        e.stopPropagation(); // prevent triggering setActiveChatId
                        await deleteChat(chat.id, currentUser.uid);
                        
                        const remainingChats = chatList.filter(
                           c => c.id !== chat.id && !c.deletedFor?.includes(currentUser.uid)
                        );

                        if (remainingChats.length > 0) {
                           const nextChatId = remainingChats[0].id;
                           setActiveChatId(nextChatId);
                           navigate(`/messages/${nextChatId}`);
                        } else {
                           setActiveChatId(null);
                           navigate('/community');
                        }
                     }}
                     >
                        🗑️
                     </button>
                  </div>
               ))}
            </div>

            {/* My Communities List */}
            <div className="mt-4">
               <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">My Communities</h6>
                  <button
                     className="btn btn-sm btn-outline-secondary"
                     onClick={() => setCommunitiesExpanded(!communitiesExpanded)}
                  >
                     {communitiesExpanded ? "▲" : "▼"}
                  </button>
               </div>

               <div
                  style={{
                     maxHeight: communitiesExpanded ? "300px" : "0",
                     overflowY: "auto",
                     transition: "max-height 0.3s ease",
                  }}
               >
                  <ul className="list-unstyled">
                     {myCommunities.map(comm => (
                        <li key={comm.id} className="mb-2 text-center">
                           <button
                              className="btn btn-sm btn-outline-dark w-100"
                              onClick={() => navigate(`/community/${comm.id}`)}
                           >
                              {comm.name}
                           </button>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>

            {/*User Profile Icon*/}
            <div 
               className="text-center mt-auto pt-4 border-top position-relative" 
               onClick={() => navigate('/edit-profile')} 
               style={{ cursor: 'pointer' }}
            >
               <img src={UsrIcon} alt="User Icon" className="img-fluid rounded-circle mb-2" width="60" />

               {/* Notification Dot */}
               {hasNotification && (
                  <span 
                     style={{
                     position: "absolute",
                     top: "10px",
                     right: "calc(50% - 15px)",
                     backgroundColor: "red",
                     width: "12px",
                     height: "12px",
                     borderRadius: "50%",
                     border: "2px solid white"
                     }}
                  ></span>
               )}

               <p className="mb-0">{currentUser?.displayName || "User"}</p>
            </div>
         </div>

         {/* Main Chat Window */}
         {activeChatId ? (
            <div className="d-flex flex-column h-100 p-4" style={{ flex: 1, maxWidth: "800px", margin: "0 auto" }}>
               {/* Messages Area */}
               <div className="flex-grow-1 overflow-auto mb-3">
                  {messages.map((msg) => (
                     <div
                        key={msg.id || msg.timestamp} // fallback if no msg.id
                        className={
                           `d-flex flex-column 
                           ${msg.senderId === currentUser?.uid 
                              ? "align-items-end" 
                              : "align-items-start"
                           } 
                           mb-2`
                        }
                     >
                        {/* message sender name display: */}
                        <small className="text-muted mb-1">
                           <strong>
                              {chatList.find(c => c.id === activeChatId)?.participantNames?.[msg.senderId] || "User"}
                           </strong>
                        </small>
                        
                        {/* message text: */}
                        <div
                           className={`p-2 rounded ${msg.senderId === currentUser?.uid ? "bg-primary text-white" : "bg-light"}`}
                           style={{ maxWidth: "70%" }}
                        >
                           {msg.text}
                        </div>
                     </div>
                  ))}

                  {/* Invisible Div (self ends) used as target to scroll to */}
                  <div ref={messagesEndRef} />
               </div>
               
               {/* Input Area */}
               <form
                  className="d-flex mt-autp pt-3 mb-4"
                  onSubmit={async (e) => {
                     e.preventDefault();
                     if (newMessage.trim() === "") return;

                     const messagesRef = collection(db, "chats", activeChatId, "messages");

                     await addDoc(messagesRef, {
                        text: newMessage,
                        senderId: auth.currentUser.uid,
                        timestamp: new Date()
                     });

                     setNewMessage("");
                  }}
               >
                  <input
                     type="text"
                     className="form-control me-2"
                     placeholder="Type a message..."
                     value={newMessage}
                     onChange={(e) => setNewMessage(e.target.value)}
                  />

                  <button className="btn btn-primary" type="submit">
                     Send
                  </button>
               </form>
            </div>
         ) : (
            <div className="text-muted d-flex align-items-center justify-content-center w-100">
               Select a chat to start messaging
            </div>
         )}
      </div>
   );
};

export default MessagesPage;
