import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/*
Accept chatId and currentUserId

Check if the chat already has the current user in deletedFor

Add them if not

If both participants are in deletedFor, delete the document entirely (hard delete)
*/

export const deleteChat = async (chatId, currentUserId) => {
  try {
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) return;

    const chatData = chatSnap.data();
    const deletedFor = chatData.deletedFor || [];

    if (!deletedFor.includes(currentUserId)) {
      deletedFor.push(currentUserId);
      await updateDoc(chatRef, { deletedFor });

      // Hard delete if all participants removed it:
      if (
        deletedFor.length >= 2 &&
        chatData.participants.every(uid => deletedFor.includes(uid))
      ) {
        // Delete messages subcollection
        const messagesRef = collection(db, "chats", chatId, "messages");
        const messagesSnap = await getDocs(messagesRef);

        const deletePromises = messagesSnap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        //  Now delete the chat doc:
        await deleteDoc(chatRef);
      }
    }
  } catch (error) {
    console.error("Failed to delete chat:", error);
  }
};
