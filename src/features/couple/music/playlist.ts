/**
 * Songs that come with Allyza. Only title + artist are stored: nothing here is a link that could go stale.
 * "Listen" opens a search on the streaming service of your choice, so it always finds the right track.
 */
export type PlaylistSong = { title: string; artist: string };

/** Chosen by the two of you. */
export const OUR_SONGS: PlaylistSong[] = [
  { artist: "Justin Bieber", title: "Mistletoe" },
  { artist: "Maejor", title: "I Love You" },
  { artist: "Post Malone", title: "You’re So Beautiful" },
  { artist: "Tatiana Manaois", title: "Strings on My Guitar" },
];

/** Other songs that fit the mood of Allyza: tender, warm, a little moonlit. */
export const IDEA_SONGS: PlaylistSong[] = [
  { artist: "Ed Sheeran", title: "Perfect" },
  { artist: "John Legend", title: "All of Me" },
  { artist: "Christina Perri", title: "A Thousand Years" },
  { artist: "Bruno Mars", title: "Just the Way You Are" },
  { artist: "Bruno Mars", title: "Talking to the Moon" },
  { artist: "Ben E. King", title: "Stand By Me" },
  { artist: "Elvis Presley", title: "Can’t Help Falling in Love" },
  { artist: "Jason Mraz", title: "I’m Yours" },
  { artist: "Adele", title: "Make You Feel My Love" },
  { artist: "Frank Sinatra", title: "Fly Me to the Moon" },
  { artist: "Etta James", title: "At Last" },
  { artist: "Justin Bieber", title: "Peaches" },
  { artist: "Lauv", title: "I Like Me Better" },
  { artist: "The Weeknd", title: "Die for You" },
  { artist: "Alicia Keys", title: "If I Ain’t Got You" },
  { artist: "Amadou & Mariam", title: "Je pense à toi" },
  { artist: "Salif Keita", title: "Madan" },
  { artist: "Francis Cabrel", title: "Je l’aime à mourir" },
  { artist: "Édith Piaf", title: "La Vie en rose" },
  { artist: "Céline Dion", title: "Pour que tu m’aimes encore" },
  { artist: "Calogero", title: "En apesanteur" },
];

const q = (s: PlaylistSong) => encodeURIComponent(`${s.artist} ${s.title}`);
export const youtubeSearch = (s: PlaylistSong) => `https://www.youtube.com/results?search_query=${q(s)}`;
export const spotifySearch = (s: PlaylistSong) => `https://open.spotify.com/search/${q(s)}`;
