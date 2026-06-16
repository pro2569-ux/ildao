// ===== 사용자 관련 타입 =====

/** 사용자 역할 */
export type UserRole = 'worker' | 'employer';

/** 사용자 프로필 */
export interface UserProfile {
  uid: string;
  email?: string;
  role: UserRole;
  name: string;
  phone: string;
  profileImage?: string;
  // 근로자 전용
  skills?: string[];        // 보유 기술 (철근, 목공, 설비 등)
  experience?: number;      // 경력 연수
  region?: string;          // 선호 지역
  desiredWage?: number;     // 희망 일당 (원)
  // 업체 전용
  companyName?: string;     // 업체명
  representativeName?: string; // 대표자명
  businessNumber?: string;  // 사업자번호
  mainJobCategories?: JobCategory[]; // 주요 직종
  isPublic?: boolean;       // 프로필 공개 여부 (구직자)
  introduction?: string;    // 자기소개 (구직자)
  companyIntro?: string;    // 업체 소개 (구인자)
  createdAt: Date;
  updatedAt: Date;
}

// ===== 지원 관련 타입 =====

/** 지원 상태 */
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';

/** 지원 내역 */
export interface Application {
  id: string;
  jobId: string;
  workerId: string;
  employerId: string;
  status: ApplicationStatus;
  createdAt: Date;
}

// ===== 구인 게시글 관련 타입 =====

/** 구인 게시글 상태 */
export type JobStatus = 'open' | 'closed' | 'in_progress' | 'completed';

/** 직종 카테고리 */
export type JobCategory =
  | '철근'
  | '목공'
  | '설비'
  | '전기'
  | '도장'
  | '용접'
  | '타일'
  | '미장'
  | '방수'
  | '조적'
  | '비계'
  | '잡역'
  | '기타';

/** 구인 게시글 */
export interface JobPost {
  id: string;
  employerId: string;       // 작성자 (업체) UID
  title: string;
  category: JobCategory;
  description: string;
  // 근무 조건
  dailyWage: number;        // 일당 (원)
  numberOfWorkers: number;  // 필요 인원
  startDate: Date;          // 시작일
  endDate?: Date;           // 종료일 (미정이면 null)
  workHours: string;        // 근무 시간 (예: "08:00~17:00")
  // 현장 정보
  location: {
    address: string;        // 주소
    lat: number;            // 위도
    lng: number;            // 경도
  };
  // 상태
  status: JobStatus;
  isPremium: boolean;       // 프리미엄 (상위 노출)
  createdAt: Date;
  updatedAt: Date;
}

// ===== 공수 계산 관련 타입 =====

/** 근무 유형 */
export type WorkType = 'normal' | 'overtime' | 'holiday' | 'off';

/** 일별 근무 기록 */
export interface DailyWork {
  date: string;             // YYYY-MM-DD
  type: WorkType;
  hours?: number;           // 근무 시간
  dailyWage?: number;       // 해당일 일당
  memo?: string;
}

/** 월별 공수 요약 */
export interface MonthlyWorkSummary {
  year: number;
  month: number;
  totalDays: number;        // 총 근무일
  overtimeDays: number;     // 잔업일
  holidayDays: number;      // 휴일근무일
  offDays: number;          // 휴무일
  totalWage: number;        // 총 급여
}

// ===== Phase 2: 공수 기록 (Firestore용) =====

/** 날씨 아이콘 */
export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'none';

/** Firestore 일별 공수 기록 */
export interface DailyWorkRecord {
  id?: string;
  userId: string;
  date: string;             // YYYY-MM-DD
  manDay: number;           // 공수 (0.0 ~ 2.0, 0.1 단위)
  overtime: boolean;        // 잔업 여부
  dayOff: boolean;          // 휴무 여부
  extension: boolean;       // 연장 여부
  expense: number;          // 경비 (원)
  memo: string;             // 메모
  weather: WeatherType;     // 날씨
  dailyWage?: number;       // 해당일 일당
  createdAt?: Date;
}

/** 팀원 정보 */
export interface TeamMember {
  id: string;
  name: string;
  phone?: string;
  dailyWage?: number;
}

/** 팀장용 팀원 공수 기록 */
export interface TeamDailyWork {
  id?: string;
  teamLeaderId: string;    // 팀장 userId
  memberId: string;         // TeamMember id
  memberName: string;
  date: string;             // YYYY-MM-DD
  manDay: number;
  overtime: boolean;
  dayOff: boolean;
  extension: boolean;
  memo: string;
  createdAt?: Date;
}

// ===== Phase 2: 즐겨찾기 =====

/** 즐겨찾기 대상 유형 */
export type FavoriteTargetType = 'user' | 'job';

/** 즐겨찾기 */
export interface Favorite {
  id?: string;
  userId: string;           // 즐겨찾기 한 사람
  targetId: string;         // 대상 ID (userId 또는 jobId)
  targetType: FavoriteTargetType;
  createdAt?: Date;
}

// ===== Phase 2: 프로필 편집용 =====

/** 프로필 업데이트 데이터 (구직자) */
export interface WorkerProfileUpdate {
  name: string;
  phone: string;
  skills: string[];
  experience: number;
  region: string;
  desiredWage: number;
  profileImage?: string;
  introduction?: string;    // 자기소개
}

/** 프로필 업데이트 데이터 (구인자) */
export interface EmployerProfileUpdate {
  name: string;
  phone: string;
  companyName: string;
  representativeName: string;
  mainJobCategories: JobCategory[];
  profileImage?: string;
  companyIntro?: string;    // 업체 소개
}
