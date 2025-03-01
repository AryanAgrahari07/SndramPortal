interface CookieOptions {
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    expires?: Date | number;
}

export class CookieManager {
    static set(name: string, value: string, options: CookieOptions = {}): void {
        let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

        if (options.path) cookieString += `; path=${options.path}`;
        if (options.domain) cookieString += `; domain=${options.domain}`;
        if (options.secure) cookieString += '; secure';
        if (options.sameSite) cookieString += `; samesite=${options.sameSite}`;
        
        if (options.expires) {
            if (typeof options.expires === 'number') {
                const date = new Date();
                date.setTime(date.getTime() + options.expires * 60000); // Convert minutes to milliseconds
                options.expires = date;
            }
            cookieString += `; expires=${options.expires.toUTCString()}`;
        }

        document.cookie = cookieString;
    }

    static get(name: string): string | null {
        const matches = document.cookie.match(new RegExp(
            "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    static remove(name: string, path: string = '/'): void {
        this.set(name, '', {
            path,
            expires: new Date(0),
        });
    }

    static clearAll(): void {
        const cookies = document.cookie.split(';');
        
        for (let cookie of cookies) {
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        }
    }
}