import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { db, auth, messaging } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, getDocs, addDoc, Timestamp, updateDoc, deleteDoc, getDocFromServer, or, and, orderBy, limit, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { 
  onAuthStateChanged, 
  signInWithPhoneNumber, 
  RecaptchaVerifier, 
  ConfirmationResult,
  User as FirebaseUser,
  signOut
} from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Users, Bell, User, LogOut, Search, Filter, Check, X, Send, Mail, Phone, MapPin, GraduationCap, Code, Briefcase, Plus, Globe, ShieldAlert, Ban, Eye, Flame, ArrowRight, Lightbulb, Rocket, ArrowLeft, UserPlus, UserCheck, Clock, Target, Layers } from 'lucide-react';
import { cn } from './lib/utils';
import { UserProfile, ConnectionRequest, UserRole, RequestStatus, UserLevel, Project, ProjectRequest } from './types';

// --- Constants & Data ---

const PROJECT_IDEAS = [
  { title: "AI-Powered Resume Builder", description: "Build a tool that uses AI to suggest improvements and tailor resumes for specific job descriptions." },
  { title: "Decentralized Voting System", description: "Create a secure, transparent voting platform using blockchain technology for student elections." },
  { title: "Real-time Collaborative Code Editor", description: "A web-based editor where multiple users can code together in real-time with syntax highlighting." },
  { title: "Smart Home Automation Hub", description: "Develop a dashboard to control IoT devices like lights, thermostats, and security cameras from one place." },
  { title: "E-commerce for Local Artisans", description: "A platform dedicated to helping local craftsmen sell their unique products to a wider audience." },
  { title: "Mental Health Tracking App", description: "An app for users to log their daily moods, activities, and get personalized wellness tips." },
  { title: "Gamified Fitness Tracker", description: "Turn fitness into a game where users earn rewards and compete with friends for daily steps." },
  { title: "Blockchain Supply Chain Tracker", description: "Track the journey of products from origin to consumer to ensure authenticity and ethical sourcing." },
  { title: "Virtual Reality Museum Tour", description: "An immersive experience that lets users explore famous museums and artifacts from their browser." },
  { title: "Language Learning Chatbot", description: "An AI chatbot that helps users practice conversational skills in a new language through daily prompts." },
  { title: "Sustainable Recipe Finder", description: "A recipe app that prioritizes seasonal, local ingredients and suggests eco-friendly alternatives." },
  { title: "Remote Team Management Tool", description: "A comprehensive dashboard for remote teams to manage tasks, schedules, and virtual meetings." },
  { title: "Personal Finance Dashboard", description: "A tool to track expenses, set savings goals, and visualize spending habits with interactive charts." },
  { title: "Automated Plant Watering System", description: "An IoT project that monitors soil moisture and automatically waters plants when needed." },
  { title: "Community Lost and Found", description: "A localized platform for neighbors to report and find lost items using geo-tagging." },
  { title: "AR Interior Design App", description: "Use augmented reality to visualize how furniture and decor would look in your actual room." },
  { title: "Peer-to-peer Skill Sharing", description: "A marketplace where users can trade skills (e.g., coding for guitar lessons) without money." },
  { title: "AI Content Summarizer", description: "A tool that takes long articles or videos and generates concise, bulleted summaries." },
  { title: "Smart Parking Management", description: "A system that uses sensors to show real-time availability of parking spots in a city." },
  { title: "Crowdsourced Disaster Relief", description: "A map-based platform for people to report needs and offer help during natural disasters." }
];

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || undefined,
      email: auth.currentUser?.email || undefined,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

// --- Contexts ---
const AuthContext = createContext<{
  user: UserProfile | null;
  blockedUsers: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<ConfirmationResult>;
  verifyOtp: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
  register: (profile: Omit<UserProfile, 'uid' | 'id'>) => Promise<void>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
} | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

function getSkillsArray(skills: any): string[] {
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'string') return skills.split(',').map(s => s.trim()).filter(s => s !== '');
  return [];
}

// --- Notification Trigger Helper ---
const triggerNotification = async (userId: string, title: string, body: string, type: 'join' | 'request' | 'acceptance' | 'accept' | 'reject') => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      body,
      message: body, // Map body to message as requested
      type,
      timestamp: Date.now(),
      read: false
    });
    console.log("Notification created");
  } catch (error) {
    console.error("Error triggering notification:", error);
  }
};

// --- Logo & Assets ---

const TeamUpLogo = ({ size = 80, className = "" }: { size?: number, className?: string }) => (
  <div 
    className={cn("rounded-[28%] flex items-center justify-center overflow-hidden", className)}
    style={{ 
      width: size, 
      height: size,
      background: 'linear-gradient(135deg, #6C5CE7 0%, #8E7CFF 100%)'
    }}
  >
    <svg 
      width={size * 0.6} 
      height={size * 0.6} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path 
        d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M17 11C19.2091 11 21 9.20914 21 7C21 4.79086 19.2091 3 17 3C14.7909 3 13 4.79086 13 7C13 9.20914 14.7909 11 17 11Z" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M23 21V19C22.9993 18.1137 22.7044 17.2522 22.1614 16.5523C21.6184 15.8524 20.8581 15.3516 20 15.13" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #8E7CFF 100%)' }}
    >
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-[28%] flex items-center justify-center mb-8 shadow-2xl shadow-indigo-900/20"
        >
          <svg 
            width="56" 
            height="56" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M16 21V19C16 17.9391 15.5786 16.9217 14.8284 16.1716C14.0783 15.4214 13.0609 15 12 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M17 11C19.2091 11 21 9.20914 21 7C21 4.79086 19.2091 3 17 3C14.7909 3 13 4.79086 13 7C13 9.20914 14.7909 11 17 11Z" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M23 21V19C22.9993 18.1137 22.7044 17.2522 22.1614 16.5523C21.6184 15.8524 20.8581 15.3516 20 15.13" 
              stroke="white" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-5xl font-black text-white tracking-tighter"
        >
          TeamUp
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-white/80 mt-4 font-bold text-lg tracking-tight"
        >
          Find Your Team. Build Faster.
        </motion.p>
      </div>
    </motion.div>
  );
};

// --- Components ---

const Toast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className={cn(
      "fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-50 text-white font-medium flex items-center gap-2",
      type === 'success' ? "bg-emerald-500" : "bg-rose-500"
    )}
  >
    {type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
    {message}
  </motion.div>
);

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    // Listen for pending requests where user is receiver
    const requestsQuery = query(
      collection(db, 'requests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to requests:", error);
    });

    // Listen for unread notifications
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      setNotificationsCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to notifications:", error);
    });

    return () => {
      unsubscribeRequests();
      unsubscribeNotifications();
    };
  }, [user?.uid]);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/projects', icon: Rocket, label: 'Projects' },
    { path: '/network', icon: Globe, label: 'Network' },
    { path: '/requests', icon: Users, label: 'Requests', badge: pendingRequestsCount },
    { path: '/notifications', icon: Bell, label: 'Alerts', badge: notificationsCount },
    { path: '/profile', icon: User, label: 'Profile', dot: pendingRequestsCount > 0 || notificationsCount > 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-40 max-w-md mx-auto shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors relative",
              isActive ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <div className="relative">
              <item.icon className={cn("w-6 h-6", isActive && "fill-indigo-50")} />
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                  {item.badge}
                </span>
              )}
              {item.dot && (
                <span className="absolute top-0 right-0 bg-red-500 w-2 h-2 rounded-full border-2 border-white" />
              )}
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {item.label}
              {item.badge !== undefined && item.badge > 0 && item.label === 'Requests' && ` (${item.badge})`}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

// --- Masking Helpers ---
const maskEmail = (email: string) => {
  if (!email) return "";
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const maskedName = name[0] + "****" + (name.length > 1 ? name[name.length - 1] : "");
  return `${maskedName}@${domain}`;
};

const maskPhone = (phone: string) => {
  if (!phone) return "";
  if (phone.length < 4) return "****";
  return phone.substring(0, 2) + "******" + phone.substring(phone.length - 2);
};

const UserCard = ({ profile, onRequest, isPending, isFromMe, isAccepted }: { 
  profile: UserProfile, 
  onRequest: () => void | Promise<void>, 
  isPending: boolean,
  isFromMe: boolean,
  isAccepted: boolean,
  key?: any
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSelf = user?.uid === profile.uid;
  const canViewContact = isAccepted || isSelf;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => navigate(`/user/${profile.uid}`)}
      className="bg-white rounded-3xl p-6 pr-[60px] shadow-sm border border-gray-100 mb-4 group hover:shadow-md transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden w-full"
    >
      <div className="flex items-start gap-4 mb-4">
        <div 
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-100 shrink-0"
          style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #8E7CFF 100%)' }}
        >
          {profile.name[0]}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors leading-tight">{profile.name}</h3>
          <div className="flex items-center gap-2 text-gray-500 text-[10px] mt-1 font-black uppercase tracking-widest">
            <GraduationCap className="w-3 h-3" />
            <span className="truncate">{profile.education?.level || profile.role || 'Member'}</span>
            {profile.language && (
              <>
                <span className="text-gray-300">•</span>
                <Globe className="w-3 h-3" />
                <span>{profile.language}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-xs mt-1 font-bold">
            <Briefcase className="w-3.5 h-3.5" />
            <span className="truncate">{profile.education?.institution || profile.college || 'No Institution'}</span>
          </div>
        </div>
        <div className="absolute top-2 right-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider max-w-[40%] truncate">
          {profile.education ? `${profile.education.startYear}-${profile.education.endYear}` : profile.year || 'N/A'}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {getSkillsArray(profile.skills).map((skill, idx) => (
          <span key={`${skill}-${idx}`} className="bg-gray-50 text-gray-600 px-3 py-1 rounded-lg text-xs font-medium border border-gray-100">
            {skill}
          </span>
        ))}
      </div>

      {profile.projectTitle && (
        <div className="mb-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Project</p>
          <p className="text-gray-800 font-bold text-sm">{profile.projectTitle}</p>
        </div>
      )}

      {profile.projectDescription && (
        <p className="text-gray-600 text-sm line-clamp-2 mb-4 italic">
          "{profile.projectDescription}"
        </p>
      )}

      {canViewContact ? (
        <div className="flex flex-col gap-2 mb-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Contact Info</p>
          <div className="flex items-center gap-2 text-gray-700 text-sm">
            <Mail className="w-4 h-4 text-emerald-500" />
            <span>{profile.email}</span>
          </div>
          {profile.phone && (
            <div className="flex items-center gap-2 text-gray-700 text-sm">
              <Phone className="w-4 h-4 text-emerald-500" />
              <span>{profile.phone}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 mb-4 p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <div className="flex items-center gap-2 text-gray-400 font-bold text-sm">
            <X className="w-4 h-4" />
            <span>🔒 Connect to view contact</span>
          </div>
          <p className="text-[10px] text-gray-400 uppercase font-medium">Email & Phone Hidden</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
        {isAccepted ? (
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center gap-2 text-emerald-600 font-black text-sm justify-center bg-emerald-50 py-3 rounded-2xl border border-emerald-100">
              <Check className="w-4 h-4" /> Connected ✅
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequest();
            }}
            disabled={isPending}
            className={cn(
              "flex-1 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
              isPending 
                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
            )}
          >
            {isPending ? (
              <>
                <Check className="w-4 h-4" />
                {isFromMe ? "Request Sent" : "Pending Request"}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Team Up
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
};

// --- Pages ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isPhoneLogin, setIsPhoneLogin] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = () => {
    try {
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible"
        });
      }
    } catch (err) {
      console.error("Recaptcha setup error:", err);
      setError("Failed to initialize security check. Please refresh.");
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return setError("Please enter a phone number");
    if (phoneNumber.length < 10) return setError("Please enter a valid phone number");
    
    setLoading(true);
    setError('');
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      const confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, appVerifier);
      (window as any).confirmationResult = confirmationResult;
      setIsOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
      console.error("Phone login error:", err);
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return setError("Please enter OTP");
    setLoading(true);
    setError('');
    try {
      const result = await (window as any).confirmationResult.confirm(otp);
      const firebaseUser = result.user;
      
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            phone: firebaseUser.phoneNumber || '',
            email: '',
            name: 'New User',
            role: 'student',
            course: '',
            year: '',
            college: '',
            region: '',
            language: 'English',
            skills: []
          };
          await setDoc(docRef, newProfile);
        }
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP code");
      console.error("OTP verification error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 max-w-md mx-auto">
      <div id="recaptcha-container"></div>
      <div className="w-full space-y-8">
        <div className="text-center">
          <TeamUpLogo className="mx-auto mb-6 shadow-2xl shadow-indigo-200" />
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">TeamUp</h1>
          <p className="text-gray-500 mt-2">Connect with your future teammates</p>
        </div>

        {error && <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm font-medium border border-rose-100">{error}</div>}

        {!isPhoneLogin ? (
          <>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="hello@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400 font-bold">Or</span></div>
            </div>

            <button
              onClick={() => setIsPhoneLogin(true)}
              className="w-full bg-white border-2 border-gray-100 text-gray-600 py-4 rounded-3xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <Phone className="w-5 h-5" /> Login with Phone
            </button>
          </>
        ) : (
          <div className="space-y-4">
            {!isOtpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-gray-700"
                    >
                      <option value="+91">+91</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                      <option value="+61">+61</option>
                    </select>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="00000 00000"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPhoneLogin(false)}
                  className="w-full text-gray-400 font-bold text-sm hover:text-indigo-600"
                >
                  Back to Email Login
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Verification Code</label>
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all text-center text-2xl tracking-[1em] font-black"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & Login"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="w-full text-gray-400 font-bold text-sm hover:text-indigo-600"
                >
                  Resend OTP / Change Number
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-gray-500 text-sm">
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} className="text-indigo-600 font-bold hover:underline">
            Register now
          </button>
        </p>
      </div>
    </div>
  );
};

const Autocomplete = ({ 
  options, 
  value, 
  onChange, 
  placeholder, 
  icon: Icon,
  isMulti = false
}: { 
  options: string[], 
  value: string, 
  onChange: (val: string) => void, 
  placeholder: string,
  icon?: any,
  isMulti?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);

  useEffect(() => {
    const searchTerm = isMulti 
      ? value.split(',').pop()?.trim().toLowerCase() || ""
      : value.toLowerCase();

    if (searchTerm.length > 0) {
      const f = options.filter(o => 
        o.toLowerCase().includes(searchTerm) && 
        (isMulti ? !value.toLowerCase().includes(o.toLowerCase()) : o.toLowerCase() !== value.toLowerCase())
      );
      setFiltered(f);
      setIsOpen(f.length > 0);
    } else {
      setIsOpen(false);
    }
  }, [value, options, isMulti]);

  return (
    <div className="relative">
      <div className="relative">
        {Icon && <Icon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />}
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            const searchTerm = isMulti ? value.split(',').pop()?.trim().toLowerCase() || "" : value.toLowerCase();
            if (searchTerm.length > 0 && filtered.length > 0) setIsOpen(true);
          }}
          className={cn(
            "w-full bg-gray-50 border-none rounded-2xl py-4 focus:ring-2 focus:ring-indigo-500 transition-all",
            Icon ? "pl-14 pr-6" : "px-6"
          )}
        />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-48 overflow-y-auto"
          >
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (isMulti) {
                    const parts = value.split(',').map(p => p.trim());
                    parts.pop();
                    const newValue = [...parts.filter(p => p !== ""), opt].join(', ') + ', ';
                    onChange(newValue);
                  } else {
                    onChange(opt);
                  }
                  setIsOpen(false);
                }}
                className="w-full text-left px-6 py-3 hover:bg-indigo-50 text-sm font-medium text-gray-700 transition-colors"
              >
                {opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const COLLEGES = [
  "Indian Institute of Technology (IIT)",
  "National Institute of Technology (NIT)",
  "Birla Institute of Technology and Science (BITS)",
  "Delhi Technological University (DTU)",
  "Anna University",
  "Vellore Institute of Technology (VIT)",
  "Manipal Institute of Technology",
  "SRM Institute of Science and Technology",
  "Amity University",
  "Lovely Professional University (LPU)"
];

const SKILLS = [
  "React", "React Native", "Firebase", "TypeScript", "JavaScript", 
  "Python", "Java", "C++", "Node.js", "Express", "MongoDB", 
  "SQL", "AWS", "Docker", "Kubernetes", "UI/UX Design", 
  "Figma", "Machine Learning", "Data Science", "Blockchain"
];

const Register = () => {
  const [regMethod, setRegMethod] = useState<'email' | 'phone'>('email');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student' as UserRole,
    course: '',
    year: '',
    college: '',
    region: '',
    language: 'English',
    skills: '',
    phone: '',
    projectTitle: '',
    projectDescription: '',
    education: {
      level: 'College Student' as UserLevel,
      field: '',
      institution: '',
      startYear: new Date().getFullYear(),
      endYear: new Date().getFullYear() + 4
    }
  });
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [allColleges, setAllColleges] = useState<string[]>(COLLEGES);
  const [allSkills, setAllSkills] = useState<string[]>(SKILLS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const users = querySnapshot.docs.map(doc => doc.data() as UserProfile);
        
        const normalizedUsers = users.map(u => {
          const rawSkills = (u as any).skills;
          return {
            ...u,
            skills: Array.isArray(rawSkills)
              ? (rawSkills as string[])
              : typeof rawSkills === "string"
                ? rawSkills.split(",").map(s => s.trim())
                : [],
            college: u.college || "",
            name: u.name || ""
          };
        });

        const existingSkills = [...new Set(normalizedUsers.flatMap(u => u.skills))];
        const existingColleges = [...new Set(normalizedUsers.map(u => u.college).filter(Boolean))];

        setAllSkills(prev => [...new Set([...prev, ...existingSkills])]);
        setAllColleges(prev => [...new Set([...prev, ...existingColleges])]);
      } catch (err) {
        console.error("Error fetching existing data for autocomplete:", err);
      }
    };
    fetchExistingData();
  }, []);

  const setupRecaptcha = () => {
    try {
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container-reg", {
          size: "invisible"
        });
      }
    } catch (err) {
      console.error("Recaptcha setup error:", err);
      setError("Failed to initialize security check. Please refresh.");
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return setError("Please enter a phone number");
    if (phoneNumber.length < 10) return setError("Please enter a valid phone number");
    
    setLoading(true);
    setError('');
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const fullPhoneNumber = `${countryCode}${phoneNumber}`;
      const confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, appVerifier);
      (window as any).confirmationResult = confirmationResult;
      setIsOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
      console.error("Phone registration error:", err);
      if ((window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier.clear();
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return setError("Please enter OTP");
    setLoading(true);
    setError('');
    try {
      const result = await (window as any).confirmationResult.confirm(otp);
      const firebaseUser = result.user;
      
      if (firebaseUser) {
        setFormData(prev => ({ ...prev, phone: firebaseUser.phoneNumber || '' }));
        setIsOtpSent(false);
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP code");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(s => s !== '');
      
      if (regMethod === 'email') {
        await register({
          ...formData,
          skills: skillsArray
        });
      } else {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error("Please verify your phone number first");

        const docRef = doc(db, 'users', firebaseUser.uid);
        const fullProfile: UserProfile = {
          ...formData,
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          phone: firebaseUser.phoneNumber || formData.phone,
          skills: skillsArray
        };
        await setDoc(docRef, fullProfile);
        
        // Trigger notification
        const usersSnapshot = await getDocs(collection(db, 'users'));
        usersSnapshot.docs.forEach(async (uDoc) => {
          if (uDoc.id !== firebaseUser.uid) {
            await triggerNotification(uDoc.id, "New member joined TeamUp!", `${formData.name} just joined the community!`, 'join');
          }
        });
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-24 max-w-md mx-auto">
      <div id="recaptcha-container-reg"></div>
      <div className="mb-8">
        <button onClick={() => navigate('/login')} className="text-indigo-600 font-bold flex items-center gap-2 mb-4">
          <X className="w-5 h-5" /> Cancel
        </button>
        <h1 className="text-3xl font-black text-gray-900">Create Profile</h1>
        <p className="text-gray-500">Join the TeamUp community</p>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
        <button
          onClick={() => { setRegMethod('email'); setError(''); }}
          className={cn(
            "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
            regMethod === 'email' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"
          )}
        >
          Email
        </button>
        <button
          onClick={() => { setRegMethod('phone'); setError(''); }}
          className={cn(
            "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
            regMethod === 'phone' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"
          )}
        >
          Phone
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-sm font-medium border border-rose-100">{error}</div>}
        
        {regMethod === 'phone' && !auth.currentUser?.phoneNumber && (
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4 mb-6">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Phone Verification</h2>
            {!isOtpSent ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-gray-50 border-none rounded-2xl px-4 py-4 focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-gray-700"
                  >
                    <option value="+91">+91</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                    <option value="+61">+61</option>
                  </select>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="00000 00000"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send OTP"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 text-center text-xl font-bold tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="w-full text-gray-400 font-bold text-xs"
                >
                  Change Number
                </button>
              </div>
            )}
          </div>
        )}

        {regMethod === 'email' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Account Info</h2>
            <input
              type="email" placeholder="Email" required
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />
            <input
              type="password" placeholder="Password" required
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Personal & Language</h2>
          <input
            type="text" placeholder="Full Name" required
            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
          />
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Primary Language</label>
            <select
              value={formData.language}
              onChange={e => setFormData({...formData, language: e.target.value})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 appearance-none font-bold text-gray-700"
            >
              <option value="English">English</option>
              <option value="Telugu">Telugu</option>
              <option value="Hindi">Hindi</option>
              <option value="Tamil">Tamil</option>
              <option value="Kannada">Kannada</option>
              <option value="Malayalam">Malayalam</option>
            </select>
          </div>
          <input
            type="text" placeholder="Region (City/State)" required
            value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})}
            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
          />
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Education & Experience</h2>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Current Level</label>
            <select
              value={formData.education.level}
              onChange={e => setFormData({
                ...formData, 
                education: { ...formData.education, level: e.target.value as UserLevel }
              })}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 appearance-none font-bold text-gray-700"
            >
              <option value="School Student">School Student (10th+)</option>
              <option value="College Student">College Student</option>
              <option value="Working Professional">Working Professional</option>
            </select>
          </div>
          
          <input
            type="text" 
            placeholder={formData.education.level === 'Working Professional' ? "Current Role / Field" : "Field of Study (e.g. MPC, Engineering)"} 
            required
            value={formData.education.field} 
            onChange={e => setFormData({
              ...formData, 
              education: { ...formData.education, field: e.target.value }
            })}
            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
          />

          <input
            type="text" 
            placeholder={formData.education.level === 'Working Professional' ? "Company / Organization" : "School / College Name"} 
            required
            value={formData.education.institution} 
            onChange={e => setFormData({
              ...formData, 
              education: { ...formData.education, institution: e.target.value }
            })}
            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Start Year</label>
              <input
                type="number"
                min="1990"
                max="2030"
                value={formData.education.startYear}
                onChange={e => setFormData({
                  ...formData, 
                  education: { ...formData.education, startYear: parseInt(e.target.value) || new Date().getFullYear() }
                })}
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">End Year</label>
              <input
                type="number"
                min="1990"
                max="2035"
                value={formData.education.endYear}
                onChange={e => setFormData({
                  ...formData, 
                  education: { ...formData.education, endYear: parseInt(e.target.value) || new Date().getFullYear() }
                })}
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold"
              />
            </div>
          </div>
          {formData.education.startYear > formData.education.endYear && (
            <p className="text-rose-500 text-[10px] font-bold ml-4 uppercase tracking-widest">End year must be after start year</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Skills & Project</h2>
          <div className="space-y-2">
            <Autocomplete
              options={allSkills}
              value={formData.skills}
              onChange={val => setFormData({...formData, skills: val})}
              placeholder="Add Skills (comma separated)"
              isMulti={true}
            />
            <p className="text-[10px] text-gray-400 px-2 italic">Example: React, Node.js, UI/UX</p>
          </div>
          <input
            type="text" placeholder="Current Project Title (Optional)"
            value={formData.projectTitle} onChange={e => setFormData({...formData, projectTitle: e.target.value})}
            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
          />
          <textarea
            placeholder="What are you building? (Optional)"
            value={formData.projectDescription} onChange={e => setFormData({...formData, projectDescription: e.target.value})}
            className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 min-h-[100px]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Complete Registration"}
        </button>
        
        <p className="text-center text-gray-500 text-sm mt-4">
          Already have an account?{' '}
          <button type="button" onClick={() => navigate('/login')} className="text-indigo-600 font-bold hover:underline">
            Go to Login
          </button>
        </p>
      </form>
    </div>
  );
};

const HomeFeed = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<{user1: string, user2: string}[]>([]);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const { user, blockedUsers } = useAuth();
  const navigate = useNavigate();

  const todayIdea = PROJECT_IDEAS.length > 0 
    ? PROJECT_IDEAS[new Date().getDate() % PROJECT_IDEAS.length] 
    : { title: "New Project", description: "Start something amazing today!" };

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const users = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          uid: doc.id
        } as UserProfile));
        
        console.log("Fetched users:", users);
        setProfiles(users);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    };

    fetchUsers();

    const q = query(
      collection(db, 'requests'),
      or(where('senderId', '==', user.uid), where('receiverId', '==', user.uid))
    );
    const unsubscribeReq = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConnectionRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    const connQ = query(
      collection(db, 'connections'),
      or(where('user1', '==', user.uid), where('user2', '==', user.uid))
    );
    const unsubscribeConn = onSnapshot(connQ, (snapshot) => {
      setConnections(snapshot.docs.map(doc => doc.data() as {user1: string, user2: string}));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'connections');
    });

    return () => {
      unsubscribeReq();
      unsubscribeConn();
    };
  }, [user]);

  const handleRequest = async (receiverId?: string) => {
    if (!user?.uid) return;
    const targetId = receiverId || user.uid;
    if (!targetId) return;

    try {
      // 2. Prevent duplicate requests (only block if pending)
      const q = query(
        collection(db, 'requests'),
        where('senderId', '==', user.uid),
        where('receiverId', '==', targetId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setToast({ message: 'Request already sent', type: 'error' });
        return;
      }

      // 3. Create request
      await addDoc(collection(db, 'requests'), {
        senderId: user.uid,
        receiverId: targetId,
        status: "pending",
        timestamp: Date.now()
      });
      
      if (targetId === user.uid) {
        console.log("Test request created");
      } else {
        console.log("Request created");
      }

      // 4. Create notification
      await addDoc(collection(db, 'notifications'), {
        userId: targetId,
        message: targetId === user.uid ? "Test Team Up request" : "You received a Team Up request",
        type: "request",
        timestamp: Date.now(),
        // Keep these for existing UI compatibility
        title: targetId === user.uid ? "Test Request" : "New TeamUp Request!",
        body: targetId === user.uid ? "This is a test request to yourself." : `${user.name} wants to team up with you!`,
        read: false
      });
      console.log("Notification created");

      // 5. UI feedback
      setToast({ message: 'Request Sent', type: 'success' });
    } catch (err) {
      console.error("Error in handleRequest:", err);
      setToast({ message: 'Failed to send request.', type: 'error' });
      handleFirestoreError(err, OperationType.WRITE, 'requests');
    }
  };

  const filteredProfiles = profiles.filter(p => {
    // Show self only if no other users exist (for testing)
    if (p.uid === user?.uid && profiles.length > 1) return false; 

    // Filter out blocked users
    if (blockedUsers.includes(p.uid)) return false;

    const q = search.toLowerCase().trim();
    if (!q) return true;

    const name = (p.name || "").toLowerCase();
    const college = (p.college || "").toLowerCase();
    const role = (p.role || "").toLowerCase();
    const skills = getSkillsArray(p.skills).map(s => s.toLowerCase());
    const projectTitle = (p.projectTitle || "").toLowerCase();
    const projectDescription = (p.projectDescription || "").toLowerCase();

    return name.includes(q) || 
           college.includes(q) || 
           role.includes(q) || 
           skills.some(s => s.includes(q)) ||
           projectTitle.includes(q) ||
           projectDescription.includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto overflow-y-auto scroll-smooth">
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 pb-12 rounded-b-[40px] shadow-lg shadow-indigo-100">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-indigo-100 text-sm font-medium">Welcome back,</p>
            <h1 className="text-2xl font-black text-white tracking-tight">{user?.name}</h1>
          </div>
          <TeamUpLogo size={48} className="shadow-lg shadow-indigo-900/20" />
        </div>
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search name, college, skills..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white rounded-2xl pl-14 pr-6 py-4 text-sm font-medium shadow-sm border-none focus:ring-2 focus:ring-indigo-400 transition-all placeholder:text-gray-300"
          />
        </div>
      </div>

      <div className="px-6 -mt-8 relative z-10">
        {/* Daily Project Idea Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[32px] shadow-xl shadow-indigo-100/30 border border-indigo-100 mb-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Lightbulb className="w-20 h-20 text-indigo-600" />
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
            <h2 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Daily Project Idea</h2>
          </div>
          
          <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight">{todayIdea.title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-2">{todayIdea.description}</p>
          
          <button 
            onClick={() => navigate('/create-project', { state: { prefillProject: todayIdea.title } })}
            className="w-full bg-white text-indigo-600 py-3 rounded-2xl font-black text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 border border-indigo-100 active:scale-[0.98]"
          >
            Start This Project <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        <div className="bg-white py-4 px-6 rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 mb-8">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Recommended Students</h2>
        </div>

        {filteredProfiles.length > 0 ? (
          filteredProfiles.map((profile, index) => {
            const profileId = profile.id || profile.uid;
            // Find the latest request between users
            const relevantRequests = requests.filter(r => 
              (r.senderId === user?.uid && r.receiverId === profileId) || 
              (r.senderId === profileId && r.receiverId === user?.uid)
            ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            const request = relevantRequests[0];
            const isConnected = connections.some(c => (c.user1 === user?.uid && c.user2 === profileId) || (c.user1 === profileId && c.user2 === user?.uid));
            const isPending = !!request && request.status === 'pending';
            const isFromMe = isPending && request.senderId === user?.uid;
            
            return (
              <UserCard
                key={profileId || index}
                profile={profile}
                onRequest={() => handleRequest(profileId)}
                isPending={isPending}
                isFromMe={isFromMe}
                isAccepted={isConnected}
              />
            );
          })
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-300 w-8 h-8" />
            </div>
            <h3 className="text-gray-900 font-bold">No results found</h3>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your search terms</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

const Requests = () => {
  const [requests, setRequests] = useState<(ConnectionRequest & { fromProfile?: UserProfile })[]>([]);
  const [connections, setConnections] = useState<(ConnectionRequest & { profile?: UserProfile })[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'connections'>('pending');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // 1. Fetch requests: From "requests" collection, Where receiverId == currentUserId, Use real-time listener (onSnapshot)
    const incomingQ = query(
      collection(db, 'requests'), 
      where('receiverId', '==', user.uid)
    );
    
    const unsubscribeIncoming = onSnapshot(incomingQ, async (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConnectionRequest));
      console.log("Requests:", reqs); // 7. Add logs
      
      const withProfiles = await Promise.all(reqs.map(async (req) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', req.senderId));
          return { ...req, fromProfile: userDoc.exists() ? { ...userDoc.data(), id: userDoc.id, uid: userDoc.id } as UserProfile : undefined };
        } catch (err) {
          return { ...req };
        }
      }));
      setRequests(withProfiles);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    // Listen for accepted connections (both sent and received)
    const connectionsQ = query(
      collection(db, 'requests'), 
      and(
        where('status', '==', 'accepted'),
        or(
          where('senderId', '==', user.uid),
          where('receiverId', '==', user.uid)
        )
      )
    );

    const unsubscribeConnections = onSnapshot(connectionsQ, async (snapshot) => {
      const allAccepted = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConnectionRequest));

      const withProfiles = await Promise.all(allAccepted.map(async (req) => {
        try {
          const otherUid = req.senderId === user.uid ? req.receiverId : req.senderId;
          const userDoc = await getDoc(doc(db, 'users', otherUid));
          return { ...req, profile: userDoc.exists() ? { ...userDoc.data(), id: userDoc.id, uid: userDoc.id } as UserProfile : undefined };
        } catch (err) {
          return { ...req };
        }
      }));
      setConnections(withProfiles);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeConnections();
    };
  }, [user]);

  const handleAction = async (requestId: string, status: RequestStatus, senderId?: string) => {
    if (!user || !senderId) return;
    try {
      if (status === 'accepted') {
        // 3. Accept button: Update request document: status = "accepted"
        await updateDoc(doc(db, 'requests', requestId), { status: 'accepted' });
        setToast({ message: 'Request accepted!', type: 'success' });
        
        // 1. On Accept: Create new document in "connections"
        try {
          const q = query(
            collection(db, 'connections'),
            or(
              and(where('user1', '==', senderId), where('user2', '==', user.uid)),
              and(where('user1', '==', user.uid), where('user2', '==', senderId))
            )
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) {
            await addDoc(collection(db, 'connections'), {
              user1: senderId,
              user2: user.uid,
              timestamp: Date.now()
            });
            console.log("Connection created");
          }
        } catch (connErr) {
          console.error("Error creating connection:", connErr);
        }

        // Create notification: userId: senderId, message: "Your Team Up request was accepted", type: "accept", timestamp: Date.now()
        await triggerNotification(senderId, "Request Accepted!", "Your Team Up request was accepted", 'accept');
      } else if (status === 'rejected') {
        // 4. Reject button: Update request document: status = "rejected"
        await updateDoc(doc(db, 'requests', requestId), { status: 'rejected' });
        setToast({ message: 'Request rejected', type: 'success' });
        
        // Create notification: userId: senderId, message: "Your Team Up request was rejected", type: "reject", timestamp: Date.now()
        await triggerNotification(senderId, "Request Rejected", "Your Team Up request was rejected", 'reject');
      }
    } catch (err) {
      setToast({ message: 'Failed to update request.', type: 'error' });
      handleFirestoreError(err, OperationType.UPDATE, `requests/${requestId}`);
    }
  };

  const clearRejectedRequests = async () => {
    const rejected = requests.filter(r => r.status === 'rejected' && !(r as any).isCleared);
    try {
      await Promise.all(rejected.map(r => updateDoc(doc(db, 'requests', r.id), { isCleared: true })));
      setToast({ message: 'Rejected requests cleared', type: 'success' });
    } catch (err) {
      console.error("Error clearing rejected requests:", err);
      setToast({ message: 'Failed to clear requests', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      <div className="bg-white px-8 pt-12 pb-6 rounded-b-[40px] shadow-sm mb-6">
        <h1 className="text-3xl font-black text-gray-900 mb-6">Network</h1>
        
        <div className="flex bg-gray-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'pending' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"
            )}
          >
            Requests
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                {requests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'connections' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500"
            )}
          >
            Connections
          </button>
        </div>
      </div>

      <div className="px-6">
        {activeTab === 'pending' ? (
          <div className="space-y-4">
            {requests.filter(r => !(r as any).isCleared).length > 0 ? (
              <>
                {requests.some(r => r.status === 'rejected' && !(r as any).isCleared) && (
                  <div className="flex justify-end mb-2">
                    <button 
                      onClick={clearRejectedRequests}
                      className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                    >
                      Clear Rejected
                    </button>
                  </div>
                )}
                {requests.filter(r => !(r as any).isCleared).map(req => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100"
                  >
                  <div 
                    onClick={() => req.senderId && navigate(`/user/${req.senderId}`)}
                    className="flex items-center gap-4 mb-4 cursor-pointer"
                  >
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-2xl shadow-inner">
                      {req.fromProfile?.name ? req.fromProfile.name[0] : '?'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-lg">{req.fromProfile?.name || 'Unknown User'}</h3>
                      <p className="text-xs text-gray-500 font-medium line-clamp-1">{req.fromProfile?.college}</p>
                      <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">
                        Status: <span className={cn(
                          req.status === 'pending' ? "text-amber-600" :
                          req.status === 'accepted' ? "text-emerald-600" : "text-rose-600"
                        )}>{req.status}</span>
                      </p>
                    </div>
                  </div>
                  
                  {req.status === 'pending' ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAction(req.id, 'accepted', req.senderId)}
                        className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                      >
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'rejected', req.senderId)}
                        className="flex-1 bg-gray-50 text-gray-500 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-95 transition-all"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-2 bg-gray-50 rounded-2xl">
                      <p className={cn(
                        "text-xs font-bold uppercase tracking-widest",
                        req.status === 'accepted' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {req.status === 'accepted' ? "Accepted" : "Rejected"}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </>
          ) : (
              <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Users className="text-gray-200 w-10 h-10" />
                </div>
                <h3 className="text-gray-900 font-bold">No requests yet</h3>
                <p className="text-gray-500 text-sm mt-1 px-8">When someone wants to team up, you'll see them here.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {connections.length > 0 ? (
              connections.map(conn => (
                <motion.div
                  key={conn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => conn.profile?.uid && navigate(`/user/${conn.profile.uid}`)}
                  className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-black text-2xl shadow-inner">
                    {conn.profile?.name ? conn.profile.name[0] : '?'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{conn.profile?.name || 'Unknown User'}</h3>
                    <p className="text-xs text-gray-500 font-medium line-clamp-1">{conn.profile?.college}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase tracking-widest">
                        <Check className="w-3 h-3" /> Connected
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-bold uppercase tracking-widest">
                        <Mail className="w-3 h-3" /> Contact Info
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Plus className="text-gray-200 w-10 h-10" />
                </div>
                <h3 className="text-gray-900 font-bold">No connections yet</h3>
                <p className="text-gray-500 text-sm mt-1 px-8">Start exploring and sending requests to build your team!</p>
                <button 
                  onClick={() => navigate('/')}
                  className="mt-6 text-indigo-600 font-bold text-sm hover:underline"
                >
                  Explore Profiles
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

const Network = () => {
  const [connections, setConnections] = useState<UserProfile[]>([]);
  const [myTeams, setMyTeams] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, blockedUsers } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid) return;

    // Fetch connections
    const connectionsQuery = query(
      collection(db, 'connections'),
      or(
        where('user1', '==', user.uid),
        where('user2', '==', user.uid)
      )
    );

    const unsubscribeConnections = onSnapshot(connectionsQuery, async (snapshot) => {
      const connectionDocs = snapshot.docs.map(doc => doc.data());
      const otherUserIds = connectionDocs.map(c => c.user1 === user.uid ? c.user2 : c.user1);
      
      if (otherUserIds.length === 0) {
        setConnections([]);
        return;
      }

      try {
        const userProfiles = await Promise.all(
          otherUserIds.map(async (uid) => {
            if (blockedUsers.includes(uid)) return null;
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              return { ...userDoc.data(), id: userDoc.id, uid: userDoc.id } as UserProfile;
            }
            return null;
          })
        );
        setConnections(userProfiles.filter((p): p is UserProfile => p !== null));
      } catch (error) {
        console.error("Error fetching network profiles:", error);
      }
    });

    // Fetch project teams
    const teamsQuery = query(
      collection(db, 'projects'),
      where('teamMembers', 'array-contains', user.uid)
    );

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      setMyTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
      setLoading(false);
    });

    return () => {
      unsubscribeConnections();
      unsubscribeTeams();
    };
  }, [user?.uid, blockedUsers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8 max-w-md mx-auto">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = connections.length > 0 || myTeams.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">My Network</h1>
        <div className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
          {connections.length + myTeams.length} Total
        </div>
      </div>
      
      {!hasData ? (
        <div className="bg-white rounded-[40px] p-12 text-center shadow-xl shadow-indigo-100/20 border border-indigo-50">
          <div className="w-24 h-24 bg-indigo-50 rounded-[30%] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Globe className="w-12 h-12 text-indigo-600" />
          </div>
          <h3 className="text-gray-900 font-black text-2xl mb-3 tracking-tight">No connections yet</h3>
          <p className="text-gray-500 mb-10 font-medium leading-relaxed">Start teaming up with others to build your professional network!</p>
          <button 
            onClick={() => navigate('/projects')}
            className="w-full bg-indigo-600 text-white font-black py-5 px-8 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Rocket className="w-5 h-5" /> Explore Projects
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {myTeams.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Project Teams</h2>
                <span className="text-[10px] font-bold text-indigo-600">{myTeams.length} Active</span>
              </div>
              <div className="space-y-4">
                {myTeams.map(project => (
                  <motion.div 
                    key={project.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/project/${project.id}`)}
                    className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Rocket className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{project.title}</h4>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Team Member</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
                    </div>
                    <div className="flex -space-x-2 overflow-hidden">
                      {project.teamMembers?.slice(0, 5).map((uid, i) => (
                        <div key={uid} className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                          {i === 0 ? 'L' : 'M'}
                        </div>
                      ))}
                      {(project.teamMembers?.length || 0) > 5 && (
                        <div className="flex items-center justify-center h-8 w-8 rounded-full ring-2 ring-white bg-gray-50 text-[10px] font-bold text-gray-400">
                          +{(project.teamMembers?.length || 0) - 5}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {connections.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Direct Connections</h2>
                <span className="text-[10px] font-bold text-indigo-600">{connections.length} People</span>
              </div>
              <div className="space-y-4">
                {connections.map(profile => (
                  <UserCard 
                    key={profile.uid} 
                    profile={profile} 
                    onRequest={() => {}} 
                    isPending={false}
                    isFromMe={false}
                    isAccepted={true}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Notifications = () => {
  const [notifications, setNotifications] = useState<{ id: string, title: string, body: string, timestamp: any, type: string, read: boolean, isCleared?: boolean }[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as any)).filter((n: any) => n.isCleared !== true);
      setNotifications(notes);
      
      // Mark all as read when notifications are loaded
      const unread = notes.filter((n: any) => !n.read);
      if (unread.length > 0) {
        Promise.all(unread.map((n: any) => updateDoc(doc(db, 'notifications', n.id), { read: true })))
          .catch(err => console.error("Error marking all as read:", err));
      }
    }, (error) => {
      console.error("Firestore Error in Notifications:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const requestPermission = async () => {
    const res = await Notification.requestPermission();
    setPermission(res);
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const clearNotification = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isCleared: true, read: true });
    } catch (error) {
      console.error("Error clearing notification:", error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await Promise.all(notifications.map(n => updateDoc(doc(db, 'notifications', n.id), { isCleared: true, read: true })));
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-24 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900">Alerts</h1>
        <div className="flex gap-4">
          {notifications.some(n => !n.read) && (
            <button 
              onClick={markAllAsRead}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={clearAllNotifications}
              className="text-xs font-bold text-gray-400 hover:text-rose-500 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {permission !== 'granted' && (
        <div className="bg-indigo-50 p-6 rounded-3xl mb-6 border border-indigo-100 flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm">
            <Bell className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-indigo-900">Enable Push</h4>
            <p className="text-xs text-indigo-600/70 mt-0.5">Get notified even when the app is closed.</p>
          </div>
          <button 
            onClick={requestPermission}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200"
          >
            Allow
          </button>
        </div>
      )}
      
      {notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map(note => (
            <div 
              key={note.id} 
              onClick={() => !note.read && markAsRead(note.id)}
              className={cn(
                "bg-white p-5 rounded-3xl shadow-sm border-l-4 flex items-start gap-4 transition-all cursor-pointer",
                note.read ? "opacity-60 grayscale-[0.5]" : "scale-[1.02] shadow-md",
                note.type === 'acceptance' || note.type === 'accept' ? "border-emerald-500" : 
                note.type === 'reject' ? "border-rose-500" :
                note.type === 'join' ? "border-amber-500" : "border-indigo-600"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl",
                note.type === 'acceptance' || note.type === 'accept' ? "bg-emerald-50" : 
                note.type === 'reject' ? "bg-rose-50" :
                note.type === 'join' ? "bg-amber-50" : "bg-indigo-50"
              )}>
                {note.type === 'acceptance' || note.type === 'accept' ? (
                  <Check className="w-5 h-5 text-emerald-600" />
                ) : note.type === 'reject' ? (
                  <X className="w-5 h-5 text-rose-600" />
                ) : note.type === 'join' ? (
                  <Users className="w-5 h-5 text-amber-600" />
                ) : (
                  <Bell className="w-5 h-5 text-indigo-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-sm font-black text-gray-900 leading-tight">{note.title}</h4>
                    {!note.read && <div className="w-2 h-2 bg-indigo-600 rounded-full inline-block ml-2" />}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotification(note.id);
                    }}
                    className="p-1 text-gray-300 hover:text-rose-500 transition-colors ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{note.body}</p>
                <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-bold">
                  {note.timestamp?.seconds 
                    ? new Date(note.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : typeof note.timestamp === 'number'
                      ? new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Just now'}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Bell className="text-gray-200 w-10 h-10" />
          </div>
          <h3 className="text-gray-900 font-bold">All caught up!</h3>
          <p className="text-gray-500 text-sm mt-1">No new notifications at the moment.</p>
        </div>
      )}
    </div>
  );
};

const UserProfileDetail = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [request, setRequest] = useState<ConnectionRequest | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [revealContact, setRevealContact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!uid || !currentUser) return;

    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', uid));
        if (docSnap.exists()) {
          setProfile({ ...docSnap.data(), id: docSnap.id, uid: docSnap.id } as UserProfile);
        }
        
        const q = query(
          collection(db, 'requests'), 
          or(
            and(where('senderId', '==', currentUser.uid), where('receiverId', '==', uid)),
            and(where('senderId', '==', uid), where('receiverId', '==', currentUser.uid))
          )
        );
        
        const unsubscribeReq = onSnapshot(q, (snapshot) => {
          const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConnectionRequest));
          // Sort by timestamp to get the latest request
          const sorted = reqs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setRequest(sorted[0] || null);
        }, (error) => {
          console.error("Firestore Error in Profile Detail:", error);
        });

        const connQ = query(
          collection(db, 'connections'),
          or(
            and(where('user1', '==', currentUser.uid), where('user2', '==', uid)),
            and(where('user1', '==', uid), where('user2', '==', currentUser.uid))
          )
        );
        const unsubscribeConn = onSnapshot(connQ, (snapshot) => {
          setIsConnected(!snapshot.empty);
        });

        setLoading(false);
        return () => {
          unsubscribeReq();
          unsubscribeConn();
        };
      } catch (err) {
        console.error("Error fetching profile:", err);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [uid, currentUser]);

  const handleRequest = async () => {
    if (!currentUser?.uid) return;
    const targetId = profile?.uid || currentUser.uid;
    if (!targetId) return;
    
    try {
      // 2. Prevent duplicate requests (only block if pending)
      const q = query(
        collection(db, 'requests'),
        where('senderId', '==', currentUser.uid),
        where('receiverId', '==', targetId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setToast({ message: 'Request already sent', type: 'error' });
        return;
      }

      // 3. Create request
      await addDoc(collection(db, 'requests'), {
        senderId: currentUser.uid,
        receiverId: targetId,
        status: "pending",
        timestamp: Date.now()
      });
      
      if (targetId === currentUser.uid) {
        console.log("Test request created");
      } else {
        console.log("Request created");
      }

      // 4. Create notification
      await addDoc(collection(db, 'notifications'), {
        userId: targetId,
        message: targetId === currentUser.uid ? "Test Team Up request" : "You received a Team Up request",
        type: "request",
        timestamp: Date.now(),
        // Keep these for existing UI compatibility
        title: targetId === currentUser.uid ? "Test Request" : "New TeamUp Request!",
        body: targetId === currentUser.uid ? "This is a test request to yourself." : `${currentUser.name} wants to team up with you!`,
        read: false
      });
      console.log("Notification created");

      // 5. UI feedback
      setToast({ message: 'Request Sent', type: 'success' });
    } catch (err) {
      console.error("Error in handleRequest:", err);
      setToast({ message: 'Failed to send request', type: 'error' });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );
  
  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <X className="text-rose-500 w-10 h-10" />
      </div>
      <h2 className="text-2xl font-black text-gray-900">User not found</h2>
      <button onClick={() => navigate('/')} className="mt-4 text-indigo-600 font-bold">Return Home</button>
    </div>
  );

  const isPending = request?.status === 'pending';
  const isFromMe = isPending && request.senderId === currentUser?.uid;
  const isSelf = currentUser?.uid === profile.uid;
  const canViewContact = isConnected || isSelf;

  const handleReport = async () => {
    if (!currentUser || !profile) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reportedUserId: profile.uid,
        reportedBy: currentUser.uid,
        reason: "manual",
        timestamp: Date.now()
      });
      setToast({ message: 'User reported. Thank you for keeping TeamUp safe.', type: 'success' });
    } catch (err) {
      console.error("Report error:", err);
      setToast({ message: 'Failed to report user.', type: 'error' });
    }
  };

  const handleBlock = async () => {
    if (!currentUser || !profile) return;
    if (!window.confirm("Are you sure you want to block this user? They will no longer appear in your feed.")) return;
    
    try {
      await addDoc(collection(db, 'blocked'), {
        userId: currentUser.uid,
        blockedUserId: profile.uid,
        timestamp: Date.now()
      });
      setToast({ message: 'User blocked.', type: 'success' });
      navigate('/');
    } catch (err) {
      console.error("Block error:", err);
      setToast({ message: 'Failed to block user.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-8 pb-16 rounded-b-[40px] text-white relative shadow-lg">
        <button onClick={() => navigate(-1)} className="absolute top-8 left-8 p-2 bg-white/10 rounded-xl backdrop-blur-md hover:bg-white/20 transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="mt-12 text-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-[32px] flex items-center justify-center mx-auto mb-4 text-4xl font-black border border-white/20 shadow-inner"
          >
            {profile.name[0]}
          </motion.div>
          <h2 className="text-2xl font-black tracking-tight">{profile.name}</h2>
          <p className="text-indigo-100 font-bold text-sm uppercase tracking-widest mt-1">
            {profile.education?.level || profile.role || 'Member'}
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-indigo-200 text-xs font-bold">
              <MapPin className="w-3.5 h-3.5" />
              <span>{profile.region}</span>
            </div>
            <div className="flex items-center gap-1.5 text-indigo-200 text-xs font-bold">
              <Globe className="w-3.5 h-3.5" />
              <span>{profile.language || 'English'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-8 space-y-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Education & Experience</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="bg-gray-50 p-3 rounded-2xl shrink-0"><GraduationCap className="w-5 h-5 text-gray-400" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {profile.education?.level === 'Working Professional' ? 'Organization' : 'Institution'}
                </p>
                <p className="text-sm font-bold text-gray-800">{profile.education?.institution || profile.college || 'Not specified'}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {profile.education?.field || profile.course || 'Not specified'}
                </p>
                {profile.education && (
                  <p className="text-[10px] text-indigo-600 font-black mt-1 uppercase tracking-wider">
                    {profile.education.startYear} — {profile.education.endYear}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-gray-50 p-3 rounded-2xl shrink-0"><Code className="w-5 h-5 text-gray-400" /></div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Skills</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {getSkillsArray(profile.skills).map((s, idx) => (
                    <span key={`${s}-${idx}`} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-bold">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {profile.projectTitle && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
          >
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Current Project</h3>
            <p className="text-lg font-bold text-gray-900 mb-2">{profile.projectTitle}</p>
            <p className="text-sm text-gray-600 italic leading-relaxed">"{profile.projectDescription}"</p>
          </motion.div>
        )}

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
        >
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Contact Information</h3>
          {canViewContact ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 p-3 rounded-2xl"><Mail className="w-5 h-5 text-emerald-600" /></div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</p>
                  {revealContact || isSelf ? (
                    <a href={`mailto:${profile.email}`} className="text-sm font-bold text-indigo-600 hover:underline">{profile.email}</a>
                  ) : (
                    <p className="text-sm font-bold text-gray-800">{maskEmail(profile.email)}</p>
                  )}
                </div>
              </div>
              {profile.phone && (
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-50 p-3 rounded-2xl"><Phone className="w-5 h-5 text-emerald-600" /></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</p>
                    {revealContact || isSelf ? (
                      <a href={`tel:${profile.phone}`} className="text-sm font-bold text-indigo-600 hover:underline">{profile.phone}</a>
                    ) : (
                      <p className="text-sm font-bold text-gray-800">{maskPhone(profile.phone)}</p>
                    )}
                  </div>
                </div>
              )}
              
              {!isSelf && !revealContact && (
                <button 
                  onClick={() => setRevealContact(true)}
                  className="w-full py-3 rounded-2xl font-bold text-xs bg-indigo-50 text-indigo-600 flex items-center justify-center gap-2 border border-indigo-100 mt-2"
                >
                  <Eye className="w-4 h-4" /> Show Full Contact
                </button>
              )}

              <p className="text-[10px] text-amber-600 font-bold mt-4 flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3" />
                ⚠️ Please use contact responsibly. Report misuse.
              </p>

              {!isSelf && (
                <div className="pt-4 flex gap-2">
                  <div className="flex-1 py-4 rounded-2xl font-black text-sm bg-emerald-50 text-emerald-600 flex items-center justify-center gap-2 border border-emerald-100">
                    <Check className="w-4 h-4" /> Connected
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="bg-gray-50 p-6 rounded-2xl mb-6 border border-dashed border-gray-200">
                <div className="flex items-center justify-center gap-2 text-gray-400 font-bold text-sm mb-1">
                  <X className="w-4 h-4" />
                  <span>🔒 Connect to view contact</span>
                </div>
                <p className="text-[10px] text-gray-400 uppercase font-medium">Email & Phone Hidden</p>
              </div>
              <button
                onClick={handleRequest}
                disabled={isPending}
                className={cn(
                  "w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2",
                  isPending
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95"
                )}
              >
                {isPending ? (
                  <>
                    <Check className="w-4 h-4" />
                    {isFromMe ? "Request Sent" : "Pending Request"}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Team Up
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>

        {!isSelf && (
          <div className="flex gap-3 pt-2">
            <button 
              onClick={handleReport}
              className="flex-1 py-3 rounded-2xl font-bold text-xs bg-rose-50 text-rose-600 flex items-center justify-center gap-2 border border-rose-100"
            >
              <ShieldAlert className="w-4 h-4" /> Report User
            </button>
            <button 
              onClick={handleBlock}
              className="flex-1 py-3 rounded-2xl font-bold text-xs bg-gray-100 text-gray-600 flex items-center justify-center gap-2 border border-gray-200"
            >
              <Ban className="w-4 h-4" /> Block User
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

const Profile = () => {
  const { user, logout, updateProfile } = useAuth();
  const location = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserProfile>(user || {} as UserProfile);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user) {
      setFormData(user);
    }
  }, [user]);

  const handleSave = async () => {
    // Validation
    if (!formData.name.trim()) {
      setToast({ message: 'Name is required', type: 'error' });
      return;
    }
    if (formData.education) {
      if (!formData.education.field.trim() || !formData.education.institution.trim()) {
        setToast({ message: 'Education details are required', type: 'error' });
        return;
      }
      if (formData.education.startYear > formData.education.endYear) {
        setToast({ message: 'Start year cannot be after end year', type: 'error' });
        return;
      }
    }

    setLoading(true);
    try {
      await updateProfile(formData);
      setIsEditing(false);
      setToast({ message: 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to update profile.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-24 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900">Profile</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors font-bold text-sm"
          >
            {isEditing ? <><X className="w-4 h-4" /> Cancel</> : <><Code className="w-4 h-4" /> Edit Profile</>}
          </button>
          <button onClick={logout} className="p-2 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-6">
          {/* ... existing editing form ... */}
          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Personal & Language</h2>
            <input
              type="text" placeholder="Name"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Primary Language</label>
              <select
                value={formData.language || 'English'}
                onChange={e => setFormData({...formData, language: e.target.value})}
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 appearance-none font-bold text-gray-700"
              >
                <option value="English">English</option>
                <option value="Telugu">Telugu</option>
                <option value="Hindi">Hindi</option>
                <option value="Tamil">Tamil</option>
                <option value="Kannada">Kannada</option>
                <option value="Malayalam">Malayalam</option>
              </select>
            </div>
            <input
              type="text" placeholder="Region"
              value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Education & Experience</h2>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Current Level</label>
              <select
                value={formData.education?.level || 'College Student'}
                onChange={e => setFormData({
                  ...formData, 
                  education: { ...(formData.education || { field: '', institution: '', startYear: 2020, endYear: 2024 }), level: e.target.value as UserLevel }
                })}
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 appearance-none font-bold text-gray-700"
              >
                <option value="School Student">School Student (10th+)</option>
                <option value="College Student">College Student</option>
                <option value="Working Professional">Working Professional</option>
              </select>
            </div>
            
            <input
              type="text" 
              placeholder={formData.education?.level === 'Working Professional' ? "Current Role / Field" : "Field of Study"} 
              value={formData.education?.field || ''} 
              onChange={e => setFormData({
                ...formData, 
                education: { ...(formData.education || { level: 'College Student', institution: '', startYear: 2020, endYear: 2024 }), field: e.target.value }
              })}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />

            <input
              type="text" 
              placeholder={formData.education?.level === 'Working Professional' ? "Company / Organization" : "School / College Name"} 
              value={formData.education?.institution || ''} 
              onChange={e => setFormData({
                ...formData, 
                education: { ...(formData.education || { level: 'College Student', field: '', startYear: 2020, endYear: 2024 }), institution: e.target.value }
              })}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Start Year</label>
                <input
                  type="number"
                  value={formData.education?.startYear || 2020}
                  onChange={e => setFormData({
                    ...formData, 
                    education: { ...(formData.education || { level: 'College Student', field: '', institution: '', endYear: 2024 }), startYear: parseInt(e.target.value) || 2020 }
                  })}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">End Year</label>
                <input
                  type="number"
                  value={formData.education?.endYear || 2024}
                  onChange={e => setFormData({
                    ...formData, 
                    education: { ...(formData.education || { level: 'College Student', field: '', institution: '', startYear: 2020 }), endYear: parseInt(e.target.value) || 2024 }
                  })}
                  className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Skills</h2>
            <input
              type="text" placeholder="Skills (comma separated)"
              value={Array.isArray(formData.skills) ? formData.skills.join(', ') : formData.skills} 
              onChange={e => setFormData({...formData, skills: e.target.value.split(',').map(s => s.trim())})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Project</h2>
            <input
              type="text" placeholder="Project Title"
              value={formData.projectTitle || ''} onChange={e => setFormData({...formData, projectTitle: e.target.value})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4"
            />
            <textarea
              placeholder="Project Description"
              value={formData.projectDescription || ''} onChange={e => setFormData({...formData, projectDescription: e.target.value})}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 min-h-[100px]"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
          >
            {loading ? "Saving..." : <><Check className="w-5 h-5" /> Save Changes</>}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="bg-white rounded-[40px] p-8 shadow-sm border border-gray-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600 opacity-10" />
            <div 
              className="w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-4 text-white text-4xl font-black shadow-xl shadow-indigo-100"
              style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #8E7CFF 100%)' }}
            >
              {user?.name?.[0] || '?'}
            </div>
            <h2 className="text-2xl font-black text-gray-900">{user?.name || 'Not specified'}</h2>
            <p className="text-indigo-600 font-bold text-sm uppercase tracking-widest mt-1">
              {user?.education?.level || user?.role || 'Member'}
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold bg-gray-50 px-3 py-1.5 rounded-full">
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                <span>{user?.region || 'Not specified'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold bg-gray-50 px-3 py-1.5 rounded-full">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                <span>{user?.language || 'English'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Education & Experience */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Education & Experience</h3>
            </div>
            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                {user?.education?.level === 'Working Professional' ? 'Organization' : 'Institution'}
              </p>
              <p className="text-sm font-bold text-gray-800">{user?.education?.institution || user?.college || 'Not specified'}</p>
              <p className="text-xs text-gray-500 font-medium mt-1">
                {user?.education?.field || user?.course || 'Not specified'}
              </p>
              {user?.education && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-1 w-1 rounded-full bg-indigo-400" />
                  <p className="text-[10px] text-indigo-600 font-black uppercase tracking-wider">
                    {user.education.startYear} — {user.education.endYear}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Skills */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Code className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Expertise & Skills</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {getSkillsArray(user?.skills).length > 0 ? (
                getSkillsArray(user?.skills).map((s, idx) => (
                  <span 
                    key={`${s}-${idx}`} 
                    className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl font-bold border border-indigo-100/50"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <p className="text-xs text-gray-400 font-medium italic">No skills listed yet</p>
              )}
            </div>
          </div>

          {/* Section 4: Project */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Active Project</h3>
            </div>
            {user?.projectTitle || user?.projectDescription ? (
              <div className="space-y-2">
                {user.projectTitle && (
                  <p className="text-sm font-bold text-gray-800">{user.projectTitle}</p>
                )}
                {user.projectDescription && (
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100 italic">
                    "{user.projectDescription}"
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 font-medium italic">No active project specified</p>
            )}
          </div>

          {/* Section 5: Contact Info (Private) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Contact Details</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 group">
                <div className="bg-gray-50 p-3 rounded-2xl group-hover:bg-indigo-50 transition-colors"><Mail className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" /></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email Address</p>
                  <p className="text-sm font-bold text-gray-800">{user?.email || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="bg-gray-50 p-3 rounded-2xl group-hover:bg-indigo-50 transition-colors"><Phone className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" /></div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone Number</p>
                  <p className="text-sm font-bold text-gray-800">{user?.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-50 text-center">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-500" />
                Your contact info is private
              </p>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};


const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [myRequests, setMyRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching projects:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Requests for my projects (Owner side)
    const ownerQ = query(collection(db, 'projectRequests'), where('projectOwnerId', '==', user.uid));
    const unsubscribeOwner = onSnapshot(ownerQ, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectRequest)));
    });

    // Requests I've made (Requester side)
    const requesterQ = query(collection(db, 'projectRequests'), where('requestedBy', '==', user.uid));
    const unsubscribeRequester = onSnapshot(requesterQ, (snapshot) => {
      setMyRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectRequest)));
    });

    return () => {
      unsubscribeOwner();
      unsubscribeRequester();
    };
  }, [user]);

  const handleJoinRequest = async (project: Project) => {
    if (!user) return;
    
    // Check for duplicate
    const existing = myRequests.find(r => r.projectId === project.id);
    if (existing) {
      setToast({ message: 'Request already sent', type: 'error' });
      return;
    }

    try {
      await addDoc(collection(db, 'projectRequests'), {
        projectId: project.id,
        projectTitle: project.title,
        projectOwnerId: project.createdBy,
        requestedBy: user.uid,
        requestedByName: user.name,
        status: 'pending',
        timestamp: Timestamp.now()
      });
      setToast({ message: 'Join request sent!', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to send request', type: 'error' });
    }
  };

  const handleAcceptRequest = async (request: ProjectRequest) => {
    try {
      await updateDoc(doc(db, 'projectRequests', request.id), { status: 'accepted' });
      await updateDoc(doc(db, 'projects', request.projectId), {
        teamMembers: arrayUnion(request.requestedBy)
      });
      setToast({ message: 'Request accepted!', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to accept request', type: 'error' });
    }
  };

  const handleRejectRequest = async (request: ProjectRequest) => {
    try {
      await updateDoc(doc(db, 'projectRequests', request.id), { status: 'rejected' });
      setToast({ message: 'Request rejected', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to reject request', type: 'error' });
    }
  };

  const getRequestStatus = (projectId: string) => {
    const req = myRequests.find(r => r.projectId === projectId);
    return req ? req.status : null;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-24 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Projects</h1>
        <button 
          onClick={() => navigate('/create-project')}
          className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Owner Side: Project Requests */}
      {requests.filter(r => r.status === 'pending').length > 0 && (
        <div className="mb-8 space-y-4">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Project Requests</h2>
          {requests.filter(r => r.status === 'pending').map(request => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black">
                  {request.requestedByName?.[0] || '?'}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{request.requestedByName}</p>
                  <p className="text-[10px] text-gray-400 font-medium">wants to join <span className="text-indigo-600 font-bold">{request.projectTitle}</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAcceptRequest(request)}
                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleRejectRequest(request)}
                  className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-bold">Loading projects...</p>
        </div>
      ) : projects.length > 0 ? (
        <div className="space-y-6">
          {projects.map((project) => {
            const status = getRequestStatus(project.id);
            const isOwner = project.createdBy === user?.uid;
            const isJoined = project.teamMembers?.includes(user?.uid || '');

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/project/${project.id}`)}
                className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 relative overflow-hidden group cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600 opacity-10 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg">
                      {project.creatorName?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Created By</p>
                      <p className="text-sm font-bold text-gray-900">{project.creatorName}</p>
                    </div>
                  </div>
                  {project.ideaTitle && (
                    <div className="flex items-center gap-1 bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                      <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Daily Idea</span>
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight">{project.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-3">
                  {project.description}
                </p>

                {project.teamMembers && project.teamMembers.length > 0 && (
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex -space-x-2">
                      {project.teamMembers.slice(0, 3).map((memberId, idx) => (
                        <div key={memberId} className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-indigo-600">
                          {idx + 1}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {project.teamMembers.length} {project.teamMembers.length === 1 ? 'member' : 'members'} joined
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {project.timestamp?.toDate ? project.timestamp.toDate().toLocaleDateString() : 'Just now'}
                  </p>
                  <div className="flex gap-3">
                    {isOwner ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/create-project', { state: { editProject: project } });
                        }}
                        className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline"
                      >
                        Edit Project
                      </button>
                    ) : isJoined ? (
                      <div className="flex items-center gap-1 text-emerald-600 font-black text-xs uppercase tracking-widest">
                        <UserCheck className="w-4 h-4" /> Joined
                      </div>
                    ) : status === 'pending' ? (
                      <div className="text-orange-500 font-black text-xs uppercase tracking-widest">
                        Pending
                      </div>
                    ) : status === 'rejected' ? (
                      <div className="text-rose-500 font-black text-xs uppercase tracking-widest">
                        Rejected
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinRequest(project);
                        }}
                        className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" /> Request to Join
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-[40px] p-12 text-center border border-dashed border-gray-200">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Rocket className="text-gray-300 w-10 h-10" />
          </div>
          <h3 className="text-gray-900 font-black text-xl mb-2">No projects yet</h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Be the first one to start a project and invite others to join your team!
          </p>
          <button 
            onClick={() => navigate('/create-project')}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all"
          >
            Start First Project
          </button>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

const ProjectRequests = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [requests, setRequests] = useState<ProjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!id || !user) return;

    // First verify project ownership
    const projectRef = doc(db, 'projects', id);
    const unsubscribeProject = onSnapshot(projectRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Project;
        setProject(data);
      } else {
        setProject(null);
      }
      setLoading(false);
    });

    // Then fetch requests
    const q = query(
      collection(db, 'projectRequests'), 
      where('projectId', '==', id),
      where('projectOwnerId', '==', user.uid)
    );
    
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectRequest)));
    });

    return () => {
      unsubscribeProject();
      unsubscribeRequests();
    };
  }, [id, user]);

  const handleAction = async (request: ProjectRequest, status: 'accepted' | 'rejected') => {
    if (!project) return;

    try {
      // Update request status
      await updateDoc(doc(db, 'projectRequests', request.id), {
        status: status
      });

      // If accepted, add to team members
      if (status === 'accepted') {
        await updateDoc(doc(db, 'projects', project.id), {
          teamMembers: arrayUnion(request.requestedBy)
        });
        setToast({ message: 'Member added to team!', type: 'success' });
      } else {
        setToast({ message: 'Request rejected', type: 'success' });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Action failed', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 max-w-md mx-auto">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-bold">Loading requests...</p>
      </div>
    );
  }

  if (!project || project.createdBy !== user?.uid) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="text-rose-500 w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 mb-8">Only the project owner can manage join requests.</p>
        <button onClick={() => navigate(-1)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100">
          Go Back
        </button>
      </div>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests = requests.filter(r => r.status !== 'pending');

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">Join Requests</h1>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Pending Requests</h3>
            {pendingRequests.length > 0 ? (
              <div className="space-y-3">
                {pendingRequests.map(req => (
                  <div key={req.id} className="bg-white p-5 rounded-[24px] shadow-sm border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black">
                          {req.requestedByName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{req.requestedByName}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Wants to join</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAction(req, 'accepted')}
                        className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-xs shadow-sm active:scale-[0.98] transition-all"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleAction(req, 'rejected')}
                        className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-xl font-black text-xs active:scale-[0.98] transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-8 rounded-[32px] text-center border border-dashed border-gray-200">
                <p className="text-sm text-gray-400 font-bold">No pending requests</p>
              </div>
            )}
          </div>

          {otherRequests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Past Actions</h3>
              <div className="space-y-2">
                {otherRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 font-black text-xs">
                        {req.requestedByName?.[0]}
                      </div>
                      <p className="text-sm font-bold text-gray-900">{req.requestedByName}</p>
                    </div>
                    <span className={cn(
                      "text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest",
                      req.status === 'accepted' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    )}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

const ProjectDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRequests, setMyRequests] = useState<ProjectRequest[]>([]);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'projects', id), async (docSnap) => {
      if (docSnap.exists()) {
        const projectData = { id: docSnap.id, ...docSnap.data() } as Project;
        setProject(projectData);
        
        // Fetch team member profiles (including owner)
        const memberIds = [projectData.createdBy, ...(projectData.teamMembers || [])];
        const uniqueIds = Array.from(new Set(memberIds));
        
        const profiles: UserProfile[] = [];
        for (const uid of uniqueIds) {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            profiles.push({ id: userSnap.id, ...userSnap.data() } as UserProfile);
          }
        }
        setTeamMembers(profiles);
      } else {
        setProject(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const q = query(collection(db, 'projectRequests'), where('requestedBy', '==', user.uid), where('projectId', '==', id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectRequest)));
    });
    return () => unsubscribe();
  }, [user, id]);

  const handleJoinRequest = async () => {
    if (!user || !project) return;
    
    if (myRequests.length > 0) {
      setToast({ message: 'Request already sent', type: 'error' });
      return;
    }

    try {
      await addDoc(collection(db, 'projectRequests'), {
        projectId: project.id,
        projectTitle: project.title,
        projectOwnerId: project.createdBy,
        requestedBy: user.uid,
        requestedByName: user.name,
        status: 'pending',
        timestamp: Timestamp.now()
      });
      setToast({ message: 'Join request sent!', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to send request', type: 'error' });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!project || project.createdBy !== user?.uid) return;
    
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        teamMembers: arrayRemove(memberId)
      });
      
      // Also find and update the request status to rejected or just delete it?
      // For now, just removing from team is enough as per prompt.
      setToast({ message: 'Member removed from team', type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to remove member', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 max-w-md mx-auto">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-bold">Loading project details...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 max-w-md mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Rocket className="text-gray-300 w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Project Not Found</h2>
        <p className="text-gray-500 mb-8">This project might have been deleted or the link is incorrect.</p>
        <button onClick={() => navigate('/projects')} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100">
          Back to Projects
        </button>
      </div>
    );
  }

  const isOwner = project.createdBy === user?.uid;
  const isJoined = project.teamMembers?.includes(user?.uid || '');
  const request = myRequests[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      <div className="relative h-64 bg-indigo-600 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-indigo-900/80" />
        <div className="absolute top-8 left-8 flex items-center gap-4 z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/20 backdrop-blur-md rounded-xl text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute bottom-8 left-8 right-8 text-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              {project.commitmentLevel || 'Flexible'}
            </div>
            {project.ideaTitle && (
              <div className="bg-orange-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                <Flame className="w-3 h-3" /> Daily Idea
              </div>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight leading-tight">{project.title}</h1>
        </div>
      </div>

      <div className="px-8 -mt-6 relative z-10">
        <div className="bg-white rounded-[40px] p-8 shadow-xl shadow-indigo-100/20 border border-indigo-50 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xl">
              {project.creatorName?.[0] || '?'}
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Project Lead</p>
              <p className="text-lg font-bold text-gray-900">{project.creatorName}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">About Project</h3>
            <p className="text-gray-600 leading-relaxed font-medium">
              {project.description}
            </p>
          </div>

          {project.purpose && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Purpose</h3>
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-50 flex gap-3">
                <Target className="w-5 h-5 text-indigo-600 shrink-0" />
                <p className="text-sm text-indigo-900 font-medium leading-relaxed">{project.purpose}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-gray-400">
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Team Size</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{project.teamSize || 'Not specified'} Members</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Commitment</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{project.commitmentLevel || 'Flexible'}</p>
            </div>
          </div>

          {project.requiredSkills && project.requiredSkills.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {project.requiredSkills.map(skill => (
                  <span key={skill} className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold border border-gray-100">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Team Members</h3>
            {teamMembers.length > 0 ? (
              <div className="space-y-4">
                {teamMembers.map(member => {
                  const isMemberOwner = member.uid === project.createdBy;
                  return (
                    <div key={member.id} className="bg-gray-50 rounded-[24px] p-5 border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-600 font-black text-lg shadow-sm border border-gray-50">
                            {member.name?.[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-base font-bold text-gray-900">{member.name}</p>
                              {isMemberOwner && (
                                <span className="bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Owner</span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {member.education?.level || member.role}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => navigate(`/user/${member.uid}`)}
                            className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm hover:bg-indigo-50 transition-colors"
                          >
                            <User className="w-4 h-4" />
                          </button>
                          {isOwner && !isMemberOwner && (
                            <button 
                              onClick={() => handleRemoveMember(member.uid)}
                              className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"
                              title="Remove Member"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {member.skills && member.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {member.skills.slice(0, 3).map(skill => (
                            <span key={skill} className="bg-white text-gray-500 px-2.5 py-1 rounded-lg text-[9px] font-bold border border-gray-100">
                              {skill}
                            </span>
                          ))}
                          {member.skills.length > 3 && (
                            <span className="text-[9px] font-bold text-gray-400 px-1">+{member.skills.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-2xl text-center border border-dashed border-gray-200">
                <p className="text-xs text-gray-400 font-bold italic">No team members yet. Be the first to join!</p>
              </div>
            )}
          </div>

          <div className="pt-4">
            {isOwner ? (
              <div className="space-y-3">
                <button 
                  onClick={() => navigate(`/project/${project.id}/requests`)}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Users className="w-5 h-5" /> View Requests
                </button>
                <button 
                  onClick={() => navigate('/create-project', { state: { editProject: project } })}
                  className="w-full bg-white text-indigo-600 border-2 border-indigo-600 py-4 rounded-2xl font-black"
                >
                  Edit Project
                </button>
              </div>
            ) : isJoined ? (
              <div className="w-full bg-emerald-50 text-emerald-600 py-4 rounded-2xl font-black flex items-center justify-center gap-2 border border-emerald-100">
                <UserCheck className="w-5 h-5" /> You are a Team Member
              </div>
            ) : request?.status === 'pending' ? (
              <div className="w-full bg-orange-50 text-orange-600 py-4 rounded-2xl font-black flex items-center justify-center gap-2 border border-orange-100">
                <Clock className="w-5 h-5" /> Request Pending
              </div>
            ) : request?.status === 'rejected' ? (
              <div className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-black flex items-center justify-center gap-2 border border-rose-100">
                <X className="w-5 h-5" /> Request Rejected
              </div>
            ) : (
              <button 
                onClick={handleJoinRequest}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <UserPlus className="w-5 h-5" /> Request to Join
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

const CreateProject = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [teamSize, setTeamSize] = useState('3');
  const [commitmentLevel, setCommitmentLevel] = useState('5h/week');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ideaTitle, setIdeaTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    const state = location.state as { prefillProject?: string, editProject?: Project };
    if (state?.editProject) {
      setEditingId(state.editProject.id);
      setTitle(state.editProject.title);
      setDescription(state.editProject.description);
      setPurpose(state.editProject.purpose || '');
      setRequiredSkills(state.editProject.requiredSkills?.join(', ') || '');
      setTeamSize(state.editProject.teamSize?.toString() || '3');
      setCommitmentLevel(state.editProject.commitmentLevel || '5h/week');
      setIdeaTitle(state.editProject.ideaTitle);
    } else if (state?.prefillProject) {
      setTitle(state.prefillProject);
      setIdeaTitle(state.prefillProject);
    } else if (user?.projectTitle && !editingId) {
      // Fallback to user profile project if no specific project is being edited
      setTitle(user.projectTitle);
      setDescription(user.projectDescription || '');
    }
  }, [location.state, user, editingId]);

  const handleSave = async () => {
    if (!title.trim()) {
      setToast({ message: 'Project title is required', type: 'error' });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      // Duplicate Prevention Check (only for new projects)
      if (!editingId) {
        const q = query(
          collection(db, 'projects'), 
          where('createdBy', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const existingProjects = snapshot.docs.map(d => d.data() as Project);
        
        const duplicate = existingProjects.find(p => 
          p.title.toLowerCase().trim() === title.toLowerCase().trim() ||
          (ideaTitle && p.ideaTitle === ideaTitle)
        );

        if (duplicate) {
          setToast({ message: 'You already created this project. Redirecting to edit...', type: 'error' });
          setTimeout(() => {
            setEditingId(duplicate.id);
            setTitle(duplicate.title);
            setDescription(duplicate.description);
            setPurpose(duplicate.purpose || '');
            setRequiredSkills(duplicate.requiredSkills?.join(', ') || '');
            setTeamSize(duplicate.teamSize?.toString() || '3');
            setCommitmentLevel(duplicate.commitmentLevel || '5h/week');
            setIdeaTitle(duplicate.ideaTitle);
            setLoading(false);
          }, 2000);
          return;
        }
      }

      const projectData: any = {
        title: title.trim(),
        description: description.trim(),
        purpose: purpose.trim(),
        requiredSkills: requiredSkills.split(',').map(s => s.trim()).filter(s => s !== ''),
        teamSize: parseInt(teamSize) || 3,
        commitmentLevel: commitmentLevel.trim(),
        createdBy: user.uid,
        creatorName: user.name,
        ideaTitle: ideaTitle || null,
        timestamp: Timestamp.now()
      };

      if (editingId) {
        await updateDoc(doc(db, 'projects', editingId), projectData);
      } else {
        projectData.teamMembers = [];
        const docRef = await addDoc(collection(db, 'projects'), projectData);
        // Also update user profile for backward compatibility if needed, 
        // but the requirement says NOT inside user profile ONLY.
        // We'll keep it in sync for now as a fallback.
        await updateProfile({
          projectTitle: title.trim(),
          projectDescription: description.trim()
        });
      }

      setToast({ message: editingId ? 'Project updated!' : 'Project launched!', type: 'success' });
      setTimeout(() => navigate('/projects'), 1500);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to save project.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-24 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-xl shadow-sm">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">
          {editingId ? 'Edit Project' : 'Start Project'}
        </h1>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-indigo-100/20 border border-indigo-50 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Project Title</label>
            <input
              type="text"
              placeholder="What are you building?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-400 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
            <textarea
              placeholder="Tell us more about it..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-medium text-gray-700 focus:ring-2 focus:ring-indigo-400 transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Purpose / Goal</label>
            <textarea
              placeholder="What is the ultimate goal?"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              rows={2}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-medium text-gray-700 focus:ring-2 focus:ring-indigo-400 transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Required Skills (comma separated)</label>
            <input
              type="text"
              placeholder="React, Design, Python..."
              value={requiredSkills}
              onChange={e => setRequiredSkills(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Team Size</label>
              <input
                type="number"
                value={teamSize}
                onChange={e => setTeamSize(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-400 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Commitment</label>
              <input
                type="text"
                placeholder="5h/week"
                value={commitmentLevel}
                onChange={e => setCommitmentLevel(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-gray-700 focus:ring-2 focus:ring-indigo-400 transition-all"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Saving...' : editingId ? <><Check className="w-5 h-5" /> Update Project</> : <><Rocket className="w-5 h-5" /> Launch Project</>}
          </button>
        </div>

        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <Lightbulb className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-black text-indigo-900 mb-1">Pro Tip</h4>
              <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                A clear title and description help other students find your project and request to join your team!
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
};

// --- Auth Provider ---

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('teamup_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const userData = { ...docSnap.data(), id: docSnap.id, uid: docSnap.id } as UserProfile;
          setUser(userData);
          localStorage.setItem('teamup_user', JSON.stringify(userData));
          
          // Fetch blocked users
          const blockedQ = query(collection(db, 'blocked'), where('userId', '==', firebaseUser.uid));
          const unsubscribeBlocked = onSnapshot(blockedQ, (snapshot) => {
            setBlockedUsers(snapshot.docs.map(d => d.data().blockedUserId));
          });

          // FCM Token Setup
          if (messaging) {
            try {
              const permission = await Notification.requestPermission();
              if (permission === 'granted') {
                const token = await getToken(messaging, { 
                  vapidKey: 'BPr7_0_B_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8_m9_8' // Placeholder VAPID key
                });
                if (token && userData.fcmToken !== token) {
                  await updateDoc(docRef, { fcmToken: token });
                }
              }
            } catch (error) {
              console.error("FCM Token error:", error);
            }
          }

          return () => unsubscribeBlocked();
        } else {
          // New user logic
          const basicProfile: UserProfile = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            phone: firebaseUser.phoneNumber || '',
            name: firebaseUser.displayName || 'New User',
            role: 'student',
            course: '',
            year: '',
            college: '',
            region: '',
            language: 'English',
            skills: [],
            education: {
              level: 'College Student',
              field: '',
              institution: '',
              startYear: new Date().getFullYear(),
              endYear: new Date().getFullYear() + 4
            }
          };
          setUser(basicProfile);
          localStorage.setItem('teamup_user', JSON.stringify(basicProfile));
        }
      } else {
        // Only clear if the user was NOT a custom email login user
        // We can check if auth.currentUser is null. If it's null and we have a user, it's custom.
        if (!auth.currentUser) {
          const saved = localStorage.getItem('teamup_user');
          if (!saved) {
            setUser(null);
          }
        } else {
          setUser(null);
          localStorage.removeItem('teamup_user');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (messaging && user) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received in foreground: ', payload);
        if (payload.notification && Notification.permission === 'granted') {
          new Notification(payload.notification.title || 'TeamUp', {
            body: payload.notification.body,
            icon: '/logo192.png'
          });
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Also listen to Firestore notifications for browser alerts (simulating push)
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (Notification.permission === 'granted' && document.hidden) {
            new Notification(data.title, {
              body: data.body,
              icon: '/logo192.png'
            });
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const login = async (enteredEmail: string, enteredPassword: string) => {
    const email = enteredEmail.trim().toLowerCase();
    const password = enteredPassword.trim();
    
    console.log("Input email:", email);
    
    try {
      const q = query(collection(db, 'users'), where('email', '==', email));
      let snapshot = await getDocs(q);
      let docSnap = snapshot.docs[0];

      // Fallback: manual search if query fails
      if (snapshot.empty) {
        console.log("Query empty, trying fallback manual search...");
        const allUsersSnap = await getDocs(collection(db, 'users'));
        docSnap = allUsersSnap.docs.find(d => {
          const data = d.data();
          return data.email && data.email.toLowerCase() === email;
        }) as any;
      }

      if (!docSnap) {
        throw new Error('User not found');
      }

      const userData = docSnap.data() as UserProfile;
      console.log("Stored email:", userData.email);

      if (!userData.password) {
        throw new Error('Account has no password set');
      }

      const stored = String(userData.password).trim();
      const isMatch = password === stored;
      console.log("Password match:", isMatch);

      if (!isMatch) {
        throw new Error('Incorrect password');
      }

      const userProfile = { ...userData, id: docSnap.id, uid: docSnap.id } as UserProfile;
      setUser(userProfile);
      localStorage.setItem('teamup_user', JSON.stringify(userProfile));
    } catch (error: any) {
      const knownErrors = ['User not found', 'Incorrect password', 'Account has no password set'];
      if (error instanceof Error && knownErrors.includes(error.message)) {
        throw error;
      }
      handleFirestoreError(error, OperationType.GET, 'users');
    }
  };

  const loginWithPhone = async (phoneNumber: string) => {
    try {
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible'
      });
      return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    } catch (error) {
      console.error("Phone login error:", error);
      throw error;
    }
  };

  const verifyOtp = async (confirmationResult: ConfirmationResult, otp: string) => {
    try {
      const result = await confirmationResult.confirm(otp);
      const firebaseUser = result.user;
      
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          // Create initial record for new phone user
          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            phone: firebaseUser.phoneNumber || '',
            email: '',
            name: 'New User',
            role: 'student',
            course: '',
            year: '',
            college: '',
            region: '',
            language: 'English',
            skills: []
          };
          await setDoc(docRef, newProfile);
          setUser(newProfile);
          localStorage.setItem('teamup_user', JSON.stringify(newProfile));
        } else {
          const userData = { ...docSnap.data(), id: docSnap.id, uid: docSnap.id } as UserProfile;
          setUser(userData);
          localStorage.setItem('teamup_user', JSON.stringify(userData));
        }
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      throw new Error("Invalid OTP code");
    }
  };

  const register = async (profile: Omit<UserProfile, 'uid' | 'id'>) => {
    try {
      // Check if email exists
      const q = query(collection(db, 'users'), where('email', '==', profile.email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) throw new Error('Email already registered');

      const uid = Math.random().toString(36).substring(2, 15);
      const fullProfile: UserProfile = { ...profile, uid, id: uid };
      await setDoc(doc(db, 'users', uid), fullProfile);
      setUser(fullProfile);
      localStorage.setItem('teamup_user', JSON.stringify(fullProfile));

      // Trigger "New user joined" notification for everyone
      // In a real app, this would be a Cloud Function
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.docs.forEach(async (uDoc) => {
        if (uDoc.id !== uid) {
          await triggerNotification(uDoc.id, "New member joined TeamUp!", `${profile.name} just joined the community!`, 'join');
        }
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Email already registered')) throw error;
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    localStorage.removeItem('teamup_user');
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const updatedUser = { ...user, ...updates };
      await updateDoc(doc(db, 'users', user.uid), updates);
      setUser(updatedUser);
      localStorage.setItem('teamup_user', JSON.stringify(updatedUser));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, blockedUsers, loading, login, loginWithPhone, verifyOtp, register, logout, updateProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// --- Main App ---

const AppContent = () => {
  const { user } = useAuth();
  
  return (
    <div className="bg-gray-100 min-h-screen">
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        <Route path="/" element={user ? <HomeFeed /> : <Navigate to="/login" />} />
        <Route path="/requests" element={user ? <Requests /> : <Navigate to="/login" />} />
        <Route path="/notifications" element={user ? <Notifications /> : <Navigate to="/login" />} />
        <Route path="/network" element={user ? <Network /> : <Navigate to="/login" />} />
        <Route path="/projects" element={user ? <Projects /> : <Navigate to="/login" />} />
        <Route path="/project/:id" element={user ? <ProjectDetails /> : <Navigate to="/login" />} />
        <Route path="/project/:id/requests" element={user ? <ProjectRequests /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/create-project" element={user ? <CreateProject /> : <Navigate to="/login" />} />
        <Route path="/user/:uid" element={user ? <UserProfileDetail /> : <Navigate to="/login" />} />
      </Routes>
      {user && <BottomNav />}
    </div>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <AuthProvider>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
