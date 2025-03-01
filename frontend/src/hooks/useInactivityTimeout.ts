import { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ActivityService } from '@/services/activityService';
import { CookieManager } from '@/utils/cookieManager';

export const useInactivityTimeout = () => {
    const { toast } = useToast();

    useEffect(() => {
        const token = localStorage.getItem('token');

        if (!token ) {
            console.log('No tokens found, skipping inactivity setup');
            return;
        }

        // console.log('Setting up inactivity timeout');
        const activityService = ActivityService.getInstance();

        const handleInactivity = () => {
            // console.log('Handling inactivity logout...');
            
            // Clear auth data
            localStorage.removeItem('token');
            CookieManager.remove('refreshtoken');
            CookieManager.remove('lastActivityTime');
            CookieManager.remove('lastActivityTime');
            
            // Clear all other storage
            localStorage.clear();
            CookieManager.clearAll();

            toast({
                title: 'Session Expired',
                description: 'You have been logged out due to inactivity',
                variant: 'destructive',
            });

            // Force a complete reload and redirect
            window.location.replace('/login');
        };

        // Initialize tracking and register handler
        activityService.initializeActivityTracking();
        activityService.onInactivity(handleInactivity);
        activityService.updateActivity(); // Set initial activity time

        return () => {
            console.log('Cleaning up inactivity timeout');
            activityService.cleanup();
            activityService.removeInactivityListener(handleInactivity);
        };
    }, [toast]);
};