/**
 * ONE place that decides which vector icon means what across Allyza.
 * Lucide is the primary (and, today, only) icon family: change a glyph here and it changes everywhere.
 * Each icon is imported by name so the bundler can tree-shake the rest of the library.
 */
import {
  Activity, Apple, Bean, Bell, BedDouble, BookHeart, BookOpen, Brush, CakeSlice, CalendarDays,
  CalendarHeart, Camera, Carrot, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock,
  Cloud, CloudRain, CupSoda, Download, Droplet, Drumstick, Eye, EyeOff, Feather, Flame, Flower2,
  Gamepad2, GlassWater, Gift, Frown, Annoyed, Meh, Smile, Laugh, SmilePlus, Heart, HeartHandshake,
  Hourglass, House, ImagePlus, Infinity as InfinityIcon, Info, KeyRound, Languages, Layers, Leaf, Lock,
  LockOpen, LogOut, Mail, MailOpen, MapPin, MessageCircle, Milestone, Moon, Mountain, Music2, Palette,
  Pause, Pencil, Piano, Play, Plus, Quote, Send, Settings, Shield, ShieldCheck, Sparkles, Star, Stars,
  Sun, Sunrise, Target, Trash2, Trees, TriangleAlert, Utensils, Waves, Wheat, Wind, X, ExternalLink,
  Circle, Puzzle, Copy, ArrowRight, Volume2, Square,
} from "lucide-react";

export const ICONS = {
  // navigation
  home: House, her: Flower2, refuge: Moon, us: Heart, settings: Settings,
  back: ChevronLeft, forward: ChevronRight, down: ChevronDown, arrowRight: ArrowRight,
  // actions
  close: X, check: Check, plus: Plus, trash: Trash2, edit: Pencil, send: Send, camera: Camera,
  addImage: ImagePlus, copy: Copy, eye: Eye, eyeOff: EyeOff, download: Download, external: ExternalLink,
  play: Play, pause: Pause, stop: Square, volume: Volume2,
  // security & settings
  lock: Lock, unlock: LockOpen, key: KeyRound, shield: ShieldCheck, privacy: Shield, bell: Bell,
  language: Languages, logout: LogOut, palette: Palette, info: Info, warn: TriangleAlert,
  // her space
  cycle: CalendarHeart, calendar: CalendarDays, wellbeing: Leaf, food: Apple, history: BookOpen,
  stats: Activity, drop: Droplet, hydration: GlassWater,
  // refuge
  soft: Flower2, games: Gamepad2, atmosphere: CloudRain, poetry: Feather, breathe: Wind,
  little: Sparkles, calm: Wind, distract: Gamepad2, love: HeartHandshake, read: BookOpen,
  musicNote: Music2,
  // couple
  journal: BookHeart, memories: Camera, story: Milestone, universe: Stars, vault: KeyRound,
  surprise: Gift, mail: Mail, mailOpen: MailOpen, message: MessageCircle, jokes: Laugh, song: Music2,
  star: Star, sparkles: Sparkles, clock: Clock, place: MapPin,
  // atmosphere sounds
  rain: CloudRain, ocean: Waves, forest: Trees, fire: Flame, piano: Piano, white: Cloud, cloud: Cloud,
  // games
  petals: Flower2, bubbles: Circle, memory: Puzzle, zen: Mountain, clouds: Cloud, stars: Star, glow: Brush,
  // time of day
  sun: Sun, sunrise: Sunrise, moon: Moon, night: BedDouble,
  // mood scale (1 → 5)
  mood1: Frown, mood2: Annoyed, mood3: Meh, mood4: Smile, mood5: Laugh,
  // "how are you, really?"
  ciGood: SmilePlus, ciOk: Smile, ciTired: BedDouble, ciLove: HeartHandshake,
  // food categories
  fruit: Apple, vegetables: Carrot, protein: Drumstick, legumes: Bean, whole_grains: Wheat,
  water: GlassWater, sweet_foods: CakeSlice, sugary_drinks: CupSoda, other: Utensils,
  // little things
  compliment: Flower2, note: Mail, question: CircleHelp, date_idea: MapPin, challenge: Target, hidden: Lock,
  // surprise kinds & unlock conditions
  encouragement: Sun, funny: Laugh, memoryKind: Camera,
  anytime: InfinityIcon, miss_me: HeartHandshake, hard_day: Cloud, need_smile: Smile,
  tonight: Moon, tomorrow: Sunrise, date: CalendarHeart,
  // story emotions & inside-joke kinds
  joy: Sun, laugh: Laugh, tender: Feather, nostalgia: Hourglass, wonder: Sparkles,
  joke: Laugh, nickname: Heart, phrase: MessageCircle, quote: Quote, moment: Sparkles,
  layers: Layers,
} as const;

export type IconName = keyof typeof ICONS;
