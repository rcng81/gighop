import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

export async function startConversation(
    currentUserId, 
    otherUserId,
    jobTitle,
    currentUserFirst,
    currentUserLast,
    otherUserFirst,
    otherUserLast
) {
    // format of chat title:
    const formattedTitle = `${jobTitle} (${currentUserFirst} ${currentUserLast?.[0] || ''}. & ${otherUserFirst} ${otherUserLast?.[0] || ''}.)`;

    // Getting chats collection:
    const chatsRef = collection(db, 'chats');
    const q = query(
        chatsRef,
        where('participants', 'array-contains', currentUserId)
    );
    const querySnapshot = await getDocs(q);

    let existingChatId = null;

    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const participants = data.participants || [];
        if (
            participants.length === 2 &&
            participants.includes(currentUserId) &&
            participants.includes(otherUserId)
        ) {
            existingChatId = docSnap.id;

            // ✅ Restore from deletedFor if needed
            if (data.deletedFor?.includes(currentUserId)) {
                const updatedDeletedFor = data.deletedFor.filter(id => id !== currentUserId);
                await updateDoc(docSnap.ref, { deletedFor: updatedDeletedFor });
            }

            break;
        }
    }

    if (existingChatId) {
        return existingChatId;
    } else {
        const newChatDoc = await addDoc(chatsRef, {
            participants: [currentUserId, otherUserId],
            participantNames: {
                [currentUserId]: `${currentUserFirst} ${currentUserLast}`,
                [otherUserId]: `${otherUserFirst} ${otherUserLast}`,
            },
            title: formattedTitle,
            createdAt: new Date(),
            lastMessage: ""
        });
        
        return newChatDoc.id;
    }
}
