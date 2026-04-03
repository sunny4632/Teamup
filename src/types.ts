export type UserRole = 'student' | 'graduate' | 'experienced';

export type UserLevel = 'School Student' | 'College Student' | 'Working Professional';

export interface EducationInfo {
  level: UserLevel;
  field: string;
  institution: string;
  startYear: number;
  endYear: number;
}

export interface UserProfile {
  id: string;
  uid: string; // Keeping uid as well for internal consistency
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  course: string;
  year: string;
  college: string;
  region: string;
  language?: string;
  education?: EducationInfo;
  skills: string[];
  projectTitle?: string;
  projectDescription?: string;
  phone?: string;
  fcmToken?: string;
}

export type RequestStatus = 'pending' | 'accepted' | 'rejected';

export interface Project {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  creatorName: string;
  ideaTitle?: string;
  timestamp: any;
  teamMembers?: string[];
  requiredSkills?: string[];
  purpose?: string;
  teamSize?: number;
  commitmentLevel?: string;
}

export interface ProjectRequest {
  id: string;
  projectId: string;
  projectTitle: string;
  projectOwnerId: string;
  requestedBy: string;
  requestedByName: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: any;
}

export interface ConnectionRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: RequestStatus;
  timestamp: any; // Firestore Timestamp
}
