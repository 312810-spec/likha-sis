import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Hook to fetch the current user's profile from the Firestore `users` collection.
 * @param {object|null} user - The current Firebase Auth user object.
 * @returns {{ profile: object|null, loading: boolean, error: Error|null }}
 */
export function useUserProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchProfile() {
      if (!user?.uid) {
        if (isMounted) {
          setProfile(null);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (isMounted) {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            setProfile(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  return { profile, loading, error };
}

export default useUserProfile;
