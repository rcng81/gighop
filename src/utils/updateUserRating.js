import { doc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const updateUserRating = async (userId) => {
  try {
    const historyRef = collection(db, 'users', userId, 'job_history');
    const snapshot = await getDocs(historyRef);
    const ratings = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (typeof data.rating === 'number') {
        ratings.push(data.rating);
      }
    });

    const ratingCount = ratings.length;
    const averageRating = ratingCount > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratingCount
      : 0;

    await updateDoc(doc(db, 'users', userId), {
      ratingCount,
      averageRating
    });

    console.log(`✅ Updated user ${userId} with averageRating ${averageRating} and ratingCount ${ratingCount}`);
  } catch (error) {
    console.error('🔥 Failed to update user rating:', error);
  }
};
