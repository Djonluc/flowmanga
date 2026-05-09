import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TrackerState {
  anilistToken: string | null;
  malToken: string | null;
  
  // User info cache
  anilistUser: { id: number; name: string; avatar: string } | null;
  malUser: { id: number; name: string; picture: string } | null;

  setAnilistToken: (token: string | null) => void;
  setMalToken: (token: string | null) => void;
  setAnilistUser: (user: { id: number; name: string; avatar: string } | null) => void;
  setMalUser: (user: { id: number; name: string; picture: string } | null) => void;
  fetchAnilistUser: () => Promise<void>;
}

export const useTrackerStore = create<TrackerState>()(
  persist(
    (set, get) => ({
      anilistToken: null,
      malToken: null,
      anilistUser: null,
      malUser: null,

      setAnilistToken: (token) => {
          set({ anilistToken: token });
          if (token) get().fetchAnilistUser();
          else set({ anilistUser: null });
      },
      setMalToken: (token) => set({ malToken: token }),
      setAnilistUser: (user) => set({ anilistUser: user }),
      setMalUser: (user) => set({ malUser: user }),

      fetchAnilistUser: async () => {
          const { anilistToken } = get();
          if (!anilistToken) return;

          try {
              const query = `
              query {
                  Viewer {
                      id
                      name
                      avatar {
                          large
                      }
                  }
              }
              `;

              const response = await fetch('https://graphql.anilist.co', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': `Bearer ${anilistToken}`
                  },
                  body: JSON.stringify({ query })
              });

              const data = await response.json();
              if (data.data?.Viewer) {
                  set({ anilistUser: {
                      id: data.data.Viewer.id,
                      name: data.data.Viewer.name,
                      avatar: data.data.Viewer.avatar.large
                  }});
              } else {
                  console.error('Anilist Auth Failed', data);
                  alert('Failed to connect to Anilist. Check your token.');
                  set({ anilistToken: null, anilistUser: null });
              }
          } catch (e) {
              console.error(e);
          }
      }
    }),
    {
      name: 'flowmanga-trackers',
    }
  )
);
