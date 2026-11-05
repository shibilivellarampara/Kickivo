import { 
  collection, 
  doc, 
  getDocs, 
  writeBatch, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Permanently deletes a tournament and ALL of its associated child collections:
 * - Teams & their player rosters
 * - Matches & their event logs
 * - Standings tables
 * - Parent tournament document
 */
export async function deleteTournamentCascading(tournamentId: string): Promise<void> {
  if (!tournamentId) return;

  // 1. Fetch & delete all teams and their player rosters
  try {
    const teamsSnap = await getDocs(collection(db, `tournaments/${tournamentId}/teams`));
    for (const teamDoc of teamsSnap.docs) {
      // Delete players subcollection for this team
      const playersSnap = await getDocs(collection(db, `tournaments/${tournamentId}/teams/${teamDoc.id}/players`));
      if (!playersSnap.empty) {
        let playerBatch = writeBatch(db);
        let pCount = 0;
        for (const p of playersSnap.docs) {
          playerBatch.delete(p.ref);
          pCount++;
          if (pCount % 400 === 0) {
            await playerBatch.commit();
            playerBatch = writeBatch(db);
          }
        }
        if (pCount % 400 !== 0) {
          await playerBatch.commit();
        }
      }
      // Delete the team document itself
      await deleteDoc(teamDoc.ref);
    }
  } catch (err) {
    console.warn(`Error deleting teams for tournament ${tournamentId}:`, err);
  }

  // 2. Fetch & delete all matches and their events
  try {
    const matchesSnap = await getDocs(collection(db, `tournaments/${tournamentId}/matches`));
    for (const matchDoc of matchesSnap.docs) {
      const eventsSnap = await getDocs(collection(db, `tournaments/${tournamentId}/matches/${matchDoc.id}/events`));
      if (!eventsSnap.empty) {
        let eventBatch = writeBatch(db);
        let eCount = 0;
        for (const ev of eventsSnap.docs) {
          eventBatch.delete(ev.ref);
          eCount++;
          if (eCount % 400 === 0) {
            await eventBatch.commit();
            eventBatch = writeBatch(db);
          }
        }
        if (eCount % 400 !== 0) {
          await eventBatch.commit();
        }
      }
      await deleteDoc(matchDoc.ref);
    }
  } catch (err) {
    console.warn(`Error deleting matches for tournament ${tournamentId}:`, err);
  }

  // 3. Fetch & delete standings
  try {
    const standingsSnap = await getDocs(collection(db, `tournaments/${tournamentId}/standings`));
    if (!standingsSnap.empty) {
      let stBatch = writeBatch(db);
      for (const st of standingsSnap.docs) {
        stBatch.delete(st.ref);
      }
      await stBatch.commit();
    }
  } catch (err) {
    console.warn(`Error deleting standings for tournament ${tournamentId}:`, err);
  }

  // 4. Finally delete the tournament document
  await deleteDoc(doc(db, 'tournaments', tournamentId));
}
