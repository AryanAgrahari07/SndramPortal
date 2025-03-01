import axios from 'axios';
import { ActivityService } from '@/services/activityService';
import { CookieManager } from '@/utils/cookieManager';

export const setupAxiosInterceptors = () => {
    const activityService = ActivityService.getInstance();

    axios.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem('token');
            if (token && !config.url?.includes('refresh-token')) {
                config.headers.Authorization = `Bearer ${token}`;
                activityService.updateActivity();
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    axios.interceptors.response.use(
        (response) => {
            if (!response.config.url?.includes('refresh-token')) {
                activityService.updateActivity();
            }
            return response;
        },
        (error) => {
            if (error.response?.status === 401) {
                localStorage.removeItem('token');
                CookieManager.remove('refreshtoken');
                CookieManager.remove('lastActivityTime');
                window.location.replace('/login');
            }
            return Promise.reject(error);
        }
    );
};

export const enhancedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> => {
    const activityService = ActivityService.getInstance();
    const token = localStorage.getItem('token');
    
    // Add token to headers if it exists
    if (token && !input.toString().includes('refresh-token')) {
        init = init || {};
        init.headers = {
            ...init.headers,
            'Authorization': `Bearer ${token}`
        };
        activityService.updateActivity();
    }

    try {
        const response = await fetch(input, init);
        
        if (response.status === 401) {
            localStorage.removeItem('token');
            CookieManager.remove('refreshtoken');
            CookieManager.remove('lastActivityTime');
            window.location.replace('/login');
            throw new Error('Unauthorized');
        }

        if (response.ok && !input.toString().includes('refresh-token')) {
            activityService.updateActivity();
        }
        
        return response;
    } catch (error) {
        throw error;
    }
};