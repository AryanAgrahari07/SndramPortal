// interface UserData {
//     email: string;
//     role: string;
//     firstName: string;
//     lastName: string;
// }

// class TokenService {
//     private static listeners: (() => void)[] = [];


//     static getLocalAccessToken(): string | null {
//         return localStorage.getItem('token');
//     }

//     static getLocalRefreshToken(): string | null {
//         return localStorage.getItem('refreshToken');
//     }

//     static getSessionId(): string | null {
//         return localStorage.getItem('sessionId');
//     }

//     static setTokens(accessToken: string, refreshToken: string, sessionId: string): void {
//         localStorage.setItem('token', accessToken);
//         localStorage.setItem('refreshToken', refreshToken);
//         localStorage.setItem('sessionId', sessionId);
//     }

//     static removeTokens(): void {
//         localStorage.clear();
//         sessionStorage.clear();
//         // localStorage.removeItem('token');
//         // localStorage.removeItem('refreshToken');
//         // localStorage.removeItem('sessionId');
//         // sessionStorage.removeItem('userData');
//         // localStorage.removeItem('email');
//         // localStorage.removeItem('userRole');
//         // localStorage.removeItem('firstName');
//         // localStorage.removeItem('lastName');
//         this.notifyLogout();
//     }

//     static getUserData(): UserData | null {
//         const userData = sessionStorage.getItem('userData');
//         return userData ? JSON.parse(userData) : null;
//     }

//     static setUserData(userData: UserData): void {
//         sessionStorage.setItem('userData', JSON.stringify(userData));
//     }

//     static getUserRole(): string | null {
//         const userData = this.getUserData();
//         return userData?.role || null;
//     }

//     static isAuthenticated(): boolean {
//         const token = this.getLocalAccessToken();
//         return !!token && !this.isTokenExpired(token);
//     }

//     static isTokenExpired(token: string): boolean {
//         try {
//             const payload = JSON.parse(atob(token.split('.')[1]));
//             return payload.exp * 1000 < Date.now();
//         } catch {
//             return true;
//         }
//     }

//     static onLogout(callback: () => void) {
//         this.listeners.push(callback);
//         return () => {
//             this.listeners = this.listeners.filter(cb => cb !== callback);
//         };
//     }

//     private static notifyLogout() {
//         this.listeners.forEach(callback => callback());
//     }

//     static handleSessionExpired() {
//         this.removeTokens();
//         window.location.href = '/login';
//     }
// }

// export default TokenService;