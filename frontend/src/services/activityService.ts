import { CookieManager } from '@/utils/cookieManager';

export class ActivityService {
    private static instance: ActivityService;
    private readonly INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes
    private readonly ACTIVITY_KEY = 'lastActivityTime';
    private timeoutId: NodeJS.Timeout | null = null;
    private listeners: (() => void)[] = [];
    private boundUpdateActivity: () => void;

    private constructor() {
        this.boundUpdateActivity = this.throttle(this.updateActivity.bind(this), 1000);
    }

    public static getInstance(): ActivityService {
        if (!this.instance) {
            this.instance = new ActivityService();
        }
        return this.instance;
    }

    public initializeActivityTracking(): void {
        console.log('Initializing activity tracking');
        
        // Clear any existing interval
        if (this.timeoutId) {
            clearInterval(this.timeoutId);
        }

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
        
        events.forEach(event => {
            document.addEventListener(event, this.boundUpdateActivity);
        });

        // Start the inactivity check immediately
        this.checkInactivity();
        this.startInactivityCheck();
    }


    private throttle(func: Function, limit: number): (...args: any[]) => void {
        let inThrottle = false;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    public updateActivity(): void {
        CookieManager.set(this.ACTIVITY_KEY, Date.now().toString(), {
            path: '/',
            sameSite: 'strict',
            secure: true
        });
    }

     public checkInactivity(): void {
        const lastActivity = this.getLastActivityTime();
        const token = localStorage.getItem('token');
        const refreshToken = CookieManager.get('refreshtoken');

        // console.log('Checking inactivity with:', {
        //     lastActivity: new Date(lastActivity || 0).toISOString(),
        //     hasToken: !!token,
        //     hasRefreshToken: !!refreshToken
        // })

        if (!lastActivity || !token || !refreshToken) {
          //  console.log('Missing required tokens or activity time');
            return;
        }

        const timeSinceLastActivity = Date.now() - lastActivity;
        // console.log('Time since last activity:', Math.floor(timeSinceLastActivity / 1000), 'seconds');
        
        if (timeSinceLastActivity > this.INACTIVITY_TIMEOUT) {
         //   console.log('Inactivity timeout reached, logging out...');
            this.notifyInactivity();
        }
    }


    private startInactivityCheck(): void {
        if (this.timeoutId) {
            clearInterval(this.timeoutId);
        }

        this.timeoutId = setInterval(() => {
         //   console.log('Running scheduled inactivity check');
            this.checkInactivity();
        }, 30000); // Check 30 seconds 
    }

    public getLastActivityTime(): number | null {
        const lastActivity = CookieManager.get(this.ACTIVITY_KEY);
        return lastActivity ? parseInt(lastActivity) : null;
    }

    public getRemainingTime(): number {
        const lastActivity = this.getLastActivityTime();
        if (!lastActivity) return 0;

        const elapsed = Date.now() - lastActivity;
        const remaining = Math.max(0, this.INACTIVITY_TIMEOUT - elapsed);
        return remaining;
    }

    private notifyInactivity(): void {
        this.listeners.forEach(listener => listener());
    }

    public onInactivity(callback: () => void): void {
        this.listeners.push(callback);
    }

    public removeInactivityListener(callback: () => void): void {
        this.listeners = this.listeners.filter(listener => listener !== callback);
    }

    public cleanup(): void {
        if (this.timeoutId) {
            clearInterval(this.timeoutId);
            this.timeoutId = null;
        }

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
        events.forEach(event => {
            // Remove the original bound function
            document.removeEventListener(event, this.boundUpdateActivity);
        });

        this.listeners = [];
        CookieManager.remove(this.ACTIVITY_KEY);
    }
}
